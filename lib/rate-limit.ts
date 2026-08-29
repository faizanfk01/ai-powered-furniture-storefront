import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Per-IP rate limiting, backed by Upstash Redis.
 *
 * A LAYER IN FRONT OF the existing guards, not a replacement for any of them.
 * requireAdmin(), the proxy.ts matcher, the constant-time credential compare
 * and the grounding check are all untouched: this decides only whether a
 * request is allowed to reach them at all.
 *
 * WHY REDIS AND NOT AN IN-PROCESS COUNTER. A counter in a module resets on
 * every deploy and is per-instance, so on any platform that runs more than one
 * instance it reads like protection without being any — the note at the bottom
 * of app/api/chat/route.ts said exactly this, and this module is the answer to
 * it. Upstash is a REST API, so it works from any runtime without a connection
 * pool, which a serverless function cannot keep anyway.
 *
 * The one exception is the login backstop below, which IS an in-process
 * counter — deliberately, and only as a fallback for when Redis is unreachable.
 * See FAIL OPEN OR CLOSED.
 */

// ---------------------------------------------------------------------------
// The limits
// ---------------------------------------------------------------------------

/**
 * Every rule is a sliding window rather than a fixed one. A fixed window lets
 * a caller spend the whole budget in the last second of one window and the
 * whole budget again in the first second of the next — twice the intended rate
 * across that boundary, which is precisely the burst these limits exist to
 * stop.
 *
 * `prefix` namespaces the Redis keys. The library joins it to the identifier,
 * so the login bucket for an address is `rl:login:1.2.3.4` and the chat bucket
 * for the same address is `rl:chat:1.2.3.4` — one caller cannot spend their
 * chat budget by trying to sign in.
 */
const RULES = {
  /**
   * 5 attempts / 15 min. Counts EVERY attempt, not only the failures: there is
   * one admin account and no reason to sign in six times in a quarter of an
   * hour, and counting only failures would let an attacker with one valid
   * credential reset the window at will.
   */
  login: { limit: 5, window: "15 m", prefix: "rl:login" },
  /**
   * 15 requests / min. Each one is two Groq completions against an 8,000 TPM
   * budget (lib/ai/groq.ts), so this is the rule that decides whether one
   * visitor can empty the day's assistant for everyone else.
   */
  chat: { limit: 15, window: "1 m", prefix: "rl:chat" },
  /** 4 / hour. Nobody writes a fifth honest review of a sofa in an hour. */
  review: { limit: 4, window: "1 h", prefix: "rl:review" },
  /** 30 / min. Generous for a real bulk upload, finite for a loop. */
  presign: { limit: 30, window: "1 m", prefix: "rl:presign" },
} as const satisfies Record<
  string,
  { limit: number; window: `${number} ${"s" | "m" | "h"}`; prefix: string }
>;

export type RateLimitName = keyof typeof RULES;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Read explicitly rather than through `Redis.fromEnv()`, which throws when the
 * variables are absent. A missing Upstash configuration must not crash a page:
 * it degrades to "allowed", loudly, the same way a missing GROQ_API_KEY
 * degrades the assistant instead of 500ing the storefront.
 */
function createRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    console.warn(
      "[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set — " +
        "rate limiting is DISABLED. Set both before deploying.",
    );
    return null;
  }

  return new Redis({ url, token });
}

// As in lib/db.ts and lib/r2.ts: dev hot-reload re-evaluates this module on
// every edit. The limiters must survive that, or the ephemeral cache below is
// thrown away on each keystroke and every window silently restarts.
const globalForRateLimit = globalThis as unknown as {
  rateLimitRedis?: Redis | null;
  rateLimiters?: Map<RateLimitName, Ratelimit>;
};

const redis =
  globalForRateLimit.rateLimitRedis !== undefined
    ? globalForRateLimit.rateLimitRedis
    : createRedis();

const limiters = globalForRateLimit.rateLimiters ?? new Map<RateLimitName, Ratelimit>();

if (process.env.NODE_ENV !== "production") {
  globalForRateLimit.rateLimitRedis = redis;
  globalForRateLimit.rateLimiters = limiters;
}

