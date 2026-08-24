@AGENTS.md

# Furniture Showroom — Project Context

Production website for a furniture & interior decor business (Mardan, PK).
Local audience, English only.

## Stack (locked — do not change without asking)
- Next.js 16 (App Router, TypeScript, Turbopack)
- Tailwind CSS v4 (CSS-first config via @theme in app/globals.css)
- Prisma + Neon Postgres
- Auth.js (single admin account) — added in a later phase
- Groq (Llama) for AI chat + cached product summaries
- Cloudflare R2 for images
- Postgres full-text + pg_trgm for search. NO vector DB.

## Brand tokens
- primary-dark #0e202c
- primary-light #fbfbfb

## Payments
None. All purchase intent routes to WhatsApp (+923009059052).

## Working style
Build in phases. Short scoped prompts. Stop after each step for review.
Do not add features, pages, or scope not explicitly requested.

## Rules carried forward from Phase 1

**Never run `npm audit fix --force`.**
There is an open high-severity advisory for `deepmerge-ts <8.0.0`, reaching us
via `prisma -> @prisma/config -> c12`. The "fix" downgrades to prisma@6.12.0,
which would break the entire v7 setup (driver adapters, prisma.config.ts, the
`prisma-client` generator). Real exposure is a dev-only CLI parsing our own
config file — no attacker-controlled input, never shipped to production.
Clears on its own when Prisma bumps c12.

**Never run `prisma db push`.**
Two database objects exist only in migration history and are not representable
in schema.prisma: the `pg_trgm` extension and the `Review_rating_check`
constraint. `db push` does not know about them and would drop or skip them.
`prisma db pull` will not recover them either. Always use
`prisma migrate dev` / `prisma migrate deploy`.

**Validate with Zod at every write boundary.**
`Review.rating` has a DB-level `CHECK (rating BETWEEN 1 AND 5)`, but it is a
backstop that surfaces a raw Postgres error, not a usable message. The same
applies to any future constraint. App-level validation is the primary guard;
the DB constraint is the thing that holds when a code path forgets.
