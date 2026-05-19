import { NextResponse } from "next/server";
import { requireSpeakingUser } from "@/lib/speaking/auth";
import { parseTurnPipelineFormData, runSpeakingTurnPipeline } from "@/lib/speaking/turn-pipeline";
import prisma from "@/lib/prisma";

type Params = { attemptId: string };

async function buildAttemptResponse(attemptId: string, userId: string) {
  const result = await prisma.speakingAttempt.findFirst({
    where: { id: attemptId, userId },
    include: {
      turns: {
        orderBy: { sequence: "asc" },
        include: { recording: true },
      },
      evaluation: true,
    },
  });

  if (!result) return null;

  const turns = result.turns.map((turn) => {
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
        turn.metadata && typeof turn.metadata === "object" ? turn.metadata : null,
    };
  });

  const evaluation = result.evaluation
    ? {
        fluencyCoherence: result.evaluation.fluencyCoherence,
        lexicalResource: result.evaluation.lexicalResource,
        grammaticalRangeAccuracy: result.evaluation.grammaticalRangeAccuracy,
        pronunciation: result.evaluation.pronunciation,
        overallBand: result.evaluation.overallBand,
        criterionFeedback: result.evaluation.criterionFeedback,
        actionableTips: result.evaluation.actionableTips,
        grammarCorrections: result.evaluation.grammarCorrections,
        vocabularyUpgrades: result.evaluation.vocabularyUpgrades,
        strengths: result.evaluation.strengths,
        weaknesses: result.evaluation.weaknesses,
        pronunciationSummary: result.evaluation.pronunciationSummary,
        examinerSummary: result.evaluation.examinerSummary,
      }
    : null;

  return {
    attempt: {
      id: result.id,
      status: result.status,
      mode: result.mode,
      startedAt: result.startedAt.toISOString(),
      submittedAt: result.submittedAt?.toISOString() || null,
      completedAt: result.completedAt?.toISOString() || null,
      currentPart: result.currentPart,
      totalQuestionsAsked: result.totalQuestionsAsked,
      transcriptFull: result.transcriptFull,
    },
    turns,
    evaluation,
  };
}

export async function POST(
  request: Request,
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

    const form = await request.formData();
    const parsed = parseTurnPipelineFormData(form);

    const pipeline = await runSpeakingTurnPipeline({
      attemptId,
      userId: auth.userId,
      ...parsed,
    });

    if (pipeline.attempt.status === "SUBMITTED") {
      const finalizeRes = await fetch(
        new URL(`/api/speaking/attempt/${attemptId}/finalize`, request.url),
        {
          method: "POST",
          headers: {
            cookie: request.headers.get("cookie") || "",
          },
        },
      );
      if (!finalizeRes.ok) {
        const body = (await finalizeRes.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || "Failed to finalize speaking attempt");
      }

      const evalRes = await fetch(
        new URL(`/api/speaking/attempt/${attemptId}/evaluate`, request.url),
        {
          method: "POST",
          headers: {
            cookie: request.headers.get("cookie") || "",
          },
        },
      );
      const evalData = (await evalRes.json().catch(() => null)) as
        | {
            error?: string;
            provider?: string;
            evaluation?: unknown;
            pronunciationSummary?: unknown;
          }
        | null;
      if (!evalRes.ok || !evalData?.evaluation) {
        throw new Error(evalData?.error || "Failed to evaluate speaking attempt");
      }
    }

    const payload = await buildAttemptResponse(attemptId, auth.userId);
    if (!payload) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...payload,
      nextPrompt:
        payload.attempt.status === "IN_PROGRESS" ? pipeline.nextPrompt : null,
      idempotentReplay: pipeline.replayed,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to orchestrate speaking turn", detail },
      { status: 500 },
    );
  }
}
