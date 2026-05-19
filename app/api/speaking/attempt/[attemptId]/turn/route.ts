import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSpeakingUser } from "@/lib/speaking/auth";
import { getSpeakingPrompt, nextPrompt } from "@/lib/speaking/flow";
import { loadSpeakingPromptsForAttempt } from "@/lib/speaking/prompt-runtime";
import { analyzeTranscript } from "@/lib/speaking/metrics";
import { toInputJsonValue } from "@/lib/speaking/json";

type Body = {
  transcript?: unknown;
  durationMs?: unknown;
  silencePromptShown?: unknown;
  metadata?: unknown;
};

function parseTranscript(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length <= 6000) return text;
  return text.slice(0, 6000).trim();
}

function parseDurationMs(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.min(180_000, Math.round(n)));
}

function parseSilencePromptShown(value: unknown): boolean {
  return value === true;
}

function parseMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const auth = await requireSpeakingUser();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { attemptId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Body;
    const transcript = parseTranscript(body.transcript);
    const durationMs = parseDurationMs(body.durationMs);
    const silencePromptShown = parseSilencePromptShown(body.silencePromptShown);
    const extraMetadata = parseMetadata(body.metadata);

    if (!attemptId) {
      return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
    }

    const attempt = await prisma.speakingAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        userId: true,
        mode: true,
        status: true,
        currentQuestionIndex: true,
        transcriptFull: true,
      },
    });

    if (!attempt || attempt.userId !== auth.userId) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Attempt is not active anymore" },
        { status: 400 },
      );
    }

    await loadSpeakingPromptsForAttempt(attempt.mode);

    const currentPrompt = getSpeakingPrompt(attempt.currentQuestionIndex);
    if (!currentPrompt) {
      return NextResponse.json(
        { error: "No prompt found for current speaking state" },
        { status: 400 },
      );
    }

    const metrics = analyzeTranscript(transcript, durationMs);
    const sequence = attempt.currentQuestionIndex + 1;
    const endedAt = new Date();
    const startedAt =
      durationMs && durationMs > 0
        ? new Date(Math.max(0, endedAt.getTime() - durationMs))
        : endedAt;

    const combinedTranscript = [attempt.transcriptFull, metrics.cleanedTranscript]
      .filter(Boolean)
      .join("\n")
      .trim();

    const upcoming = nextPrompt(attempt.currentQuestionIndex);
    const nextIndex = upcoming
      ? upcoming.index
      : attempt.currentQuestionIndex + 1;
    const nextPart = upcoming ? upcoming.part : currentPrompt.part;
    const nextStatus = upcoming ? "IN_PROGRESS" : "SUBMITTED";
    const turnMetaJson = extraMetadata
      ? toInputJsonValue(extraMetadata)
      : undefined;

    const turn = await prisma.$transaction(async (tx) => {
      const created = await tx.speakingTurn.create({
        data: {
          attemptId: attempt.id,
          part: currentPrompt.part,
          role: "CANDIDATE",
          sequence,
          examinerPrompt: currentPrompt.prompt,
          userTranscript: metrics.cleanedTranscript,
          transcriptSource: "browser",
          fillerWordCount: metrics.fillerWordCount,
          pauseCount: metrics.pauseCount,
          pauseDurationMs: metrics.pauseDurationMs,
          speechRateWpm: metrics.speechRateWpm,
          durationMs,
          startedAt,
          endedAt,
          silencePromptShown,
          metadata: turnMetaJson,
        },
        select: {
          id: true,
          attemptId: true,
          sequence: true,
          part: true,
          userTranscript: true,
          durationMs: true,
          fillerWordCount: true,
          pauseCount: true,
          pauseDurationMs: true,
          speechRateWpm: true,
        },
      });

      await tx.speakingAttempt.update({
        where: { id: attempt.id },
        data: {
          status: nextStatus,
          submittedAt: nextStatus === "SUBMITTED" ? endedAt : undefined,
          currentQuestionIndex: nextIndex,
          currentPart: nextPart,
          totalQuestionsAsked: upcoming ? sequence + 1 : sequence,
          latestExaminerPrompt: upcoming ? upcoming.prompt : null,
          transcriptFull: combinedTranscript,
        },
      });

      return created;
    });

    return NextResponse.json({
      turn,
      nextPrompt: upcoming,
      attemptStatus: nextStatus,
      isComplete: !upcoming,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to persist speaking turn", detail },
      { status: 500 },
    );
  }
}
