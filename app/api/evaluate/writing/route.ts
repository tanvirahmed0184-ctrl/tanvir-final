import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  essay?: unknown;
  taskType?: unknown;
  promptText?: unknown;
  wordCount?: unknown;
  attemptId?: unknown;
};

type WritingEvaluationJson = {
  taskAchievement: number;
  coherenceCohesion: number;
  lexicalResource: number;
  grammaticalRange: number;
  overallBand: number;
  strengths: string[];
  weaknesses: string[];
  corrections: Array<{
    original: string;
    corrected: string;
    explanation: string;
  }>;
  vocabularySuggestions: Array<{
    original: string;
    suggested: string;
    context: string;
  }>;
  sampleRewrite: string;
  examinerSummary: string;
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function clampBand(value: number): number {
  return roundToHalf(Math.max(0, Math.min(9, value)));
}

const SYSTEM_PROMPT = `You are a certified IELTS Writing Examiner.
Evaluate this submission strictly using 4 IELTS criteria.
Return ONLY valid JSON (no markdown):
{
  "taskAchievement": 6.5,
  "coherenceCohesion": 6.0,
  "lexicalResource": 6.5,
  "grammaticalRange": 6.0,
  "overallBand": 6.5,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "corrections": [{"original":"...","corrected":"...","explanation":"..."}],
  "vocabularySuggestions": [{"original":"...","suggested":"...","context":"..."}],
  "sampleRewrite": "...",
  "examinerSummary": "..."
}`;

function extractJsonObject(text: string): string {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("Gemini did not return JSON");
  }
  return text.slice(first, last + 1);
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sanitizeEvaluation(payload: unknown): WritingEvaluationJson {
  const input = (payload ?? {}) as Record<string, unknown>;

  const strengths = Array.isArray(input.strengths)
    ? input.strengths.map((x) => String(x))
    : [];
  const weaknesses = Array.isArray(input.weaknesses)
    ? input.weaknesses.map((x) => String(x))
    : [];

  const corrections = Array.isArray(input.corrections)
    ? input.corrections.map((c) => {
        const row = c as Record<string, unknown>;
        return {
          original: String(row.original ?? ""),
          corrected: String(row.corrected ?? ""),
          explanation: String(row.explanation ?? ""),
        };
      })
    : [];

  const vocabularySuggestions = Array.isArray(input.vocabularySuggestions)
    ? input.vocabularySuggestions.map((v) => {
        const row = v as Record<string, unknown>;
        return {
          original: String(row.original ?? ""),
          suggested: String(row.suggested ?? ""),
          context: String(row.context ?? ""),
        };
      })
    : [];

  return {
    taskAchievement: clampBand(toNumber(input.taskAchievement)),
    coherenceCohesion: clampBand(toNumber(input.coherenceCohesion)),
    lexicalResource: clampBand(toNumber(input.lexicalResource)),
    grammaticalRange: clampBand(toNumber(input.grammaticalRange)),
    overallBand: clampBand(toNumber(input.overallBand)),
    strengths,
    weaknesses,
    corrections,
    vocabularySuggestions,
    sampleRewrite: String(input.sampleRewrite ?? ""),
    examinerSummary: String(input.examinerSummary ?? ""),
  };
}

function buildFallbackEvaluation(
  essay: string,
  taskType: string,
  wordCount: number,
): WritingEvaluationJson {
  const minWords = taskType === "TASK_2" ? 250 : 150;
  const completionRatio =
    minWords > 0 ? Math.min(wordCount / minWords, 1.4) : 1;
  const tooShort = wordCount < minWords;

  const base =
    completionRatio >= 1
      ? 6
      : completionRatio >= 0.75
        ? 5.5
        : completionRatio >= 0.5
          ? 5
          : 4.5;

  const taskAchievement = clampBand(base - (tooShort ? 0.5 : 0));
  const coherenceCohesion = clampBand(base);
  const lexicalResource = clampBand(base);
  const grammaticalRange = clampBand(base - 0.5);
  const overallBand = clampBand(
    (taskAchievement + coherenceCohesion + lexicalResource + grammaticalRange) /
      4,
  );

  const trimmedEssay = essay.trim();
  const sampleRewrite =
    trimmedEssay.length > 0
      ? trimmedEssay
          .split(/(?<=[.!?])\s+/)
          .slice(0, 3)
          .join(" ")
      : "";

  const strengths = tooShort
    ? ["Attempt addresses part of the prompt"]
    : ["Task response has a clear main idea"];

  const weaknesses = [
    tooShort
      ? `Increase length to at least ${minWords} words for this task.`
      : "Develop supporting ideas with more specific examples.",
    "Use a wider range of sentence structures.",
  ];

  return {
    taskAchievement,
    coherenceCohesion,
    lexicalResource,
    grammaticalRange,
    overallBand,
    strengths,
    weaknesses,
    corrections: [],
    vocabularySuggestions: [],
    sampleRewrite,
    examinerSummary:
      "Temporary scoring fallback was used because AI evaluation was unavailable. Please retry for full AI feedback.",
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const essay = typeof body.essay === "string" ? body.essay.trim() : "";
    const taskType =
      typeof body.taskType === "string" ? body.taskType : "TASK_2";
    const promptText =
      typeof body.promptText === "string" ? body.promptText : "";
    const requestedWordCount = Number(body.wordCount ?? 0) || 0;
    const attemptId = typeof body.attemptId === "string" ? body.attemptId : "";
    const wordCount = Math.max(requestedWordCount, countWords(essay));

    if (!essay || !attemptId) {
      return NextResponse.json(
        { error: "essay and attemptId are required" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const attempt = await prisma.writingAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, userId: true },
    });

    if (!attempt || attempt.userId !== user.id) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    let evaluation: WritingEvaluationJson;
    try {
      const ai = getGeminiClient();

      const prompt = `${SYSTEM_PROMPT}

Task Type: ${taskType}
Prompt: ${promptText}
Word Count: ${wordCount}
Essay:
${essay}`;

      const response = (await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      })) as unknown as {
        text?: string;
        outputText?: string;
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const rawText =
        response.text ??
        response.outputText ??
        response.candidates?.[0]?.content?.parts?.[0]?.text ??
        "";

      if (!rawText) {
        throw new Error("Empty model response");
      }

      const parsed = JSON.parse(extractJsonObject(rawText)) as unknown;
      evaluation = sanitizeEvaluation(parsed);
    } catch {
      evaluation = buildFallbackEvaluation(essay, taskType, wordCount);
    }

    await prisma.$transaction(async (tx) => {
      await tx.writingAttempt.update({
        where: { id: attemptId },
        data: {
          response: essay,
          wordCount,
          status: "EVALUATED",
          submittedAt: new Date(),
        },
      });

      await tx.writingEvaluation.upsert({
        where: { attemptId },
        create: {
          attemptId,
          taskAchievement: evaluation.taskAchievement,
          coherenceCohesion: evaluation.coherenceCohesion,
          lexicalResource: evaluation.lexicalResource,
          grammaticalRange: evaluation.grammaticalRange,
          overallBand: evaluation.overallBand,
          strengths: evaluation.strengths,
          weaknesses: evaluation.weaknesses,
          corrections: evaluation.corrections,
          vocabularySuggestions: evaluation.vocabularySuggestions,
          sampleRewrite: evaluation.sampleRewrite,
          examinerSummary: evaluation.examinerSummary,
        },
        update: {
          taskAchievement: evaluation.taskAchievement,
          coherenceCohesion: evaluation.coherenceCohesion,
          lexicalResource: evaluation.lexicalResource,
          grammaticalRange: evaluation.grammaticalRange,
          overallBand: evaluation.overallBand,
          strengths: evaluation.strengths,
          weaknesses: evaluation.weaknesses,
          corrections: evaluation.corrections,
          vocabularySuggestions: evaluation.vocabularySuggestions,
          sampleRewrite: evaluation.sampleRewrite,
          examinerSummary: evaluation.examinerSummary,
          evaluatedAt: new Date(),
        },
      });
    });

    return NextResponse.json({ evaluation });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to evaluate writing", detail },
      { status: 500 },
    );
  }
}
