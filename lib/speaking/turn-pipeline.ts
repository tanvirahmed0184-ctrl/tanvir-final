import prisma from "@/lib/prisma";
import { analyzeTranscript } from "@/lib/speaking/metrics";
import { getSpeakingPrompt, nextPrompt } from "@/lib/speaking/flow";
import { loadSpeakingPromptsForAttempt } from "@/lib/speaking/prompt-runtime";
import { storeSpeakingAudio } from "@/lib/speaking/storage";
import { transcribeAudioWithWhisper } from "@/lib/speaking/whisper";
import { assessPronunciationWithAzure } from "@/lib/speaking/pronunciation";
import { toInputJsonValue } from "@/lib/speaking/json";

function parseBooleanText(value: string | null | undefined): boolean {
  return value === "true";
}

function parseIntText(value: string | null | undefined): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.min(180_000, Math.round(n)));
}

function parseTranscript(value: string | null | undefined): string {
  const text = String(value || "").trim();
  if (text.length <= 6000) return text;
  return text.slice(0, 6000).trim();
}

function parseClientTurnId(value: string | null | undefined): string {
  const id = String(value || "").trim();
  if (id.length < 8 || id.length > 120) return "";
  return id;
}

function msSince(start: number): number {
  return Math.max(0, Date.now() - start);
}

function extractClientTurnIdFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const row = metadata as Record<string, unknown>;
  const value = row.clientTurnId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function runSpeakingTurnPipeline(params: {
  attemptId: string;
  userId: string;
  clientTurnId: string;
  audio: File;
  clientPromptText: string;
  clientPromptPart: "PART_1" | "PART_2_PREP" | "PART_2" | "PART_3" | null;
  fallbackTranscript: string;
  durationMs: number | null;
  targetAnswerSeconds: number | null;
  hardLimitSeconds: number | null;
  silencePromptShown: boolean;
  forcedByTimer: boolean;
}) {
  const {
    attemptId,
    userId,
    clientTurnId,
    audio,
    clientPromptText,
    clientPromptPart,
    fallbackTranscript,
    durationMs,
    targetAnswerSeconds,
    hardLimitSeconds,
    silencePromptShown,
    forcedByTimer,
  } = params;

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
  if (!attempt || attempt.userId !== userId) {
    throw new Error("Attempt not found");
  }
  if (attempt.status !== "IN_PROGRESS") {
    throw new Error("Attempt is not active anymore");
  }

  await loadSpeakingPromptsForAttempt(attempt.mode);

  const currentPrompt = getSpeakingPrompt(attempt.currentQuestionIndex);
  if (!currentPrompt) {
    throw new Error("No prompt found for current speaking state");
  }

  const latestTurn = await prisma.speakingTurn.findFirst({
    where: { attemptId: attempt.id },
    orderBy: { sequence: "desc" },
    select: {
      id: true,
      metadata: true,
    },
  });
  const existingClientTurnId = extractClientTurnIdFromMetadata(
    latestTurn?.metadata,
  );
  if (latestTurn && existingClientTurnId && existingClientTurnId === clientTurnId) {
    const replayAttempt = await prisma.speakingAttempt.findUnique({
      where: { id: attempt.id },
      select: {
        id: true,
        status: true,
        mode: true,
        startedAt: true,
        submittedAt: true,
        completedAt: true,
        currentPart: true,
        currentQuestionIndex: true,
        totalQuestionsAsked: true,
        transcriptFull: true,
      },
    });

    const replayTurn = await prisma.speakingTurn.findFirst({
      where: { id: latestTurn.id },
      select: {
        id: true,
        part: true,
        sequence: true,
        examinerPrompt: true,
        userTranscript: true,
        durationMs: true,
        fillerWordCount: true,
        pauseCount: true,
        pauseDurationMs: true,
        speechRateWpm: true,
      },
    });

    if (replayAttempt && replayTurn) {
      const upcomingPrompt =
        replayAttempt.status === "IN_PROGRESS"
          ? getSpeakingPrompt(replayAttempt.currentQuestionIndex)
          : null;
      return {
        turn: replayTurn,
        attempt: replayAttempt,
        nextPrompt: upcomingPrompt,
        replayed: true,
      };
    }
  }

  const promptMismatch =
    (clientPromptPart !== null && clientPromptPart !== currentPrompt.part) ||
    (clientPromptText.trim().length > 0 &&
      clientPromptText.trim() !== currentPrompt.prompt);

  const safeTranscript = parseTranscript(fallbackTranscript);
  const initialMetrics = analyzeTranscript(safeTranscript, durationMs);
  const sequence = attempt.currentQuestionIndex + 1;
  const endedAt = new Date();
  const startedAt =
    durationMs && durationMs > 0
      ? new Date(Math.max(0, endedAt.getTime() - durationMs))
      : endedAt;

  const turn = await prisma.speakingTurn.create({
    data: {
      attemptId: attempt.id,
      part: currentPrompt.part,
      role: "CANDIDATE",
      sequence,
      examinerPrompt: currentPrompt.prompt,
      userTranscript: initialMetrics.cleanedTranscript,
      transcriptSource: "browser",
      fillerWordCount: initialMetrics.fillerWordCount,
      pauseCount: initialMetrics.pauseCount,
      pauseDurationMs: initialMetrics.pauseDurationMs,
      speechRateWpm: initialMetrics.speechRateWpm,
      durationMs,
      startedAt,
      endedAt,
      silencePromptShown,
      metadata: toInputJsonValue({
        clientTurnId,
        forcedByTimer,
        targetAnswerSeconds,
        hardLimitSeconds,
        promptMismatch,
        clientPrompt: {
          part: clientPromptPart,
          text: clientPromptText.trim(),
        },
      }),
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
      metadata: true,
    },
  });

  const bytes = Buffer.from(await audio.arrayBuffer());
  const mimeType = audio.type || "audio/webm";
  const stored = await storeSpeakingAudio({
    attemptId: attempt.id,
    turnId: turn.id,
    bytes,
    mimeType,
  });

  await prisma.speakingRecording.upsert({
    where: { turnId: turn.id },
    create: {
      turnId: turn.id,
      storagePath: stored.storagePath,
      publicUrl: stored.publicUrl,
      mimeType,
      durationMs,
      sizeBytes: bytes.length,
    },
    update: {
      storagePath: stored.storagePath,
      publicUrl: stored.publicUrl,
      mimeType,
      durationMs,
      sizeBytes: bytes.length,
    },
  });

  const audioFile = new File([new Uint8Array(bytes)], "speaking-turn.webm", {
    type: mimeType,
  });

  const whisperStartedAt = Date.now();
  const whisperPromise = transcribeAudioWithWhisper({
    audioBuffer: bytes,
    mimeType,
    fallbackTranscript: safeTranscript,
    durationMs,
  }).then((result) => {
    console.info(
      `[Speaking][Whisper] turn=${turn.id} provider=${result.provider} durationMs=${msSince(
        whisperStartedAt,
      )}`,
    );
    return result;
  });

  const pronunciationStartedAt = Date.now();
  const pronunciationPromise = assessPronunciationWithAzure({
    audio: audioFile,
    transcript: safeTranscript,
  }).then((result) => {
    console.info(
      `[Speaking][Azure] turn=${turn.id} provider=${result.provider} durationMs=${msSince(
        pronunciationStartedAt,
      )}`,
    );
    return result;
  });

  const [transcribed, pronunciation] = await Promise.all([
    whisperPromise,
    pronunciationPromise,
  ]);

  const mergedMeta =
    turn.metadata && typeof turn.metadata === "object"
      ? (turn.metadata as Record<string, unknown>)
      : {};

  const finalizedTurn = await prisma.speakingTurn.update({
    where: { id: turn.id },
    data: {
      userTranscript: transcribed.cleanedTranscript,
      transcriptSource: transcribed.provider,
      fillerWordCount: transcribed.fillerWordCount,
      pauseCount: transcribed.pauseCount,
      pauseDurationMs: transcribed.pauseDurationMs,
      speechRateWpm: transcribed.speechRateWpm,
      metadata: toInputJsonValue({
        ...mergedMeta,
        whisper: {
          provider: transcribed.provider,
          segments: transcribed.segments,
          raw: transcribed.raw,
        },
        pronunciation: {
          provider: pronunciation.provider,
          metrics: pronunciation.metrics,
          raw: pronunciation.raw,
        },
      }),
    },
    select: {
      id: true,
      part: true,
      sequence: true,
      examinerPrompt: true,
      userTranscript: true,
      durationMs: true,
      fillerWordCount: true,
      pauseCount: true,
      pauseDurationMs: true,
      speechRateWpm: true,
    },
  });

  const upcoming = nextPrompt(attempt.currentQuestionIndex);
  const nextIndex = upcoming ? upcoming.index : attempt.currentQuestionIndex + 1;
  const nextPart = upcoming ? upcoming.part : currentPrompt.part;
  const nextStatus = upcoming ? "IN_PROGRESS" : "SUBMITTED";

  const combinedTranscript = [attempt.transcriptFull, transcribed.cleanedTranscript]
    .filter(Boolean)
    .join("\n")
    .trim();

  const updatedAttempt = await prisma.speakingAttempt.update({
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
    select: {
      id: true,
      status: true,
      mode: true,
      startedAt: true,
      submittedAt: true,
      completedAt: true,
      currentPart: true,
      currentQuestionIndex: true,
      totalQuestionsAsked: true,
      transcriptFull: true,
    },
  });

  return {
    turn: finalizedTurn,
    attempt: updatedAttempt,
    nextPrompt: upcoming,
    replayed: false,
  };
}

