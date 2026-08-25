import "dotenv/config";
import { defineConfig } from "prisma/config";

// This config is consumed by the Prisma CLI only (`migrate`, `db`, `studio`) —
// it is not bundled into the Next.js app. The application's runtime connection
// is created in lib/ and reads DATABASE_URL (the pooled Neon host).
//
// Migrations deliberately use DIRECT_URL (the unpooled Neon host). They take
// session-level advisory locks and run DDL like `CREATE EXTENSION`, neither of
// which is reliable through PgBouncer's transaction pooling. Falls back to
// DATABASE_URL so the CLI still works if only one URL is configured.
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error(
    "Missing database connection string: set DIRECT_URL (preferred) or DATABASE_URL in .env",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Prisma 7 reads the seed command from here. The old `prisma.seed` key in
    // package.json is only consulted when no config file exists, so putting it
    // there would silently do nothing.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: migrationUrl,
  },
});
