import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AllowedQuestionType =
  | "MULTIPLE_CHOICE"
  | "FILL_IN_BLANK"
  | "TRUE_FALSE_NOT_GIVEN"
  | "YES_NO_NOT_GIVEN"
  | "MATCHING_HEADINGS"
  | "MATCHING_INFORMATION"
  | "SENTENCE_COMPLETION"
  | "SUMMARY_COMPLETION"
  | "SHORT_ANSWER";

type CsvInputRow = {
  question_text?: unknown;
  question_type?: unknown;
  option_a?: unknown;
  option_b?: unknown;
  option_c?: unknown;
  option_d?: unknown;
  correct_answer?: unknown;
  explanation?: unknown;
};

type Body = {
  testId?: unknown;
  rows?: unknown;
};

const QUESTION_TYPES: AllowedQuestionType[] = [
  "MULTIPLE_CHOICE",
  "FILL_IN_BLANK",
  "TRUE_FALSE_NOT_GIVEN",
  "YES_NO_NOT_GIVEN",
  "MATCHING_HEADINGS",
  "MATCHING_INFORMATION",
  "SENTENCE_COMPLETION",
  "SUMMARY_COMPLETION",
  "SHORT_ANSWER",
];

function parseQuestionType(value: unknown): AllowedQuestionType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!QUESTION_TYPES.includes(normalized as AllowedQuestionType)) return null;
  return normalized as AllowedQuestionType;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser) {
    return { error: "Unauthorized", status: 401 as const };
  }

  const user = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: { role: true },
  });

  if (!user) {
    return { error: "User not found", status: 404 as const };
  }

  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return { error: "Forbidden", status: 403 as const };
  }

  return { ok: true as const };
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const testId = typeof body.testId === "string" ? body.testId.trim() : "";
    const rows = Array.isArray(body.rows) ? (body.rows as CsvInputRow[]) : [];

    if (!testId) {
      return NextResponse.json(
        { error: "testId is required" },
        { status: 400 },
      );
    }

    if (!rows.length) {
      return NextResponse.json(
        { error: "rows must be a non-empty array" },
        { status: 400 },
      );
    }

    const test = await prisma.test.findUnique({
      where: { id: testId },
      select: { id: true },
    });

    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    const sanitized: Array<{
      question_text: string;
      question_type: AllowedQuestionType;
      option_a: string;
      option_b: string;
      option_c: string;
      option_d: string;
      correct_answer: string;
      explanation: string;
    }> = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] ?? {};
      const question_text = asText(row.question_text);
      const question_type = parseQuestionType(row.question_type);
      const option_a = asText(row.option_a);
      const option_b = asText(row.option_b);
      const option_c = asText(row.option_c);
      const option_d = asText(row.option_d);
      const correct_answer = asText(row.correct_answer);
      const explanation = asText(row.explanation);

      if (!question_text) {
        return NextResponse.json(
          { error: `Row ${i + 1}: question_text is required` },
          { status: 400 },
        );
      }

      if (!question_type) {
        return NextResponse.json(
          { error: `Row ${i + 1}: invalid question_type` },
          { status: 400 },
        );
      }

      if (!correct_answer) {
        return NextResponse.json(
          { error: `Row ${i + 1}: correct_answer is required` },
          { status: 400 },
        );
      }

      if (question_type === "MULTIPLE_CHOICE") {
        const filledOptions = [option_a, option_b, option_c, option_d].filter(
          Boolean,
        ).length;
        if (filledOptions < 2) {
          return NextResponse.json(
            { error: `Row ${i + 1}: MULTIPLE_CHOICE needs at least 2 options` },
            { status: 400 },
          );
        }

        if (!["A", "B", "C", "D"].includes(correct_answer.toUpperCase())) {
          return NextResponse.json(
            {
              error: `Row ${i + 1}: MULTIPLE_CHOICE correct_answer must be A, B, C, or D`,
            },
            { status: 400 },
          );
        }
      }

      sanitized.push({
        question_text,
        question_type,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_answer: correct_answer.toUpperCase(),
        explanation,
      });
    }

    return NextResponse.json({
      rows: sanitized,
      valid: true,
      count: sanitized.length,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to validate CSV rows", detail },
      { status: 500 },
    );
  }
}
