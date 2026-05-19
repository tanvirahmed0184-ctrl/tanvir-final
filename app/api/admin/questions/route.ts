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

type Body = {
  testId?: unknown;
  question_type?: unknown;
  question_text?: unknown;
  correct_answer?: unknown;
  explanation?: unknown;
  options?: unknown;
};

type OptionInput = {
  label?: unknown;
  text?: unknown;
  isCorrect?: unknown;
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
  if (!QUESTION_TYPES.includes(value as AllowedQuestionType)) return null;
  return value as AllowedQuestionType;
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
    const type = parseQuestionType(body.question_type);
    const questionText =
      typeof body.question_text === "string" ? body.question_text.trim() : "";
    const correctAnswer =
      typeof body.correct_answer === "string" ? body.correct_answer.trim() : "";
    const explanation =
      typeof body.explanation === "string" ? body.explanation.trim() : "";

    if (!testId) {
      return NextResponse.json(
        { error: "testId is required" },
        { status: 400 },
      );
    }

    if (!type) {
      return NextResponse.json(
        { error: "Invalid question_type" },
        { status: 400 },
      );
    }

    if (!questionText) {
      return NextResponse.json(
        { error: "question_text is required" },
        { status: 400 },
      );
    }

    if (!correctAnswer) {
      return NextResponse.json(
        { error: "correct_answer is required" },
        { status: 400 },
      );
    }

    const rawOptions = Array.isArray(body.options)
      ? (body.options as OptionInput[])
      : [];

    const normalizedOptions = rawOptions
      .map((o) => ({
        label: typeof o.label === "string" ? o.label.trim() : "",
        text: typeof o.text === "string" ? o.text.trim() : "",
        isCorrect: Boolean(o.isCorrect),
      }))
      .filter((o) => o.label && o.text);

    if (type === "MULTIPLE_CHOICE" && normalizedOptions.length < 2) {
      return NextResponse.json(
        { error: "MULTIPLE_CHOICE requires at least 2 options" },
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

      const question = await tx.question.create({
        data: {
          testId,
          sectionId: section.id,
          type,
          order: (lastQuestion?.order ?? 0) + 1,
          questionText,
          correctAnswer,
          acceptedAnswers: [correctAnswer],
          explanation: explanation || null,
          points: 1,
          options: normalizedOptions.length
            ? {
                create: normalizedOptions.map((opt) => ({
                  label: opt.label,
                  text: opt.text,
                  isCorrect: opt.isCorrect,
                })),
              }
            : undefined,
        },
        select: {
          id: true,
          questionText: true,
          type: true,
          explanation: true,
        },
      });

      await tx.test.update({
        where: { id: testId },
        data: {
          totalQuestions: {
            increment: 1,
          },
        },
      });

      return { question };
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ question: result.question }, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create question", detail },
      { status: 500 },
    );
  }
}
