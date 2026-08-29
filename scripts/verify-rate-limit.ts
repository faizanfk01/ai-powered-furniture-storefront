/**
 * The per-IP rate limits actually fire, and only where they should.
 *
 *   npm run test:rate-limit
 *
 * NEEDS A RUNNING SERVER, A DATABASE AND UPSTASH. It drives the real HTTP
 * endpoints, so `npm run dev` has to be up. Override the target with
 * ADMIN_TEST_URL if the server is not on port 3000.
 *
 * EVERY SECTION USES A FRESH RANDOM x-forwarded-for. Without that, a second
 * run inside fifteen minutes would be rejected by the first run's login
 * window and the results would be meaningless. It also means the real admin's
 * address is never spent by a test.
 *
 * WHAT DISTINGUISHES OUR 429 FROM GROQ'S. /api/chat can answer 429 for two
 * different reasons — this limiter, or Groq's own quota passed through — and
 * both carry code AI_BUSY on purpose (see the note in the route). The
 * `ratelimit-limit` header is the tell: our limiter sets it, the Groq
 * passthrough does not. Every assertion below checks that header rather than
 * the status alone.
 *
 * COSTS ALMOST NOTHING UPSTREAM. The chat section deliberately posts an
 * invalid body: the limiter runs before the body is parsed, so the request is
 * still counted, and a request under the limit comes back 400 from validation
 * without ever reaching Groq. That doubles as proof the limit really is in
 * front of everything else. One valid chat turn is sent, once, to confirm a
 * normal request still works.
 *
 * Creates a temporary AdminUser and temporary Review rows and deletes both in
 * a finally block, including on a crash. It never touches the real admin row.
 */
import "dotenv/config";

import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import { db } from "../lib/db";

const BASE = process.env.ADMIN_TEST_URL ?? "http://127.0.0.1:3000";
const TEST_EMAIL = `rl-check-${randomBytes(4).toString("hex")}@invalid.test`;
const REVIEW_AUTHOR = `RL Test ${randomBytes(4).toString("hex")}`;

let failures = 0;
function check(label: string, pass: boolean, detail?: string) {
  if (!pass) failures += 1;
  console.log(`  ${pass ? "[ok]  " : "[FAIL]"} ${label}${detail ? `  -> ${detail}` : ""}`);
}

/** A fresh address per section, so sections cannot spend each other's budget. */
function freshIp() {
  const octet = () => 1 + Math.floor(Math.random() * 254);
  return `198.51.${octet()}.${octet()}`;
}

/** True when a 429 came from OUR limiter rather than from an upstream. */
function isOurLimit(response: Response) {
  return response.status === 429 && response.headers.get("ratelimit-limit") !== null;
}

/**
 * How far past the nominal limit a rejection is still considered on time.
 *
 * A SLIDING WINDOW DOES NOT HAVE AN EXACT CUTOFF, and asserting one is how
 * this suite produced a flake that took two sessions to pin down. The count is
 * the current window plus a weighted share of the previous one, so a burst
 * that straddles a boundary sees its earliest requests decay out of the count
 * and gets a slightly larger effective allowance. Measured directly against
 * the presign rule (30/min): a tight burst blocks at #31 or #32, a burst
 * spread over ~30s blocks at #31, #32 or #33. Never at or before #30.
 *
 * So the property worth asserting is not "the (limit+1)th request is refused"
 * — that is not what the algorithm promises. It is:
 *
 *   1. NOTHING within the limit is ever refused. This is the one that matters:
 *      a limiter that rejects a legitimate request is a broken feature.
 *   2. A rejection arrives promptly after the limit, not eventually.
 *
 * Three is comfortably past the drift observed and still nowhere near double
 * the budget, so a limiter that had genuinely stopped counting would fail.
 */
const OVERSHOOT_ALLOWANCE = 3;

