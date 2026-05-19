import type { SpeakingPrompt, SpeakingPart } from "@/lib/speaking/flow";
import type { SpeakingEvaluationView } from "@/lib/speaking/evaluation-mapper";

export type SessionPhase =
  | "idle"
  | "starting"
  | "tts"
  | "prep"
  | "recording"
  | "retrying"
  | "uploading"
  | "transcribing"
  | "pronunciation"
  | "finalizing"
  | "evaluating"
  | "complete"
  | "error";

export type TurnView = {
  id: string;
  part: SpeakingPart;
  sequence: number;
  examinerPrompt: string;
  userTranscript: string;
  transcriptSource?: string | null;
  durationMs: number | null;
  fillerWordCount: number;
  pauseCount: number;
  pauseDurationMs: number;
  speechRateWpm: number | null;
  providerStatus?: {
    stt: string | null;
    pronunciation: string | null;
  } | null;
  recording?: {
    url: string | null;
    mimeType: string | null;
    durationMs: number | null;
  } | null;
};

export type PartialTurnSnapshot = {
  clientTurnId: string;
  prompt: SpeakingPrompt;
  transcript: string;
  durationMs: number | null;
  audioBlob: Blob;
  silencePromptShown: boolean;
  forcedByTimer: boolean;
};

export type SpeakingSessionState = {
  phase: SessionPhase;
  attemptId: string | null;
  attemptStatus: string;
  currentPrompt: SpeakingPrompt | null;
  turns: TurnView[];
  evaluation: SpeakingEvaluationView | null;
  provider: string | null;
  totalQuestions: number;
  answerSecondsLeft: number | null;
  prepSecondsLeft: number | null;
  silencePromptShown: boolean;
  silenceNotice: string | null;
  pendingRetry: PartialTurnSnapshot | null;
  error: string | null;
};

export const initialSpeakingSessionState: SpeakingSessionState = {
  phase: "idle",
  attemptId: null,
  attemptStatus: "IN_PROGRESS",
  currentPrompt: null,
  turns: [],
  evaluation: null,
  provider: null,
  totalQuestions: 0,
  answerSecondsLeft: null,
  prepSecondsLeft: null,
  silencePromptShown: false,
  silenceNotice: null,
  pendingRetry: null,
  error: null,
};

const ALLOWED_TRANSITIONS: Record<SessionPhase, SessionPhase[]> = {
  idle: ["starting", "recording", "evaluating", "complete", "error"],
  starting: ["tts", "recording", "error"],
  tts: ["prep", "recording", "error"],
  prep: ["recording", "error"],
  recording: ["uploading", "error"],
  retrying: [
    "uploading",
    "transcribing",
    "pronunciation",
    "finalizing",
    "evaluating",
    "error",
  ],
  uploading: ["transcribing", "retrying", "error"],
  transcribing: ["pronunciation", "retrying", "error"],
  pronunciation: ["tts", "finalizing", "retrying", "error"],
  finalizing: ["evaluating", "retrying", "error"],
  evaluating: ["complete", "retrying", "error"],
  complete: ["idle", "starting"],
  error: ["idle", "starting", "retrying", "tts", "prep", "recording", "complete"],
};

export type SpeakingSessionAction =
  | { type: "reset" }
  | { type: "transition"; phase: SessionPhase; clearError?: boolean }
  | { type: "patch"; patch: Partial<SpeakingSessionState> }
  | { type: "set_error"; error: string };

function transitionPhase(
  state: SpeakingSessionState,
  target: SessionPhase,
  clearError: boolean,
): SpeakingSessionState {
  if (target === state.phase) {
    return clearError ? { ...state, error: null } : state;
  }
  const allowed = ALLOWED_TRANSITIONS[state.phase] || [];
  if (!allowed.includes(target)) {
    return {
      ...state,
      phase: "error",
      error: `Invalid session transition: ${state.phase} -> ${target}`,
    };
  }
  return {
    ...state,
    phase: target,
    ...(clearError ? { error: null } : {}),
  };
}

export function speakingSessionReducer(
  state: SpeakingSessionState,
  action: SpeakingSessionAction,
): SpeakingSessionState {
  switch (action.type) {
    case "reset":
      return { ...initialSpeakingSessionState };
    case "transition":
      return transitionPhase(state, action.phase, action.clearError !== false);
    case "patch":
      return { ...state, ...action.patch };
    case "set_error":
      return {
        ...state,
        phase: "error",
        error: action.error,
      };
    default:
      return state;
  }
}

export function statusTextForPhase(phase: SessionPhase): string {
  if (phase === "idle") return "Start your structured IELTS speaking mock.";
  if (phase === "starting") return "Preparing speaking attempt...";
  if (phase === "tts") return "Examiner is asking the question...";
  if (phase === "prep") return "Preparation time is running.";
  if (phase === "recording") return "Your turn - answer by speaking only.";
  if (phase === "retrying") return "Retrying last failed step...";
  if (phase === "uploading") return "Uploading your audio...";
  if (phase === "transcribing")
    return "Transcribing and pronunciation analysis in progress...";
  if (phase === "pronunciation") return "Finalizing pronunciation metrics...";
  if (phase === "finalizing") return "Finalizing your speaking attempt...";
  if (phase === "evaluating") return "Generating IELTS rubric feedback...";
  if (phase === "error") return "Something went wrong. Please retry.";
  return "Speaking test complete.";
}

export function isBusyPhase(phase: SessionPhase): boolean {
  return [
    "starting",
    "uploading",
    "transcribing",
    "pronunciation",
    "finalizing",
    "evaluating",
    "retrying",
  ].includes(phase);
}
