import { NextResponse } from "next/server";

import { handleApiError, readJson, validationFailed } from "@/lib/api";
import { db } from "@/lib/db";
import { categoryCreateSchema } from "@/lib/validations";

// NOTE: unprotected until Phase 2.5 adds Auth.js. Local development only.

export async function GET() {
  try {
    const categories = await db.category.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(categories);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = categoryCreateSchema.safeParse(body.data);
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const category = await db.category.create({ data: parsed.data });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    // The slug uniqueness check is left to the database rather than a
    // read-then-write: a SELECT first would still race two concurrent creates.
    return handleApiError(error, {
      conflict: `A category with the slug "${parsed.data.slug}" already exists`,
    });
  }
}
