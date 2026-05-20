"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Loader2, Mic, MicOff, RefreshCcw, Volume2 } from "lucide-react";
import WaveVisualizer from "@/components/speaking/WaveVisualizer";
import useSpeechRecorder from "@/hooks/useSpeechRecorder";
import useSpeechSynthesis from "@/hooks/useSpeechSynthesis";
import type { SpeakingPart, SpeakingPrompt } from "@/lib/speaking/flow";
import { partLabel } from "@/lib/speaking/flow";
import type { SpeakingResultResponse } from "@/lib/speaking/attempt-types";
import { processSpeakingTurnOnServer } from "@/lib/speaking/attempt-orchestrator";
import { mapEvaluationFromResult } from "@/lib/speaking/evaluation-mapper";
import {
  initialSpeakingSessionState,
  isBusyPhase,
  speakingSessionReducer,
  statusTextForPhase,
  type PartialTurnSnapshot,
  type SessionPhase,
  type TurnView,
} from "@/lib/speaking/session-engine";

const VALID_PARTS = new Set(["PART_1", "PART_2_PREP", "PART_2", "PART_3"]);
const MIN_AUDIO_BYTES = 2_500;

type SpeakingSetOption = {
  id: string;
  name: string;
  promptCount: number;
};

function generateClientTurnId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Ignore browser crypto access failures.
  }
  return `turn-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function asSpeakingPart(value: unknown): SpeakingPart {
  if (typeof value === "string" && VALID_PARTS.has(value)) {
    return value as SpeakingPart;
  }
  return "PART_1";
}

function mapTurnsFromResponse(value: unknown): TurnView[] {
  if (!Array.isArray(value)) return [];
  return value.map((turn, index) => {
    const row = (turn || {}) as Record<string, unknown>;
    const providerStatus =
      row.providerStatus && typeof row.providerStatus === "object"
        ? (row.providerStatus as Record<string, unknown>)
        : null;
    return {
      id: String(row.id || `turn-${index + 1}`),
      part: asSpeakingPart(row.part),
      sequence: Number(row.sequence || index + 1),
      examinerPrompt: String(row.examinerPrompt || ""),
      userTranscript: String(row.userTranscript || ""),
      transcriptSource:
        typeof row.transcriptSource === "string" ? row.transcriptSource : null,
      providerStatus: {
        stt:
          typeof providerStatus?.stt === "string" ? providerStatus.stt : null,
        pronunciation:
          typeof providerStatus?.pronunciation === "string"
            ? providerStatus.pronunciation
            : null,
      },
      durationMs:
        typeof row.durationMs === "number" ? row.durationMs : Number(row.durationMs || 0) || null,
      fillerWordCount: Number(row.fillerWordCount || 0),
      pauseCount: Number(row.pauseCount || 0),
      pauseDurationMs: Number(row.pauseDurationMs || 0),
      speechRateWpm:
        typeof row.speechRateWpm === "number" ? row.speechRateWpm : null,
      recording:
        row.recording && typeof row.recording === "object"
          ? {
              url:
                typeof (row.recording as Record<string, unknown>).url === "string"
                  ? ((row.recording as Record<string, unknown>).url as string)
                  : null,
              mimeType:
                typeof (row.recording as Record<string, unknown>).mimeType === "string"
                  ? ((row.recording as Record<string, unknown>).mimeType as string)
                  : null,
              durationMs:
                typeof (row.recording as Record<string, unknown>).durationMs === "number"
                  ? ((row.recording as Record<string, unknown>).durationMs as number)
                  : null,
            }
          : null,
    };
  });
}

function isPrompt(value: unknown): value is SpeakingPrompt {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.index === "number" &&
    typeof row.prompt === "string" &&
    typeof row.prepSeconds === "number" &&
    typeof row.targetAnswerSeconds === "number" &&
    typeof row.hardLimitSeconds === "number" &&
    typeof row.silencePromptSeconds === "number" &&
    typeof row.part === "string" &&
    VALID_PARTS.has(row.part)
  );
}

export default function AIInterviewer() {
  const [state, dispatch] = useReducer(
    speakingSessionReducer,
    initialSpeakingSessionState,
  );
  const [availableModes, setAvailableModes] = useState<
    Array<{ modeValue: string; label: string }>
  >([]);
  const [selectedMode, setSelectedMode] = useState<string>("simulation");
  const [loadingModes, setLoadingModes] = useState(false);

  const {
    isRecording,
    transcript,
    micLevel,
    inputDeviceLabel,
    startRecording,
    stopAndTranscribe,
    abortRecording,
    error: recorderError,
  } = useSpeechRecorder();
  const { isSpeaking, speakText, stopSpeaking } = useSpeechSynthesis();

  const stateRef = useRef(state);
  const phaseRef = useRef(state.phase);
  const finishingTurnRef = useRef(false);
  const startedRecordingAtRef = useRef<number | null>(null);
  const currentClientTurnIdRef = useRef<string | null>(null);
  const answerSecondsRef = useRef<number | null>(null);
  const prepSecondsRef = useRef<number | null>(null);

  const silenceTimerRef = useRef<number | null>(null);
  const answerTimerRef = useRef<number | null>(null);
  const prepTimerRef = useRef<number | null>(null);

  const finishTurnRef = useRef<(forcedByTimer?: boolean) => Promise<void>>(
    async () => undefined,
  );

  const statusText = statusTextForPhase(state.phase);
  const canUseMic = state.phase === "recording" || isRecording;

  const loadSpeakingModes = useCallback(async () => {
    setLoadingModes(true);
    try {
      const testsRes = await fetch("/api/tests?module=SPEAKING&fresh=1", {
        cache: "no-store",
      });
      const testsData = (await testsRes.json().catch(() => null)) as
        | {
            tests?: Array<{
              id: string;
              title: string;
              speakingPromptSets?: Array<{
                id: string;
                name: string;
                promptCount: number;
              }>;
              activeSpeakingSetId?: string | null;
            }>;
          }
        | null;
      if (!testsRes.ok) {
        setAvailableModes([{ modeValue: "simulation", label: "Default" }]);
        setSelectedMode("simulation");
        return;
      }

      const tests = Array.isArray(testsData?.tests) ? testsData.tests : [];
      const options: Array<{ modeValue: string; label: string }> = [];

      for (const test of tests) {
        const normalizedSets: SpeakingSetOption[] = Array.isArray(test.speakingPromptSets)
          ? test.speakingPromptSets
              .map((set) => ({
                id: String(set.id || "").trim(),
                name: String(set.name || "").trim(),
                promptCount: Number(set.promptCount || 0),
              }))
              .filter((set) => set.id && set.name && set.promptCount > 0)
          : [];

        if (normalizedSets.length === 0) {
          options.push({
            modeValue: `test:${test.id}`,
            label: `${test.title} - Default`,
          });
          continue;
        }

        for (const set of normalizedSets) {
          options.push({
            modeValue: `test:${test.id}:set:${set.id}`,
            label: `${test.title} - ${set.name} (${set.promptCount} prompts)`,
          });
        }
      }

      if (options.length === 0) {
        options.push({ modeValue: "simulation", label: "Default" });
      }

      setAvailableModes(options);
      setSelectedMode((prev) => {
        if (options.some((option) => option.modeValue === prev)) return prev;
        return options[0].modeValue;
      });
    } catch {
      setAvailableModes([{ modeValue: "simulation", label: "Default" }]);
      setSelectedMode("simulation");
    } finally {
      setLoadingModes(false);
    }
  }, []);

  useEffect(() => {
    stateRef.current = state;
    phaseRef.current = state.phase;
  }, [state]);

  useEffect(() => {
    if (recorderError) {
      dispatch({ type: "set_error", error: recorderError });
    }
  }, [recorderError]);

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (answerTimerRef.current) {
      window.clearInterval(answerTimerRef.current);
      answerTimerRef.current = null;
    }
    if (prepTimerRef.current) {
      window.clearInterval(prepTimerRef.current);
      prepTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      stopSpeaking();
      void abortRecording();
    };
  }, [abortRecording, clearTimers, stopSpeaking]);

  const scheduleSilenceNotice = useCallback(
    (prompt: SpeakingPrompt) => {
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
      }
      dispatch({
        type: "patch",
        patch: {
          silencePromptShown: false,
          silenceNotice: null,
        },
      });
      silenceTimerRef.current = window.setTimeout(() => {
        dispatch({
          type: "patch",
          patch: {
            silencePromptShown: true,
            silenceNotice: "Need more time? Continue if you can.",
          },
        });
      }, prompt.silencePromptSeconds * 1000);
    },
    [dispatch],
  );

  const beginRecordingForPrompt = useCallback(
    async (prompt: SpeakingPrompt) => {
      if (phaseRef.current === "error") return;
      clearTimers();
      dispatch({ type: "transition", phase: "recording" });
      dispatch({
        type: "patch",
        patch: {
          error: null,
          prepSecondsLeft: null,
          silencePromptShown: false,
          silenceNotice: null,
        },
      });
      scheduleSilenceNotice(prompt);

      const hardLimit = Math.max(1, prompt.hardLimitSeconds);
      answerSecondsRef.current = hardLimit;
      dispatch({ type: "patch", patch: { answerSecondsLeft: hardLimit } });

      answerTimerRef.current = window.setInterval(() => {
        const current = answerSecondsRef.current;
        if (current === null) return;
        const next = Math.max(0, current - 1);
        answerSecondsRef.current = next;
        dispatch({ type: "patch", patch: { answerSecondsLeft: next } });
        if (next <= 0) {
          window.clearInterval(answerTimerRef.current || undefined);
          answerTimerRef.current = null;
          void finishTurnRef.current(true);
        }
      }, 1000);

      try {
        currentClientTurnIdRef.current = generateClientTurnId();
        await startRecording();
        startedRecordingAtRef.current = Date.now();
        finishingTurnRef.current = false;
      } catch (error) {
        currentClientTurnIdRef.current = null;
        dispatch({
          type: "set_error",
          error:
            error instanceof Error ? error.message : "Unable to access microphone",
        });
      }
    },
    [clearTimers, scheduleSilenceNotice, startRecording],
  );

  const speakPrompt = useCallback(
    (prompt: SpeakingPrompt) => {
      if (phaseRef.current === "error") return;
      clearTimers();
      dispatch({ type: "transition", phase: "tts" });
      speakText(prompt.prompt, {
        rate: 0.98,
        onEnd: () => {
          if (phaseRef.current === "error") return;
          if (prompt.prepSeconds > 0) {
            dispatch({ type: "transition", phase: "prep" });
            prepSecondsRef.current = prompt.prepSeconds;
            dispatch({
              type: "patch",
              patch: {
                prepSecondsLeft: prompt.prepSeconds,
                answerSecondsLeft: null,
              },
            });

            prepTimerRef.current = window.setInterval(() => {
              if (phaseRef.current === "error") {
                window.clearInterval(prepTimerRef.current || undefined);
                prepTimerRef.current = null;
                return;
              }
              const current = prepSecondsRef.current;
              if (current === null) return;
              const next = Math.max(0, current - 1);
              prepSecondsRef.current = next;
              dispatch({ type: "patch", patch: { prepSecondsLeft: next } });
              if (next <= 0) {
                window.clearInterval(prepTimerRef.current || undefined);
                prepTimerRef.current = null;
                void beginRecordingForPrompt(prompt);
              }
            }, 1000);
            return;
          }
          void beginRecordingForPrompt(prompt);
        },
      });
    },
    [beginRecordingForPrompt, clearTimers, speakText],
  );

  const hydrateFromResult = useCallback(
    (data: SpeakingResultResponse) => {
      if (!data.attempt) return;
      const turns = mapTurnsFromResponse(data.turns);
      const evaluation = mapEvaluationFromResult(data.evaluation);
      const provider = data.evaluation?.criterionFeedback?.provider || null;

      dispatch({
        type: "patch",
        patch: {
          attemptId: data.attempt.id,
          attemptStatus: data.attempt.status,
          turns,
          evaluation,
          provider,
          totalQuestions: Math.max(
            data.attempt.totalQuestionsAsked || 0,
            turns.length,
          ),
          currentPrompt:
            data.nextPrompt && isPrompt(data.nextPrompt) ? data.nextPrompt : null,
        },
      });

      if (evaluation || data.attempt.status === "EVALUATED") {
        dispatch({ type: "transition", phase: "complete" });
        return;
      }

      if (data.nextPrompt && isPrompt(data.nextPrompt)) {
        dispatch({
          type: "patch",
          patch: {
            silenceNotice: "Resumed attempt. Tap to speak to continue.",
            totalQuestions: Math.max(
              data.attempt.totalQuestionsAsked || 0,
              data.nextPrompt.index + 1,
            ),
          },
        });
        dispatch({ type: "transition", phase: "recording" });
        return;
      }

      dispatch({
        type: "set_error",
        error: "Attempt resumed but next prompt could not be loaded",
      });
    },
    [dispatch],
  );

  useEffect(() => {
    void loadSpeakingModes();
  }, [loadSpeakingModes]);

  useEffect(() => {
    let active = true;

    const restoreAttempt = async (targetAttemptId: string) => {
      const res = await fetch(`/api/speaking/attempt/${targetAttemptId}/result`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as SpeakingResultResponse | null;
      if (!active || !res.ok || !data?.attempt) {
        return;
      }
      hydrateFromResult(data);
    };

    fetch("/api/speaking/attempt/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "resume_probe" }),
    })
      .then(async (res) => {
        if (!active) return;
        const data = (await res.json().catch(() => null)) as
          | { attemptId?: string | null }
          | null;
        if (!res.ok || !data?.attemptId) return;
        await restoreAttempt(data.attemptId);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [hydrateFromResult]);

  const startTest = useCallback(async () => {
    clearTimers();
    stopSpeaking();
    finishingTurnRef.current = false;
    answerSecondsRef.current = null;
    prepSecondsRef.current = null;
    startedRecordingAtRef.current = null;
    currentClientTurnIdRef.current = null;
    await abortRecording();

    dispatch({ type: "reset" });
    dispatch({ type: "transition", phase: "starting" });

    try {
      const res = await fetch("/api/speaking/attempt/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: selectedMode }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            attemptId?: string;
            prompt?: SpeakingPrompt;
            totalQuestions?: number;
            status?: string;
            error?: string;
          }
        | null;
      if (!res.ok || !data?.attemptId || !data.prompt) {
        throw new Error(data?.error || "Failed to start speaking attempt");
      }

      dispatch({
        type: "patch",
        patch: {
          attemptId: data.attemptId,
          currentPrompt: data.prompt,
          totalQuestions: Number(data.totalQuestions || 0),
          attemptStatus: data.status || "IN_PROGRESS",
        },
      });
      speakPrompt(data.prompt);
    } catch (error) {
      dispatch({
        type: "set_error",
        error: error instanceof Error ? error.message : "Failed to start test",
      });
    }
  }, [abortRecording, clearTimers, selectedMode, speakPrompt, stopSpeaking]);

  const processTurnSnapshot = useCallback(
    async (snapshot: PartialTurnSnapshot) => {
      const attemptId = stateRef.current.attemptId;
      if (!attemptId) {
        throw new Error("Missing attempt id");
      }

      dispatch({ type: "transition", phase: "uploading" });
      dispatch({ type: "patch", patch: { error: null } });

      const orchestrated = await processSpeakingTurnOnServer({
        attemptId,
        snapshot,
      });

      const hasRealTranscript = orchestrated.turns.some(
        (turn) => (turn.userTranscript || "").trim().length > 0,
      );

      dispatch({
        type: "patch",
        patch: {
          turns: orchestrated.turns,
          provider: orchestrated.provider,
          evaluation: orchestrated.evaluation,
          attemptStatus: orchestrated.attemptStatus,
          currentPrompt: orchestrated.currentPrompt,
          pendingRetry: null,
          totalQuestions: Math.max(
            stateRef.current.totalQuestions,
            orchestrated.turns.length,
            orchestrated.currentPrompt ? orchestrated.currentPrompt.index + 1 : 0,
          ),
          answerSecondsLeft: null,
          prepSecondsLeft: null,
          silenceNotice: hasRealTranscript
            ? null
            : "No transcript captured yet. Check browser mic input device and speak close to microphone.",
        },
      });
      currentClientTurnIdRef.current = null;

      if (orchestrated.evaluation) {
        if (phaseRef.current !== "error") {
          dispatch({ type: "transition", phase: "evaluating" });
        }
        dispatch({ type: "transition", phase: "complete" });
        return;
      }

      if (orchestrated.currentPrompt) {
        dispatch({ type: "transition", phase: "recording" });
        speakPrompt(orchestrated.currentPrompt);
        return;
      }

      dispatch({
        type: "set_error",
        error: "Turn saved but next prompt is unavailable",
      });
    },
    [speakPrompt],
  );

  const finishTurn = useCallback(
    async (forcedByTimer = false) => {
      if (finishingTurnRef.current) return;

      const current = stateRef.current;
      if (!current.attemptId || !current.currentPrompt || !isRecording) return;
      finishingTurnRef.current = true;
      clearTimers();

      try {
        const startedAt = startedRecordingAtRef.current;
        const { transcript: finalTranscript, audioBlob } = await stopAndTranscribe();
        const durationMs =
          startedAt && startedAt > 0 ? Math.max(1, Date.now() - startedAt) : null;

        startedRecordingAtRef.current = null;
        answerSecondsRef.current = null;
        prepSecondsRef.current = null;

        const safeTranscript = finalTranscript.trim();
        if (!safeTranscript && !audioBlob) {
          dispatch({
            type: "patch",
            patch: { error: "No speech detected. Please answer and try again." },
          });
          await beginRecordingForPrompt(current.currentPrompt);
          return;
        }
        if (!audioBlob) {
          throw new Error("Recording failed: audio blob missing");
        }

        const snapshot: PartialTurnSnapshot = {
          clientTurnId: currentClientTurnIdRef.current || generateClientTurnId(),
          prompt: current.currentPrompt,
          transcript: safeTranscript,
          durationMs,
          audioBlob,
          silencePromptShown: current.silencePromptShown,
          forcedByTimer,
        };
        if (audioBlob.size < MIN_AUDIO_BYTES) {
          dispatch({
            type: "set_error",
            error:
              "Microphone signal looks empty. Select correct input device in browser/site settings, speak louder, and try again.",
          });
          return;
        }
        dispatch({ type: "patch", patch: { pendingRetry: snapshot } });
        await processTurnSnapshot(snapshot);
      } catch (error) {
        dispatch({
          type: "set_error",
          error: error instanceof Error ? error.message : "Failed to process answer",
        });
      } finally {
        finishingTurnRef.current = false;
      }
    },
    [beginRecordingForPrompt, clearTimers, isRecording, processTurnSnapshot, stopAndTranscribe],
  );

  finishTurnRef.current = finishTurn;

  const handleMicClick = useCallback(async () => {
    if (!canUseMic) return;
    if (isRecording) {
      await finishTurn(false);
      return;
    }
    if (!state.currentPrompt) return;
    await beginRecordingForPrompt(state.currentPrompt);
  }, [beginRecordingForPrompt, canUseMic, finishTurn, isRecording, state.currentPrompt]);

  const resetTest = useCallback(async () => {
    clearTimers();
    stopSpeaking();
    finishingTurnRef.current = false;
    answerSecondsRef.current = null;
    prepSecondsRef.current = null;
    startedRecordingAtRef.current = null;
    currentClientTurnIdRef.current = null;
    await abortRecording();
    dispatch({ type: "reset" });
  }, [abortRecording, clearTimers, stopSpeaking]);

  const retryLastStep = useCallback(async () => {
    const pending = state.pendingRetry;
    if (!pending) return;
    dispatch({ type: "transition", phase: "retrying" });
    dispatch({ type: "patch", patch: { error: null } });
    try {
      await processTurnSnapshot(pending);
    } catch (error) {
      dispatch({
        type: "set_error",
        error: error instanceof Error ? error.message : "Retry failed",
      });
    }
  }, [processTurnSnapshot, state.pendingRetry]);

  const phase = state.phase as SessionPhase;
  const currentPrompt = state.currentPrompt;
  const latestTurn = state.turns.length ? state.turns[state.turns.length - 1] : null;
  const latestSttProvider = latestTurn?.providerStatus?.stt || null;
  const latestPronProvider = latestTurn?.providerStatus?.pronunciation || null;
  const evalProvider = state.provider || null;
  const evalPronProvider = state.evaluation?.pronunciationSummary?.provider || null;

  return (
    <section className="space-y-5 rounded-[2rem] border border-slate-200/80 bg-[#f7f8f5] p-4 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.8)]">
      <header className="relative overflow-hidden rounded-[1.75rem] bg-slate-950 p-6 text-white">
        <div className="absolute right-0 top-0 h-56 w-56 rounded-bl-[8rem] bg-brand-teal/20 blur-2xl" />
        <div className="relative grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
              AI examiner environment
            </p>
            <h2 className="mt-3 text-3xl font-display tracking-tight">
              Speaking test room
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/60">
              {statusText}
            </p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="relative flex h-56 w-56 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
              <div
                className={[
                  "absolute rounded-full border transition-all duration-300",
                  isRecording
                    ? "border-brand-teal/60 bg-brand-teal/10"
                    : isSpeaking
                      ? "border-brand-purple-light/60 bg-brand-purple/10"
                      : "border-white/10 bg-white/[0.02]",
                ].join(" ")}
                style={{
                  inset: `${Math.max(10, 32 - micLevel * 28)}px`,
                  boxShadow: isRecording
                    ? `0 0 ${24 + micLevel * 80}px rgba(14,165,160,0.45)`
                    : undefined,
                }}
              />
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-white text-slate-950 shadow-2xl">
                {isRecording ? <Mic size={42} /> : isSpeaking ? <Volume2 size={42} /> : <MicOff size={40} />}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="rounded-[1.5rem] border border-slate-200 bg-white/95 p-4">
        <WaveVisualizer isRecording={isRecording} level={micLevel} />
        <div className="mt-3 flex items-center gap-2">
          <div className="h-2 flex-1 rounded-full bg-slate-200">
            <div
              className={[
                "h-2 rounded-full transition-all",
                micLevel > 0.18 ? "bg-emerald-500" : "bg-amber-500",
              ].join(" ")}
              style={{ width: `${Math.round(Math.max(0, Math.min(1, micLevel)) * 100)}%` }}
            />
          </div>
          <span className="text-[11px] font-medium text-slate-600">
            Mic level {Math.round(Math.max(0, Math.min(1, micLevel)) * 100)}%
          </span>
        </div>
        {!isRecording ? (
          <p className="mt-2 text-[11px] text-slate-500">
            Start recording and speak. If this stays near 0%, browser is using wrong mic input.
          </p>
        ) : null}
        {inputDeviceLabel ? (
          <p className="mt-1 text-[11px] text-slate-500">
            Active input: {inputDeviceLabel}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="mr-1 min-w-[220px] text-xs font-semibold uppercase tracking-wide text-slate-500">
          Speaking Test Set
          <select
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value)}
            disabled={phase !== "idle" || loadingModes}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium normal-case text-slate-700 disabled:opacity-60"
          >
            {availableModes.map((mode) => (
              <option key={mode.modeValue} value={mode.modeValue}>
                {mode.label}
              </option>
            ))}
          </select>
        </label>

        {phase === "idle" || phase === "error" ? (
          <button
            type="button"
            onClick={() => void startTest()}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10"
          >
            Start AI Test
          </button>
        ) : null}

        {phase !== "idle" && phase !== "complete" && phase !== "starting" ? (
          <button
            type="button"
            onClick={() => void handleMicClick()}
            disabled={!canUseMic}
            className={[
              "inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10",
              isRecording ? "bg-rose-600" : "bg-brand-teal-dark",
              !canUseMic ? "cursor-not-allowed opacity-70" : "",
            ].join(" ")}
          >
            {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
            {isRecording ? "Stop & Send" : "Tap to Speak"}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => void resetTest()}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
        >
          <RefreshCcw size={15} />
          Reset
        </button>

        {phase === "error" && state.pendingRetry ? (
          <button
            type="button"
            onClick={() => void retryLastStep()}
            className="inline-flex items-center gap-2 rounded-2xl border border-brand-purple/40 bg-brand-purple/5 px-5 py-3 text-sm font-semibold text-brand-purple"
          >
            <Loader2 size={15} />
            Retry Last Step
          </button>
        ) : null}

        {isSpeaking ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-purple/10 px-3 py-1 text-xs font-semibold text-brand-purple">
            <Volume2 size={13} />
            AI voice active
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-700">
          STT: {latestSttProvider || "pending"}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-700">
          Pronunciation: {latestPronProvider || evalPronProvider || "pending"}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-700">
          Evaluation: {evalProvider || "pending"}
        </span>
      </div>

      {state.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      {currentPrompt ? (
        <div className="rounded-[1.5rem] border border-brand-teal/20 bg-teal-50/70 p-5 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">
            {partLabel(currentPrompt.part)} - Question {currentPrompt.index + 1}
            {state.totalQuestions ? ` / ${state.totalQuestions}` : ""}
          </p>
          <p className="mt-1">{currentPrompt.prompt}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <span>Target: {currentPrompt.targetAnswerSeconds}s</span>
            <span>Hard cutoff: {currentPrompt.hardLimitSeconds}s</span>
            {state.prepSecondsLeft !== null ? (
              <span>Prep left: {state.prepSecondsLeft}s</span>
            ) : null}
            {state.answerSecondsLeft !== null ? (
              <span
                className={
                  state.answerSecondsLeft <= 20 ? "font-semibold text-rose-700" : ""
                }
              >
                Answer left: {state.answerSecondsLeft}s
              </span>
            ) : null}
          </div>
          {state.silenceNotice ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">
              {state.silenceNotice}
            </p>
          ) : null}
        </div>
      ) : null}

      {isBusyPhase(phase) ? (
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-purple/10 px-3 py-1 text-xs font-semibold text-brand-purple">
          <Loader2 size={13} className="animate-spin" />
          {statusText}
        </div>
      ) : null}

      {phase === "uploading" || phase === "transcribing" || phase === "evaluating" ? (
        <p className="text-xs text-slate-600">
          {phase === "uploading"
            ? "Uploading recorded audio..."
            : phase === "transcribing"
              ? "Running speech-to-text and pronunciation analysis..."
              : "Generating IELTS band scores and feedback..."}
        </p>
      ) : null}

      <div className="max-h-[28rem] space-y-3 overflow-auto rounded-[1.5rem] border border-slate-200 bg-white/95 p-4">
        {state.turns.length === 0 ? (
          <p className="text-sm text-slate-500">Your spoken turns will appear here.</p>
        ) : null}

        {state.turns.map((turn, idx) => (
          <div
            key={`${turn.id}-${idx}`}
            className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {partLabel(turn.part)} - Turn {turn.sequence}
            </p>
            <p className="text-xs text-slate-600">Examiner: {turn.examinerPrompt}</p>
            <p className="text-slate-800">{turn.userTranscript || "(No transcript)"}</p>
            <p className="text-[11px] text-slate-500">
              Fillers: {turn.fillerWordCount} | Pauses: {turn.pauseCount} | Duration:{" "}
              {turn.durationMs ? `${Math.round(turn.durationMs / 1000)}s` : "-"}
            </p>
            <p className="text-[11px] text-slate-500">
              STT: {turn.providerStatus?.stt || turn.transcriptSource || "-"} | Pronunciation:{" "}
              {turn.providerStatus?.pronunciation || "-"}
            </p>
            {turn.recording?.url ? (
              <audio
                controls
                preload="none"
                className="mt-1 w-full"
                src={turn.recording.url}
              />
            ) : null}
          </div>
        ))}

        {isRecording && transcript ? (
          <div className="ml-auto max-w-[85%] rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
              Live Transcript
            </p>
            {transcript}
          </div>
        ) : null}
      </div>

      {state.evaluation ? (
        <section className="space-y-3 rounded-xl border border-brand-purple/20 bg-brand-purple/5 p-4">
          <h3 className="text-base font-bold text-slate-900">Speaking Evaluation</h3>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Fluency", state.evaluation.fluencyCoherence],
              ["Lexical", state.evaluation.lexicalResource],
              ["Grammar", state.evaluation.grammaticalRangeAccuracy],
              ["Pronunciation", state.evaluation.pronunciation],
              ["Overall", state.evaluation.overallBand],
            ].map(([label, score]) => (
              <div key={String(label)} className="rounded-lg bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </p>
                <p className="text-xl font-black text-slate-900">
                  {Number(score).toFixed(1)}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <FeedbackCard
              title="Fluency"
              text={state.evaluation.criterionFeedback.fluencyCoherence || "-"}
            />
            <FeedbackCard
              title="Lexical Resource"
              text={state.evaluation.criterionFeedback.lexicalResource || "-"}
            />
            <FeedbackCard
              title="Grammar"
              text={state.evaluation.criterionFeedback.grammaticalRangeAccuracy || "-"}
            />
            <FeedbackCard
              title="Pronunciation"
              text={state.evaluation.criterionFeedback.pronunciation || "-"}
            />
          </div>

          {state.evaluation.strengths.length ? (
            <BulletList title="Strengths" items={state.evaluation.strengths} />
          ) : null}
          {state.evaluation.weaknesses.length ? (
            <BulletList title="Weaknesses" items={state.evaluation.weaknesses} />
          ) : null}
          {state.evaluation.actionableTips.length ? (
            <BulletList title="Actionable Tips" items={state.evaluation.actionableTips} />
          ) : null}

          {state.evaluation.grammarCorrections.length ? (
            <CorrectionTable
              title="Grammar Corrections"
              rows={state.evaluation.grammarCorrections.map((row) => ({
                a: row.original,
                b: row.corrected,
                c: row.explanation,
              }))}
              headers={["Original", "Corrected", "Why"]}
            />
          ) : null}

          {state.evaluation.vocabularyUpgrades.length ? (
            <CorrectionTable
              title="Vocabulary Upgrades"
              rows={state.evaluation.vocabularyUpgrades.map((row) => ({
                a: row.original,
                b: row.better,
                c: row.reason,
              }))}
              headers={["Original", "Better", "Reason"]}
            />
          ) : null}

          {state.evaluation.pronunciationSummary ? (
            <p className="text-xs text-slate-600">
              Pronunciation provider:{" "}
              {state.evaluation.pronunciationSummary.provider || "unknown"} | Average score:{" "}
              {state.evaluation.pronunciationSummary.averagePronunciationScore ?? "-"} | Scored turns:{" "}
              {state.evaluation.pronunciationSummary.scoredTurns ?? 0}/
              {state.evaluation.pronunciationSummary.totalTurns ?? 0}
            </p>
          ) : null}

          {state.evaluation.examinerSummary ? (
            <p className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              {state.evaluation.examinerSummary}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void resetTest()}
            className="inline-flex rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white"
          >
            Practice Again
          </button>
        </section>
      ) : null}

      <p className="text-xs text-slate-500">Attempt status: {state.attemptStatus}</p>
    </section>
  );
}

function FeedbackCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="mt-1 text-sm text-slate-700">{text}</p>
    </article>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-700">
        {items.map((item, idx) => (
          <li key={`${title}-${idx}`}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function CorrectionTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: [string, string, string];
  rows: Array<{ a: string; b: string; c: string }>;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="px-2 py-1">{headers[0]}</th>
              <th className="px-2 py-1">{headers[1]}</th>
              <th className="px-2 py-1">{headers[2]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${title}-${idx}`} className="border-t border-slate-100">
                <td className="px-2 py-1 text-slate-700">{row.a}</td>
                <td className="px-2 py-1 text-slate-700">{row.b}</td>
                <td className="px-2 py-1 text-slate-600">{row.c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
