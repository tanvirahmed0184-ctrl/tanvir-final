import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini";
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
  content?: unknown;
  questionType?: unknown;
  count?: unknown;
  testId?: unknown;
};

type GeneratedQuestion = {
  question_text: string;
  question_type: AllowedQuestionType;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_answer: string;
  explanation?: string;
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

function parseRequestedType(value: unknown): AllowedQuestionType | "MIXED" {
  if (value === "MIXED") return "MIXED";
  return typeof value === "string" &&
    QUESTION_TYPES.includes(value as AllowedQuestionType)
    ? (value as AllowedQuestionType)
    : "MIXED";
}

function clampCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(20, Math.round(n)));
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

function extractJson(text: string) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return JSON array");
  }
  return text.slice(start, end + 1);
}

function sanitizeType(value: unknown): AllowedQuestionType | null {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  return QUESTION_TYPES.includes(upper as AllowedQuestionType)
    ? (upper as AllowedQuestionType)
    : null;
}

function sanitizeQuestion(input: unknown): GeneratedQuestion | null {
  const row = (input ?? {}) as Record<string, unknown>;

  const question_text =
    typeof row.question_text === "string" ? row.question_text.trim() : "";
  const question_type = sanitizeType(row.question_type);
  const correct_answer =
    typeof row.correct_answer === "string"
      ? row.correct_answer.trim().toUpperCase()
      : "";

  if (!question_text || !question_type || !correct_answer) return null;

  const out: GeneratedQuestion = {
    question_text,
    question_type,
    correct_answer,
  };

  const optionA = typeof row.option_a === "string" ? row.option_a.trim() : "";
  const optionB = typeof row.option_b === "string" ? row.option_b.trim() : "";
  const optionC = typeof row.option_c === "string" ? row.option_c.trim() : "";
  const optionD = typeof row.option_d === "string" ? row.option_d.trim() : "";
  const explanation =
    typeof row.explanation === "string" ? row.explanation.trim() : "";

  if (optionA) out.option_a = optionA;
  if (optionB) out.option_b = optionB;
  if (optionC) out.option_c = optionC;
  if (optionD) out.option_d = optionD;
  if (explanation) out.explanation = explanation;

  if (question_type === "MULTIPLE_CHOICE") {
    const optCount = [optionA, optionB, optionC, optionD].filter(
      Boolean,
    ).length;
    if (optCount < 2) return null;
    if (!["A", "B", "C", "D"].includes(correct_answer)) return null;
  }

  return out;
}

function fallbackGenerate(
  content: string,
  questionType: AllowedQuestionType | "MIXED",
  count: number,
): GeneratedQuestion[] {
  const baseText = content.slice(0, 160) || "IELTS preparation";

  return Array.from({ length: count }).map((_, i) => {
    const useType =
      questionType === "MIXED"
        ? i % 2 === 0
          ? "MULTIPLE_CHOICE"
          : "TRUE_FALSE_NOT_GIVEN"
        : questionType;

    if (useType === "MULTIPLE_CHOICE") {
      return {
        question_text: `(${i + 1}) Based on the passage, what is the most accurate statement? ${baseText}`,
        question_type: "MULTIPLE_CHOICE" as const,
        option_a: "The passage rejects structured practice",
        option_b: "The passage supports focused IELTS preparation",
        option_c: "The passage is about unrelated topics",
        option_d: "The passage avoids exam strategy",
        correct_answer: "B",
        explanation: "The text emphasizes targeted IELTS preparation.",
      };
    }

    return {
      question_text: `(${i + 1}) The passage states that regular practice improves IELTS outcomes.`,
      question_type: "TRUE_FALSE_NOT_GIVEN" as const,
      correct_answer: "TRUE",
      explanation:
        "Practice is explicitly framed as beneficial in the source context.",
    };
  });
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const questionType = parseRequestedType(body.questionType);
    const count = clampCount(body.count);
    const testId = typeof body.testId === "string" ? body.testId.trim() : "";

    if (!content) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 },
      );
    }

    if (!testId) {
      return NextResponse.json(
        { error: "testId is required" },
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

    const systemPrompt = `You are an IELTS exam content generator.
Generate ${count} IELTS-style questions from the provided source content.
Requested type: ${questionType}.
Allowed question_type values only: ${QUESTION_TYPES.join(", ")}.
Return ONLY a valid JSON array (no markdown), where each object has:
{
  "question_text": "...",
  "question_type": "MULTIPLE_CHOICE | FILL_IN_BLANK | TRUE_FALSE_NOT_GIVEN | YES_NO_NOT_GIVEN | MATCHING_HEADINGS | MATCHING_INFORMATION | SENTENCE_COMPLETION | SUMMARY_COMPLETION | SHORT_ANSWER",
  "option_a": "...",
  "option_b": "...",
  "option_c": "...",
  "option_d": "...",
  "correct_answer": "...",
  "explanation": "..."
}
For non-MCQ types, option_a..option_d may be omitted.
For MCQ, include at least 2 options and set correct_answer as A/B/C/D.`;

    const prompt = `${systemPrompt}\n\nSource content:\n${content}`;

    try {
      const ai = getGeminiClient();
      const response = (await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      })) as unknown as {
        text?: string;
        outputText?: string;
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const rawText =
        response.text ??
        response.outputText ??
        response.candidates?.[0]?.content?.parts?.[0]?.text ??
        "";

      if (!rawText) throw new Error("Empty model response");

      const parsed = JSON.parse(extractJson(rawText)) as unknown[];
      const sanitized = parsed
        .map(sanitizeQuestion)
        .filter(Boolean) as GeneratedQuestion[];

      if (!sanitized.length) {
        const fallback = fallbackGenerate(content, questionType, count);
        return NextResponse.json({ questions: fallback, source: "fallback" });
      }

      return NextResponse.json({
        questions: sanitized.slice(0, count),
        source: "ai",
      });
    } catch {
      const fallback = fallbackGenerate(content, questionType, count);
      return NextResponse.json({ questions: fallback, source: "fallback" });
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate questions", detail },
      { status: 500 },
    );
  }
}