/**
 * How long a limit check may take before the request is let through.
 *
 * The library's own default is 5s, which is longer than some of the requests
 * being protected. 2s is past any healthy Upstash round trip (typically 20-60ms
 * from a nearby region) and short enough that a dead Redis costs a visitor a
 * pause rather than a timeout.
 *
 * On timeout the library returns `success: true` with `reason: "timeout"` —
 * it fails OPEN, which is the behaviour argued for below.
 */
const REDIS_TIMEOUT_MS = 2_000;

function limiterFor(name: RateLimitName): Ratelimit | null {
  if (!redis) return null;

  const existing = limiters.get(name);
  if (existing) return existing;

  const rule = RULES[name];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(rule.limit, rule.window),
    prefix: rule.prefix,
    timeout: REDIS_TIMEOUT_MS,
    // Remembers identifiers already known to be over the limit, so a caller
    // hammering an endpoint is rejected in memory instead of costing a Redis
    // command per attempt. Only ever blocks — it can never let a request
    // through that Redis would have refused.
    ephemeralCache: new Map(),
  });

  limiters.set(name, limiter);
  return limiter;
}

// ---------------------------------------------------------------------------
// Client IP
// ---------------------------------------------------------------------------

/**
 * NextRequest has no `.ip` in Next 16 — the property was removed, and the type
 * (node_modules/next/dist/server/web/spec-extension/request.d.ts) carries only
 * `cookies`, `nextUrl`, `page`, `ua` and `url`. Headers are the supported way.
 *
 * Order matters, most trustworthy first:
 *
 *   1. `x-vercel-forwarded-for` — written by Vercel's edge and not forwardable
 *      by a client, so on Vercel this is the real peer address.
 *   2. `x-real-ip` — what Vercel and most reverse proxies also set, single
 *      value, no list to parse.
 *   3. `x-forwarded-for` — the standard header. The LEFTMOST entry is the
 *      original client; everything after it is the chain of proxies.
 *
 * TRUST BOUNDARY, AND IT IS A REAL ONE. These headers are only meaningful
 * because a proxy we trust overwrites them. On Vercel that holds — the platform
 * replaces any client-supplied value. Behind a reverse proxy that PASSES
 * `x-forwarded-for` through instead of overwriting it, a caller can send a
 * fresh address on every request and walk straight past every limit here. If
 * this is ever self-hosted, the proxy in front of it must set these headers
 * itself.
 */
export function clientIp(headers: Headers): string {
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) return firstAddress(vercel);

  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return firstAddress(forwarded);

  // Local development, or a direct connection with no proxy in front. Every
  // such caller shares one bucket, which is correct for a dev machine and is
  // why the trust-boundary note above matters in production.
  return "unknown";
}

function firstAddress(header: string): string {
  return header.split(",")[0]!.trim() || "unknown";
}

// ---------------------------------------------------------------------------
// FAIL OPEN OR CLOSED
// ---------------------------------------------------------------------------
//
// Every rule here fails OPEN: if Redis is unreachable, the request is allowed.
//
// For chat, reviews and presign that is uncontroversial — an Upstash outage
// must not take the storefront down with it, and the worst case is a window of
// the exact exposure that exists today.
//
// FOR LOGIN IT IS THE HARDER CALL, so the reasoning is written down.
//
// Failing CLOSED on login means an Upstash outage locks the owner out of their
// own store. The thing it would buy is protection against brute force during
// that outage — against a bcrypt cost-12 hash (~250ms per guess) protecting a
// password with a 12-character minimum (scripts/create-admin.ts:44). That is
// not a race an attacker wins in an outage window. So failing closed trades a
// certain, self-inflicted lockout of the only account that can run the shop
// for a defence against an attack that was already infeasible. That is a bad
// trade, and it is the wrong one to make on the endpoint whose whole job is to
// let the owner in.
//
// But failing open with NOTHING behind it puts login back to where the audit
// found it, so login alone gets a second, in-process backstop that runs only
// when Redis could not answer. It is honestly weaker than Redis: it resets on
// deploy and counts per instance, so N instances allow N times the budget.
// That is still a brake, it costs nothing when Redis is healthy, and unlike
// failing closed it cannot lock anybody out permanently.
//
// Both paths log, because a rate limiter that has silently stopped working is
// worse than one that was never added.

