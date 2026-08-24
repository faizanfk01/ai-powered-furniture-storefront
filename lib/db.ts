import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client";

// The pooled Neon host (`-pooler`). Serverless invocations open many
// short-lived connections, which is what PgBouncer is there to absorb.
// Migrations deliberately use the *direct* host instead — see prisma.config.ts.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill in the pooled Neon connection string.",
  );
}

// Prisma 7 requires a driver adapter; the bundled query engine of v6 is gone.
function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

type PrismaClientSingleton = ReturnType<typeof createPrismaClient>;

// In dev, Next.js hot-reload re-evaluates this module on every edit. Without
// caching on globalThis each reload would leak a new client (and a new pg
// Pool), eventually exhausting Neon's connection limit. globalThis survives
// HMR; the module scope does not.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const db: PrismaClientSingleton =
  globalForPrisma.prisma ?? createPrismaClient();

// Never cache in production: each serverless instance gets its own client, and
// holding a reference on globalThis there only hides lifecycle bugs.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