/**
 * Keep sending until the limiter refuses one, starting from a budget already
 * spent. Returns the 1-based index of the first refused request, counting from
 * the first request of the whole burst.
 */
async function findRejection(
  send: () => Promise<Response>,
  alreadySent: number,
): Promise<{ index: number; response: Response } | null> {
  for (let extra = 1; extra <= OVERSHOOT_ALLOWANCE + 1; extra += 1) {
    const response = await send();
    if (isOurLimit(response)) return { index: alreadySent + extra, response };
  }
  return null;
}

async function post(path: string, ip: string, body: unknown, cookie?: string) {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Driving the login form the way a browser with no JavaScript would — the same
// approach as scripts/verify-login.ts, plus an x-forwarded-for.
// ---------------------------------------------------------------------------

async function readField(loginUrl: string, pattern: RegExp) {
  const html = await (await fetch(loginUrl)).text();
  const match = html.match(pattern);
  if (!match) throw new Error(`field not found in rendered form: ${pattern}`);
  return match[1]!;
}

async function submitLogin(opts: { email: string; password: string; ip: string }) {
  const loginUrl = `${BASE}/login`;
  const actionId = await readField(loginUrl, /name="(\$ACTION_ID_[a-f0-9]+)"/);
  const hiddenCallback = await readField(
    loginUrl,
    /name="callbackUrl"[^>]*value="([^"]*)"/,
  );

  const form = new FormData();
  form.set(actionId, "");
  form.set("callbackUrl", hiddenCallback);
  form.set("email", opts.email);
  form.set("password", opts.password);

  const response = await fetch(loginUrl, {
    method: "POST",
    body: form,
    redirect: "manual",
    headers: { "x-forwarded-for": opts.ip },
  });

  const location =
    response.headers.get("location") ??
    response.headers.get("x-action-redirect") ??
    "";

  const cookies: string[] = [];
  for (const raw of response.headers.getSetCookie()) {
    const pair = raw.split(";")[0];
    if (pair) cookies.push(pair);
  }

  return { response, location, cookie: cookies.join("; ") };
}

