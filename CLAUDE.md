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
