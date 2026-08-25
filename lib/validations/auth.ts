import { z } from "zod";

/**
 * Shape of a sign-in submission.
 *
 * Auth.js hands `authorize` a `Partial<Record<string, unknown>>` — it performs
 * no validation of its own and says so in its docs — so this runs before the
 * values are used for anything, including the database lookup.
 *
 * Deliberately weaker than the rules in scripts/create-admin.ts: this is a
 * check that the submission is well-formed, not a password policy. Enforcing
 * a minimum length here would tell an attacker which guesses were too short
 * to be the real password.
 */
export const signInSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export type SignInInput = z.infer<typeof signInSchema>;
