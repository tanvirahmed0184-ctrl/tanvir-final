import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSpeakingPrompt, getSpeakingQuestionCount } from "@/lib/speaking/flow";
import { requireSpeakingUser } from "@/lib/speaking/auth";
import { loadSpeakingPromptsForAttempt } from "@/lib/speaking/prompt-runtime";

type Body = {
  mode?: unknown;
};

function parseMode(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "simulation";
}

export async function POST(request: Request) {
  try {
    const auth = await requireSpeakingUser();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const mode = parseMode(body.mode);

    if (mode === "resume_probe") {
      const activeAttempt = await prisma.speakingAttempt.findFirst({
        where: {
          userId: auth.userId,
          status: {
            in: ["IN_PROGRESS"],
          },
        },
        orderBy: { startedAt: "desc" },
        select: { id: true, mode: true },
      });
      if (!activeAttempt) {
        return NextResponse.json({ attemptId: null });
      }
      return NextResponse.json({
        attemptId: activeAttempt.id,
        mode: activeAttempt.mode,
      });
    }

    const runtime = await loadSpeakingPromptsForAttempt(mode);
    const firstPrompt = getSpeakingPrompt(0);
    if (!firstPrompt) {
      return NextResponse.json(
        { error: "Speaking prompt configuration missing" },
        { status: 500 },
      );
    }

    const totalQuestions = getSpeakingQuestionCount();
    const attempt = await prisma.speakingAttempt.create({
      data: {
        userId: auth.userId,
        mode,
        status: "IN_PROGRESS",
        currentPart: firstPrompt.part,
        currentQuestionIndex: 0,
        totalQuestionsAsked: 1,
        latestExaminerPrompt: firstPrompt.prompt,
        metadata: {
          totalPlannedQuestions: totalQuestions,
          speakingPromptTestId: runtime.testId,
          speakingPromptSetId: runtime.activeSetId,
        },
      },
      select: {
        id: true,
        startedAt: true,
        mode: true,
        status: true,
      },
    });

    return NextResponse.json({
      attemptId: attempt.id,
      status: attempt.status,
      mode: attempt.mode,
      startedAt: attempt.startedAt.toISOString(),
      prompt: firstPrompt,
      totalQuestions,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to start speaking attempt", detail },
      { status: 500 },
    );
  }
}