/** Per-instance fallback state for the login backstop. Never used when Redis answers. */
const loginFallbackHits = new Map<string, number[]>();

function loginBackstop(ip: string): RateLimitVerdict {
  const rule = RULES.login;
  const windowMs = 15 * 60 * 1000;
  const now = Date.now();

  const recent = (loginFallbackHits.get(ip) ?? []).filter(
    (at) => now - at < windowMs,
  );
  recent.push(now);
  loginFallbackHits.set(ip, recent);

  // Bounded so a spray across many spoofed addresses cannot grow this map
  // without limit. Dropping the oldest entries only ever forgets a block.
  if (loginFallbackHits.size > 10_000) {
    const oldest = loginFallbackHits.keys().next().value;
    if (oldest !== undefined) loginFallbackHits.delete(oldest);
  }

  const allowed = recent.length <= rule.limit;
  const oldestHit = recent[0] ?? now;

  return {
    allowed,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - recent.length),
    retryAfterSeconds: Math.max(1, Math.ceil((oldestHit + windowMs - now) / 1000)),
    degraded: true,
  };
}

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

export type RateLimitVerdict = {
  /** False means the caller is over the limit and must be rejected. */
  allowed: boolean;
  /** Requests permitted per window, for the `ratelimit-limit` header. */
  limit: number;
  /** Requests left in the current window. */
  remaining: number;
  /** Seconds until the window frees up, for `retry-after`. Always >= 1. */
  retryAfterSeconds: number;
  /**
   * True when the verdict did not come from Redis — unconfigured, unreachable,
   * or timed out. The caller is still told allow/deny; this says the answer was
   * a fallback rather than an authoritative count.
   */
  degraded: boolean;
};

/** The verdict when there is nothing to consult and nothing to fall back to. */
function allowDegraded(name: RateLimitName): RateLimitVerdict {
  return {
    allowed: true,
    limit: RULES[name].limit,
    remaining: RULES[name].limit,
    retryAfterSeconds: 1,
    degraded: true,
  };
}

/**
 * Ask whether this caller may proceed, and count the attempt if they may.
 *
 * Never throws. A limiter that can crash a route is a worse outage than the
 * abuse it was added to prevent, so every failure path here returns a verdict.
 */
export async function checkRateLimit(
  name: RateLimitName,
  ip: string,
): Promise<RateLimitVerdict> {
  const limiter = limiterFor(name);

  if (!limiter) {
    return name === "login" ? loginBackstop(ip) : allowDegraded(name);
  }

  try {
    const result = await limiter.limit(ip);

    // The library's own timeout already returned "allow" for us. Treat it as
    // the degraded path rather than as a real allowance, so login still gets
    // its backstop and the outage is logged.
    if (result.reason === "timeout") {
      console.error(
        `[rate-limit] redis timed out after ${REDIS_TIMEOUT_MS}ms for "${name}" — failing open`,
      );
      return name === "login" ? loginBackstop(ip) : allowDegraded(name);
    }

    return {
      allowed: result.success,
      limit: result.limit,
      remaining: result.remaining,
      retryAfterSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
      degraded: false,
    };
  } catch (error) {
    console.error(`[rate-limit] redis unavailable for "${name}" — failing open:`, error);
    return name === "login" ? loginBackstop(ip) : allowDegraded(name);
  }
}

/**
 * The standard advisory headers, sent with a REJECTION so the caller knows the
 * size of the budget it just exhausted and when it reopens — `retry-after`
 * alone says when, not what.
 *
 * Deliberately not attached to successful responses. Doing so would mean a
 * line in every handler on the happy path, for a signal only a client that
 * polls its own remaining quota would read, and nothing in this app does. The
 * scripts under scripts/ use the presence of `ratelimit-limit` to tell OUR 429
 * apart from an upstream's, which only needs it on the rejection.
 */
export function rateLimitHeaders(verdict: RateLimitVerdict): Record<string, string> {
  return {
    "ratelimit-limit": String(verdict.limit),
    "ratelimit-remaining": String(verdict.remaining),
    "ratelimit-reset": String(verdict.retryAfterSeconds),
  };
}
