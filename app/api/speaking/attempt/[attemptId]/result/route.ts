import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSpeakingUser } from "@/lib/speaking/auth";
import { getSpeakingPrompt } from "@/lib/speaking/flow";
import { loadSpeakingPromptsForAttempt } from "@/lib/speaking/prompt-runtime";

type Params = { attemptId: string };

export async function GET(
  _request: Request,
  context: { params: Promise<Params> },
) {
  try {
    const auth = await requireSpeakingUser();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { attemptId } = await context.params;
    if (!attemptId) {
      return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
    }

    const attempt = await prisma.speakingAttempt.findFirst({
      where: { id: attemptId, userId: auth.userId },
      include: {
        turns: {
          orderBy: { sequence: "asc" },
          include: { recording: true },
        },
        evaluation: true,
      },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    await loadSpeakingPromptsForAttempt(attempt.mode);

    const turns = attempt.turns.map((turn) => {
      const metadata =
        turn.metadata && typeof turn.metadata === "object"
          ? (turn.metadata as Record<string, unknown>)
          : null;
      const pronunciationMeta =
        metadata?.pronunciation && typeof metadata.pronunciation === "object"
          ? (metadata.pronunciation as Record<string, unknown>)
          : null;
      const pronunciationProvider =
        typeof pronunciationMeta?.provider === "string"
          ? pronunciationMeta.provider
          : null;
      return {
        id: turn.id,
        part: turn.part,
        sequence: turn.sequence,
        examinerPrompt: turn.examinerPrompt,
        userTranscript: turn.userTranscript,
        transcriptSource: turn.transcriptSource || null,
        providerStatus: {
          stt: turn.transcriptSource || null,
          pronunciation: pronunciationProvider,
        },
        durationMs: turn.durationMs,
        fillerWordCount: turn.fillerWordCount,
        pauseCount: turn.pauseCount,
        pauseDurationMs: turn.pauseDurationMs,
        speechRateWpm: turn.speechRateWpm,
        recording: turn.recording
          ? {
              url: turn.recording.publicUrl,
              mimeType: turn.recording.mimeType,
              durationMs: turn.recording.durationMs,
            }
          : null,
        metadata:
          turn.metadata && typeof turn.metadata === "object"
            ? turn.metadata
            : null,
      };
    });

    const evaluation = attempt.evaluation
      ? {
          fluencyCoherence: attempt.evaluation.fluencyCoherence,
          lexicalResource: attempt.evaluation.lexicalResource,
          grammaticalRangeAccuracy: attempt.evaluation.grammaticalRangeAccuracy,
          pronunciation: attempt.evaluation.pronunciation,
          overallBand: attempt.evaluation.overallBand,
          criterionFeedback: attempt.evaluation.criterionFeedback,
          actionableTips: attempt.evaluation.actionableTips,
          grammarCorrections: attempt.evaluation.grammarCorrections,
          vocabularyUpgrades: attempt.evaluation.vocabularyUpgrades,
          strengths: attempt.evaluation.strengths,
          weaknesses: attempt.evaluation.weaknesses,
          pronunciationSummary: attempt.evaluation.pronunciationSummary,
          examinerSummary: attempt.evaluation.examinerSummary,
          evaluatedAt: attempt.evaluation.evaluatedAt.toISOString(),
        }
      : null;

    const nextPrompt =
      attempt.status !== "IN_PROGRESS"
        ? null
        : getSpeakingPrompt(attempt.currentQuestionIndex);

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        status: attempt.status,
        mode: attempt.mode,
        startedAt: attempt.startedAt.toISOString(),
        submittedAt: attempt.submittedAt?.toISOString() || null,
        completedAt: attempt.completedAt?.toISOString() || null,
        currentPart: attempt.currentPart,
        totalQuestionsAsked: attempt.totalQuestionsAsked,
        transcriptFull: attempt.transcriptFull,
      },
      nextPrompt,
      turns,
      evaluation,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load speaking result", detail },
      { status: 500 },
    );
  }
}
