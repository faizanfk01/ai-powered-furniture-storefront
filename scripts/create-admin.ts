/**
 * Create or update the single admin account.
 *
 *   npm run create-admin
 *
 * Credentials are never hardcoded and never committed. Two ways to supply them:
 *
 *   1. Interactive (preferred). Run with no env vars set; the script prompts.
 *      The password is read with echo suppressed, so it does not appear on
 *      screen and does not land in shell history.
 *
 *   2. Non-interactive, for CI or a scripted setup:
 *      ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run create-admin
 *      Prefer a leading space (where the shell supports HISTCONTROL=ignorespace)
 *      or an env file so the password stays out of history.
 *
 * Idempotent on email: running it again for the same address rotates that
 * account's password rather than creating a second admin.
 */
import "dotenv/config";

import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { db } from "../lib/db";

/**
 * bcrypt work factor. 12 is the common current default: roughly a quarter
 * second per hash on typical hardware, which is negligible for a login that
 * happens occasionally and expensive for anyone testing a stolen hash offline.
 */
const BCRYPT_COST = 12;

// Per the project rule that every write boundary validates with Zod — this is
// a write boundary like any other, even though the input comes from a person
// at a terminal rather than from HTTP.
const credentialsSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(200, "Password must be 200 characters or fewer"),
});

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Read a line without echoing it.
 *
 * readline still handles the line editing and the Enter key; only the terminal
 * echo is muted, by overriding the private hook readline uses to write typed
 * characters back to the screen.
 */
function promptSecret(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });

  // The prompt itself must still print; everything typed after it must not.
  let muted = false;
  const instance = rl as unknown as { _writeToOutput: (text: string) => void };
  instance._writeToOutput = (text: string) => {
    if (!muted) stdout.write(text);
  };

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      muted = false;
      stdout.write("\n");
      rl.close();
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const fromEnv = Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);

  const raw = fromEnv
    ? { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }
    : {
        email: await prompt("Admin email: "),
        password: await promptSecret("Admin password (hidden): "),
      };

  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) {
    // Only the messages — never echo back the values being validated.
    for (const issue of parsed.error.issues) {
      console.error(`  ✗ ${issue.path.join(".") || "input"}: ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const { email, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const existing = await db.adminUser.findUnique({ where: { email } });

  const admin = await db.adminUser.upsert({
    where: { email },
    create: { email, passwordHash },
    update: { passwordHash },
  });

  const total = await db.adminUser.count();

  console.log(
    existing
      ? `\nRotated password for existing admin: ${admin.email}`
      : `\nCreated admin: ${admin.email}`,
  );
  console.log(`  id           ${admin.id}`);
  console.log(`  createdAt    ${admin.createdAt.toISOString()}`);
  console.log(`  hash         bcrypt, cost ${BCRYPT_COST}, ${passwordHash.length} chars`);
  console.log(`  AdminUser rows in database: ${total}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