async function main() {
  const password = randomBytes(24).toString("hex");
  await db.adminUser.create({
    data: { email: TEST_EMAIL, passwordHash: await bcrypt.hash(password, 10) },
  });

  try {
    // -----------------------------------------------------------------------
    console.log("\n1. /api/chat — 15 / minute");
    // -----------------------------------------------------------------------
    {
      const ip = freshIp();
      // Invalid body on purpose: counted by the limiter, rejected by Zod, never
      // sent to Groq. See the header note.
      const bad = { message: "", history: [] };

      const statuses: number[] = [];
      for (let i = 0; i < 15; i += 1) {
        statuses.push((await post("/api/chat", ip, bad)).status);
      }

      check(
        "the first 15 requests are all allowed through to validation",
        statuses.every((s) => s === 400),
        `statuses: ${[...new Set(statuses)].join(", ")}`,
      );

      const rejection = await findRejection(() => post("/api/chat", ip, bad), 15);
      check(
        `a request past the limit is rejected by OUR limiter (within ${OVERSHOOT_ALLOWANCE} of it)`,
        rejection !== null,
        rejection ? `blocked at #${rejection.index}` : "never blocked",
      );
      if (!rejection) return;
      const sixteenth = rejection.response;
      const body = (await sixteenth.json()) as { error?: { code?: string; message?: string } };

      check(
        "it carries code AI_BUSY, the shape the widget already handles",
        body.error?.code === "AI_BUSY",
        `code ${body.error?.code}`,
      );
      check("it sets retry-after", sixteenth.headers.get("retry-after") !== null,
        `retry-after: ${sixteenth.headers.get("retry-after")}`);
      check(
        "ratelimit-limit reports 15",
        sixteenth.headers.get("ratelimit-limit") === "15",
        `got ${sixteenth.headers.get("ratelimit-limit")}`,
      );
      check(
        "the message tells the customer to slow down, not 'rate limited'",
        /wait a moment|slow|try again/i.test(body.error?.message ?? ""),
        JSON.stringify(body.error?.message),
      );

      // A different address is unaffected — proof the key is per-IP.
      const other = await post("/api/chat", freshIp(), bad);
      check("a different IP is unaffected", other.status === 400, `status ${other.status}`);
    }

    // -----------------------------------------------------------------------
    console.log("\n2. /api/chat — a normal request under the limit still works");
    // -----------------------------------------------------------------------
    {
      const response = await post("/api/chat", freshIp(), {
        message: "Do you make dining tables?",
        history: [],
      });

      // 200 is the expected answer. A 503 means Groq itself is unreachable,
      // which is not this layer's failure — but it must NOT be a 429 from us.
      check(
        "a valid first message is not rate limited",
        !isOurLimit(response),
        `status ${response.status}`,
      );
      check(
        "it reaches the assistant (200, or 503 if Groq is down)",
        response.status === 200 || response.status === 503,
        `status ${response.status}`,
      );
      if (response.status === 200) {
        const data = (await response.json()) as { ok?: boolean; reply?: string };
        check("the reply is a real grounded turn", data.ok === true && Boolean(data.reply));
      }
    }

    // -----------------------------------------------------------------------
    console.log("\n3. POST /api/reviews — 4 / hour");
    // -----------------------------------------------------------------------
    {
      const ip = freshIp();
      const review = (n: number) => ({
        authorName: REVIEW_AUTHOR,
        rating: 5,
        body: `Rate limit verification row ${n}. Safe to delete.`,
        productId: null,
      });

      const created: number[] = [];
      for (let i = 0; i < 4; i += 1) {
        created.push((await post("/api/reviews", ip, review(i)).then((r) => r.status)));
      }
      check(
        "the first 4 submissions are accepted",
        created.every((s) => s === 201),
        `statuses: ${[...new Set(created)].join(", ")}`,
      );

      const fifth = await post("/api/reviews", ip, review(4));
      const body = (await fifth.json()) as { error?: { code?: string; message?: string } };

      check("the 5th is rejected by OUR limiter", isOurLimit(fifth), `status ${fifth.status}`);
      check("code is RATE_LIMITED", body.error?.code === "RATE_LIMITED", `code ${body.error?.code}`);
      check(
        "the message names a concrete wait, so the form banner is actionable",
        /try again in about \d+ minute/.test(body.error?.message ?? ""),
        JSON.stringify(body.error?.message),
      );
      check(
        "ratelimit-limit reports 4",
        fifth.headers.get("ratelimit-limit") === "4",
        `got ${fifth.headers.get("ratelimit-limit")}`,
      );

      const retryAfter = Number(fifth.headers.get("retry-after"));
      check(
        "retry-after is inside the one-hour window",
        retryAfter > 0 && retryAfter <= 3600,
        `${retryAfter}s`,
      );

      const stored = await db.review.count({ where: { authorName: REVIEW_AUTHOR } });
      check("exactly 4 rows reached the database, not 5", stored === 4, `${stored} rows`);
    }

    // -----------------------------------------------------------------------
    console.log("\n4. Namespacing — buckets do not collide");
    // -----------------------------------------------------------------------
    {
      const ip = freshIp();
      // Spend this address's entire review budget…
      for (let i = 0; i < 5; i += 1) {
        await post("/api/reviews", ip, {
          authorName: REVIEW_AUTHOR,
          rating: 4,
          body: `Namespace check ${i}. Safe to delete.`,
          productId: null,
        });
      }
      const blockedReview = await post("/api/reviews", ip, {
        authorName: REVIEW_AUTHOR,
        rating: 4,
        body: "Namespace check, over limit. Safe to delete.",
        productId: null,
      });
      check("reviews are exhausted for this IP", isOurLimit(blockedReview));

      // …and confirm the SAME address still has its chat budget.
      const chat = await post("/api/chat", ip, { message: "", history: [] });
      check(
        "the same IP can still reach /api/chat (rl:review vs rl:chat)",
        chat.status === 400 && !isOurLimit(chat),
        `status ${chat.status}`,
      );
    }

    // -----------------------------------------------------------------------
    console.log("\n5. The login form — 5 / 15 minutes");
    // -----------------------------------------------------------------------
    {
      const ip = freshIp();
      const outcomes: string[] = [];

      for (let i = 0; i < 5; i += 1) {
        const { location } = await submitLogin({
          email: TEST_EMAIL,
          password: "definitely-the-wrong-password",
          ip,
        });
        outcomes.push(location);
      }

      check(
        "the first 5 wrong passwords are processed normally",
        outcomes.every((l) => l.includes("error=CredentialsSignin")),
        outcomes.map((l) => l || "(none)").join(" | "),
      );

      const sixth = await submitLogin({
        email: TEST_EMAIL,
        password: "definitely-the-wrong-password",
        ip,
      });
      check(
        "the 6th is refused by the limiter, not by bcrypt",
        sixth.location.includes("error=RateLimited"),
        sixth.location || "(no redirect)",
      );

      // THE ENUMERATION PROPERTY. A blocked address must answer identically
      // for the real admin address and for one that does not exist — if the
      // limiter consulted the email, these two would differ.
      const blockedRealAccount = await submitLogin({
        email: TEST_EMAIL,
        password,
        ip,
      });
      const blockedUnknownAccount = await submitLogin({
        email: `no-such-${randomBytes(4).toString("hex")}@invalid.test`,
        password: "whatever",
        ip,
      });
      check(
        "a blocked IP gets the same answer for a real account as for an unknown one",
        blockedRealAccount.location === blockedUnknownAccount.location,
        `${blockedRealAccount.location} vs ${blockedUnknownAccount.location}`,
      );
      check(
        "and the CORRECT password is refused too while blocked (the brake is real)",
        blockedRealAccount.location.includes("error=RateLimited") &&
          !blockedRealAccount.cookie.includes("authjs.session-token"),
        blockedRealAccount.location,
      );

      // A different address signs in cleanly — the block is per-IP, and the
      // credential path itself is untouched.
      const elsewhere = await submitLogin({ email: TEST_EMAIL, password, ip: freshIp() });
      check(
        "the same correct credentials succeed from a different IP",
        elsewhere.location.includes("/admin") &&
          elsewhere.cookie.includes("authjs.session-token"),
        elsewhere.location || "(no redirect)",
      );
    }

    // -----------------------------------------------------------------------
    console.log("\n5b. …and the auth endpoint UNDER the form, which is the real target");
    // -----------------------------------------------------------------------
    //
    // REGRESSION TEST FOR A HOLE THIS SUITE ONCE MISSED. Limiting the login
    // Server Function protects the form and nothing else: signIn() reaches
    // Auth.js in process, so /api/auth/callback/credentials never sees that
    // check. It is reachable over plain HTTP with a token from /api/auth/csrf,
    // and before proxy.ts grew its rate-limit branch it took twelve guesses in
    // a row without complaint. An attacker uses this URL, not the form.
    {
      const ip = freshIp();
      const jar = new Map<string, string>();
      const absorb = (response: Response) => {
        for (const raw of response.headers.getSetCookie()) {
          const pair = raw.split(";")[0]!;
          const eq = pair.indexOf("=");
          if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
        }
      };
      const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

      const csrfResponse = await fetch(`${BASE}/api/auth/csrf`, {
        headers: { "x-forwarded-for": ip },
      });
      absorb(csrfResponse);
      const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

      const guess = (password: string) =>
        fetch(`${BASE}/api/auth/callback/credentials`, {
          method: "POST",
          redirect: "manual",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "x-forwarded-for": ip,
            cookie: cookie(),
          },
          body: new URLSearchParams({
            csrfToken,
            email: TEST_EMAIL,
            password,
            callbackUrl: `${BASE}/admin`,
          }).toString(),
        });

      const early: string[] = [];
      for (let i = 0; i < 5; i += 1) {
        const response = await guess(`guess-${i}`);
        early.push(response.headers.get("location") ?? "");
      }
      check(
        "the first 5 direct guesses are processed",
        early.every((l) => l.includes("error=CredentialsSignin")),
        early.map((l) => (l.includes("CredentialsSignin") ? "refused" : l)).join(" | "),
      );

      const sixth = await guess("guess-5");
      check(
        "the 6th direct guess is rate limited, not answered",
        (sixth.headers.get("location") ?? "").includes("error=RateLimited"),
        sixth.headers.get("location") ?? "(no redirect)",
      );
      check(
        "and even the CORRECT password is refused on this path while blocked",
        ((await guess(password)).headers.get("location") ?? "").includes("error=RateLimited"),
      );
    }

    // -----------------------------------------------------------------------
    console.log("\n5c. The form and the auth endpoint share ONE budget");
    // -----------------------------------------------------------------------
    //
    // Two entrances to the same door must not mean ten attempts instead of
    // five. Both count into rl:login:<ip>, so three through the form leaves
    // exactly two on the callback. This also pins down that the Server
    // Function's internal signIn() does NOT re-enter proxy.ts — if it did,
    // every form attempt would be counted twice and this would block early.
    {
      const ip = freshIp();

      for (let i = 0; i < 3; i += 1) {
        await submitLogin({ email: TEST_EMAIL, password: "wrong", ip });
      }

      const jar = new Map<string, string>();
      const csrfResponse = await fetch(`${BASE}/api/auth/csrf`, {
        headers: { "x-forwarded-for": ip },
      });
      for (const raw of csrfResponse.headers.getSetCookie()) {
        const pair = raw.split(";")[0]!;
        const eq = pair.indexOf("=");
        if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
      }
      const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

      const guess = () =>
        fetch(`${BASE}/api/auth/callback/credentials`, {
          method: "POST",
          redirect: "manual",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "x-forwarded-for": ip,
            cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
          },
          body: new URLSearchParams({
            csrfToken,
            email: TEST_EMAIL,
            password: "wrong",
            callbackUrl: `${BASE}/admin`,
          }).toString(),
        }).then((r) => r.headers.get("location") ?? "");

      const fourth = await guess();
      const fifth = await guess();
      const sixth = await guess();

      check("attempt 4 (first on the callback) is still processed", fourth.includes("CredentialsSignin"));
      check("attempt 5 is still processed", fifth.includes("CredentialsSignin"));
      check(
        "attempt 6 is blocked — 3 + 2 spent one budget of 5, not two of 5",
        sixth.includes("RateLimited"),
        sixth || "(no redirect)",
      );
    }

    // -----------------------------------------------------------------------
    console.log("\n6. The presign endpoint — 30 / minute");
    // -----------------------------------------------------------------------
    {
      const product = await db.product.findFirst({ select: { id: true } });

      if (!product) {
        check("a product exists to presign against", false, "catalogue is empty — seed first");
      } else {
        // Sign in from an address of its own, so this login does not spend the
        // budget section 5 is measuring.
        const session = await submitLogin({
          email: TEST_EMAIL,
          password,
          ip: freshIp(),
        });
        check(
          "signed in for the admin-only endpoint",
          session.cookie.includes("authjs.session-token"),
        );

        const ip = freshIp();
        const path = `/api/admin/products/${product.id}/images/presign`;
        const body = { contentType: "image/jpeg", fileSize: 120_000 };

        // FIRED CONCURRENTLY, and that is load-bearing for the assertion below.
        // Sequentially each presign costs ~650ms (a product lookup plus the
        // signing), so 30 of them span ~20s of a 60-second window — long
        // enough that the earliest requests decay out of the sliding count
        // before the burst ends, and the effective allowance drifts well past
        // 30. Measured: sequentially it sometimes did not reject even the 34th.
        //
        // In parallel the whole burst lands inside two or three seconds, the
        // window barely moves, and the limit bites exactly where it should.
        // This is also the shape real abuse takes — nobody hand-paces a flood.
        const statuses = await Promise.all(
          Array.from({ length: 30 }, () =>
            post(path, ip, body, session.cookie).then((r) => r.status),
          ),
        );
        check(
          "the first 30 presign requests succeed",
          statuses.every((s) => s === 200),
          `statuses: ${[...new Set(statuses)].join(", ")}`,
        );

        const rejection = await findRejection(() => post(path, ip, body, session.cookie), 30);
        check(
          `a request past the limit is rejected (within ${OVERSHOOT_ALLOWANCE} of it)`,
          rejection !== null,
          rejection ? `blocked at #${rejection.index}` : "never blocked",
        );

        if (rejection) {
          const errorBody = (await rejection.response.json()) as {
            error?: { code?: string; message?: string };
          };
          check("code is RATE_LIMITED", errorBody.error?.code === "RATE_LIMITED");
          check(
            "ratelimit-limit reports 30",
            rejection.response.headers.get("ratelimit-limit") === "30",
            `got ${rejection.response.headers.get("ratelimit-limit")}`,
          );
        }

        // The auth guard still runs FIRST and is unchanged: no cookie is a 401,
        // never a 429, even from an address that is over its presign limit.
        const anonymous = await post(path, ip, body);
        check(
          "an unauthenticated call is still 401, not 429 — the guard is untouched",
          anonymous.status === 401,
          `status ${anonymous.status}`,
        );
      }
    }

    // -----------------------------------------------------------------------
    console.log("\n7. The window actually reopens (real elapsed time)");
    // -----------------------------------------------------------------------
    {
      const ip = freshIp();
      const bad = { message: "", history: [] };

      // Same overshoot allowance as section 1 — this is a setup step, and
      // pinning it to exactly the 16th request made it fail roughly one run in
      // four for a limiter that was behaving correctly.
      for (let i = 0; i < 15; i += 1) await post("/api/chat", ip, bad);
      const rejection = await findRejection(() => post("/api/chat", ip, bad), 15);
      check(
        "exhausted, as set up",
        rejection !== null,
        rejection ? `blocked at #${rejection.index}` : "never blocked",
      );
      if (!rejection) return;
      const blocked = rejection.response;

      const wait = Number(blocked.headers.get("retry-after")) || 60;
      check("the reported wait is inside the one-minute window", wait > 0 && wait <= 60, `${wait}s`);

      console.log(`       waiting ${wait + 2}s for the window to slide…`);
      await new Promise((resolve) => setTimeout(resolve, (wait + 2) * 1000));

      const afterWait = await post("/api/chat", ip, bad);
      check(
        "the same IP is allowed through again once the window has passed",
        afterWait.status === 400 && !isOurLimit(afterWait),
        `status ${afterWait.status}`,
      );
    }

    console.log(
      "\n   Note: sections 3, 5 and 6 assert the reset VALUE is inside its window" +
        "\n   rather than waiting an hour / fifteen minutes for it. Section 7 waits" +
        "\n   out a real window end to end; all four rules run the same sliding" +
        "\n   window through the same helper, so what it proves is the mechanism.",
    );
  } finally {
    await db.review.deleteMany({ where: { authorName: REVIEW_AUTHOR } });
    await db.adminUser.deleteMany({ where: { email: TEST_EMAIL } });
    console.log("\n   cleaned up: temporary admin and review rows removed");
  }

  console.log(
    failures === 0
      ? "\nAll rate-limit checks passed.\n"
      : `\n${failures} CHECK(S) FAILED.\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
