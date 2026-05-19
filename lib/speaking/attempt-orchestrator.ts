import type { SpeakingPrompt } from "@/lib/speaking/flow";
import type { SpeakingEvaluationView } from "@/lib/speaking/evaluation-mapper";
import type { TurnView } from "@/lib/speaking/session-engine";
import { mapEvaluationFromResult } from "@/lib/speaking/evaluation-mapper";
import type { SpeakingResultResponse } from "@/lib/speaking/attempt-types";

export type ProcessTurnResult = {
  turns: TurnView[];
  evaluation: SpeakingEvaluationView | null;
  provider: string | null;
  attemptStatus: string;
  currentPrompt: SpeakingPrompt | null;
};

export async function processSpeakingTurnOnServer(params: {
  attemptId: string;
  snapshot: {
    clientTurnId: string;
    prompt: SpeakingPrompt;
    transcript: string;
    durationMs: number | null;
    audioBlob: Blob;
    silencePromptShown: boolean;
    forcedByTimer: boolean;
  };
}): Promise<ProcessTurnResult> {
  const { attemptId, snapshot } = params;

  const form = new FormData();
  form.append("audio", snapshot.audioBlob, "speaking-turn.webm");
  form.append("clientTurnId", snapshot.clientTurnId);
  form.append("durationMs", String(snapshot.durationMs || 0));
  form.append("promptPart", snapshot.prompt.part);
  form.append("promptText", snapshot.prompt.prompt);
  form.append("targetAnswerSeconds", String(snapshot.prompt.targetAnswerSeconds));
  form.append("hardLimitSeconds", String(snapshot.prompt.hardLimitSeconds));
  form.append("silencePromptShown", String(snapshot.silencePromptShown));
  form.append("forcedByTimer", String(snapshot.forcedByTimer));
  form.append("fallbackTranscript", snapshot.transcript);

  const res = await fetch(`/api/speaking/attempt/${attemptId}/orchestrate-turn`, {
    method: "POST",
    body: form,
  });

  const data = (await res.json().catch(() => null)) as
    | (SpeakingResultResponse & {
        error?: string;
      })
    | null;

  if (!res.ok || !data?.attempt) {
    throw new Error(data?.error || "Failed to orchestrate speaking turn");
  }

  return {
    turns: Array.isArray(data.turns) ? data.turns : [],
    evaluation: mapEvaluationFromResult(data.evaluation),
    provider: data.evaluation?.criterionFeedback?.provider || null,
    attemptStatus: data.attempt.status,
    currentPrompt: data.nextPrompt || null,
  };
}
