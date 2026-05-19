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

type RowInput = {
  question_text?: unknown;
  question_type?: unknown;
  option_a?: unknown;
  option_b?: unknown;
  option_c?: unknown;
  option_d?: unknown;
  correct_answer?: unknown;
  explanation?: unknown;
  options?: unknown;
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

function normalizeCorrectAnswer(value: unknown): string {
  return asText(value).toUpperCase();
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
    const rows = Array.isArray(body.rows) ? (body.rows as RowInput[]) : [];

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

    const result = await prisma.$transaction(async (tx) => {
      const test = await tx.test.findUnique({
        where: { id: testId },
        select: { id: true },
      });

      if (!test) {
        return { error: "Test not found", status: 404 as const };
      }

      let section = await tx.testSection.findFirst({
        where: { testId },
        orderBy: { order: "asc" },
        select: { id: true },
      });

      if (!section) {
        section = await tx.testSection.create({
          data: {
            testId,
            title: "Section 1",
            order: 1,
          },
          select: { id: true },
        });
      }

      const lastQuestion = await tx.question.findFirst({
        where: { sectionId: section.id },
        orderBy: { order: "desc" },
        select: { order: true },
      });

      let nextOrder = (lastQuestion?.order ?? 0) + 1;
      let inserted = 0;

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] ?? {};
        const questionText = asText(row.question_text);
        const type = parseQuestionType(row.question_type);
        const correctAnswer = normalizeCorrectAnswer(row.correct_answer);
        const explanation = asText(row.explanation);

        if (!questionText || !type || !correctAnswer) {
          continue;
        }

        let options = Array.isArray(row.options)
          ? (
              row.options as Array<{
                label?: unknown;
                text?: unknown;
                isCorrect?: unknown;
              }>
            ).map((opt) => ({
              label: asText(opt.label),
              text: asText(opt.text),
              isCorrect: Boolean(opt.isCorrect),
            }))
          : [];

        if (!options.length) {
          options = [
            {
              label: "A",
              text: asText(row.option_a),
              isCorrect: correctAnswer === "A",
            },
            {
              label: "B",
              text: asText(row.option_b),
              isCorrect: correctAnswer === "B",
            },
            {
              label: "C",
              text: asText(row.option_c),
              isCorrect: correctAnswer === "C",
            },
            {
              label: "D",
              text: asText(row.option_d),
              isCorrect: correctAnswer === "D",
            },
          ].filter((o) => o.label && o.text);
        }

        if (type === "MULTIPLE_CHOICE" && options.length < 2) {
          continue;
        }

        await tx.question.create({
          data: {
            testId,
            sectionId: section.id,
            type,
            order: nextOrder,
            questionText,
            correctAnswer,
            acceptedAnswers: [correctAnswer],
            explanation: explanation || null,
            points: 1,
            options: options.length
              ? {
                  create: options.map((o) => ({
                    label: o.label,
                    text: o.text,
                    isCorrect: o.isCorrect,
                  })),
                }
              : undefined,
          },
        });

        nextOrder += 1;
        inserted += 1;
      }

      if (inserted > 0) {
        await tx.test.update({
          where: { id: testId },
          data: {
            totalQuestions: {
              increment: inserted,
            },
          },
        });
      }

      return { inserted };
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ inserted: result.inserted });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to insert questions in bulk", detail },
      { status: 500 },
    );
  }
}