export function parseTurnPipelineFormData(form: FormData) {
  const clientTurnId = parseClientTurnId(String(form.get("clientTurnId") || ""));
  if (!clientTurnId) {
    throw new Error("clientTurnId is required");
  }

  const audio = form.get("audio");
  if (!(audio instanceof File)) {
    throw new Error("audio file is required");
  }
  if (audio.size <= 0) {
    throw new Error("Audio file is empty");
  }
  if (audio.size > 20 * 1024 * 1024) {
    throw new Error("Audio file exceeds 20MB limit");
  }

  const promptPartRaw = String(form.get("promptPart") || "").trim();
  const promptPart = ["PART_1", "PART_2_PREP", "PART_2", "PART_3"].includes(
    promptPartRaw,
  )
    ? (promptPartRaw as "PART_1" | "PART_2_PREP" | "PART_2" | "PART_3")
    : null;
  const promptText = String(form.get("promptText") || "").trim();

  return {
    clientTurnId,
    audio,
    clientPromptPart: promptPart,
    clientPromptText: promptText,
    fallbackTranscript: parseTranscript(String(form.get("fallbackTranscript") || "")),
    durationMs: parseIntText(String(form.get("durationMs") || "")),
    targetAnswerSeconds: parseIntText(String(form.get("targetAnswerSeconds") || "")),
    hardLimitSeconds: parseIntText(String(form.get("hardLimitSeconds") || "")),
    silencePromptShown: parseBooleanText(String(form.get("silencePromptShown") || "")),
    forcedByTimer: parseBooleanText(String(form.get("forcedByTimer") || "")),
  };
}
