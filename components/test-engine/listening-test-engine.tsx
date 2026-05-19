"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InstantResultView from "@/components/test-engine/instant-result-view";
import QuestionNavPanel from "@/components/test-engine/question-nav-panel";
import MultipleChoice from "@/components/test-engine/question-types/multiple-choice";
import TrueFalseNg from "@/components/test-engine/question-types/true-false-ng";
import YesNoNg from "@/components/test-engine/question-types/yes-no-ng";
import FillBlank from "@/components/test-engine/question-types/fill-blank";
import ShortAnswer from "@/components/test-engine/question-types/short-answer";
import SentenceCompletion from "@/components/test-engine/question-types/sentence-completion";
import SummaryCompletion from "@/components/test-engine/question-types/summary-completion";
import useSpeechSynthesis from "@/hooks/useSpeechSynthesis";

type Option = {
  id: string;
  label: string;
  text: string;
};

type Question = {
  id: string;
  type:
    | "MULTIPLE_CHOICE"
    | "TRUE_FALSE_NOT_GIVEN"
    | "YES_NO_NOT_GIVEN"
    | "FILL_IN_BLANK"
    | "SENTENCE_COMPLETION"
    | "SUMMARY_COMPLETION"
    | "SHORT_ANSWER";
  order: number;
  questionText: string;
  options?: Option[];
};

type Section = {
  id: string;
  title: string;
  passage?: string | null;
  audioUrl?: string | null;
  questions: Question[];
};

type ListeningAudioMode = "single_full_audio" | "sequential_section_audio";

type ListeningAudioTrack = {
  sectionId: string;
  sectionTitle: string;
  audioUrl: string | null;
};

type PlaybackUnit = {
  id: string;
  label: string;
  audioUrl: string | null;
  passageText: string;
};

type SessionPhase = "ready" | "audio" | "review" | "submitted";

type EvalResultItem = {
  questionId: string;
  questionText: string;
  yourAnswer: string | null;
  correctAnswer: string;
  explanation?: string | null;
  isCorrect: boolean;
};

type EvalPayload = {
  bandScore: number;
  rawScore: number;
  correctCount: number;
  totalCount: number;
  mcqResults: EvalResultItem[];
};

type ListeningTestEngineProps = {
  attemptId: string;
  attemptMode?: string;
  durationMins?: number;
  selectedPartsCsv?: string;
  timeLimit?: string;
};

const REVIEW_SECONDS = 120;
const DEFAULT_SECTION_PAUSE_SECONDS = 10;
const DEFAULT_SECTION_TRANSITION_MESSAGE =
  "Now, starting another section, be prepared.";

function normalizeAnswer(value: string | undefined): string {
  return value?.trim() || "";
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mm = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  return `${mm}:${ss}`;
}

function normalizeMode(
  value: string,
): "practice" | "simulation" | "mock" | "final" {
  const v = (value || "").trim().toLowerCase();
  if (v === "practice") return "practice";
  if (v === "mock") return "mock";
  if (v === "final") return "final";
  return "simulation";
}

export default function ListeningTestEngine({
  attemptId,
  attemptMode = "simulation",
  durationMins = 30,
  selectedPartsCsv = "",
  timeLimit = "",
}: ListeningTestEngineProps) {
  const storageKey = `ielts-listening-attempt:${attemptId}`;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const maxPlayedTimeRef = useRef(0);
  const { isSpeaking, speakText, stopSpeaking } = useSpeechSynthesis();

  const [sections, setSections] = useState<Section[]>([]);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [listeningAudioMode, setListeningAudioMode] =
    useState<ListeningAudioMode>("sequential_section_audio");
  const [listeningAudioTracks, setListeningAudioTracks] = useState<
    ListeningAudioTrack[]
  >([]);
  const [listeningSectionPauseSeconds, setListeningSectionPauseSeconds] = useState(
    DEFAULT_SECTION_PAUSE_SECONDS,
  );
  const [listeningSectionTransitionMessage, setListeningSectionTransitionMessage] =
    useState(DEFAULT_SECTION_TRANSITION_MESSAGE);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EvalPayload | null>(null);

  const [runtimeMode, setRuntimeMode] = useState(normalizeMode(attemptMode));
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>("ready");
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [currentUnitIndex, setCurrentUnitIndex] = useState(0);
  const [pendingAutoplayTick, setPendingAutoplayTick] = useState(0);
  const [playbackRunning, setPlaybackRunning] = useState(false);
  const [audioCompleted, setAudioCompleted] = useState(false);
  const [betweenSectionsSecondsLeft, setBetweenSectionsSecondsLeft] = useState<
    number | null
  >(null);
  const [transitionAnnouncementActive, setTransitionAnnouncementActive] =
    useState(false);
  const [waitingForTransitionAnnouncement, setWaitingForTransitionAnnouncement] =
    useState(false);

  const [reviewSecondsLeft, setReviewSecondsLeft] = useState(REVIEW_SECONDS);

  useEffect(() => {
    let active = true;

    const query = new URLSearchParams();
    if (selectedPartsCsv) {
      query.set("selectedParts", selectedPartsCsv);
    }
    if (timeLimit) {
      query.set("timeLimit", timeLimit);
    }
    const requestUrl = query.toString()
      ? `/api/attempts/${attemptId}/test?${query.toString()}`
      : `/api/attempts/${attemptId}/test`;

    fetch(requestUrl, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load listening test");
        const data = (await res.json()) as {
          sections?: Section[];
          testAudioUrl?: string | null;
          mode?: string;
          listeningAudioMode?: ListeningAudioMode;
          listeningAudioTracks?: ListeningAudioTrack[];
          listeningSectionPauseSeconds?: number;
          listeningSectionTransitionMessage?: string;
        };
        if (!active) return;
        const nextSections = Array.isArray(data.sections) ? data.sections : [];
        setSections(nextSections);
        setTestAudioUrl(
          typeof data.testAudioUrl === "string" ? data.testAudioUrl : null,
        );
        setListeningAudioMode(
          data.listeningAudioMode === "single_full_audio"
            ? "single_full_audio"
            : "sequential_section_audio",
        );
        setListeningAudioTracks(
          Array.isArray(data.listeningAudioTracks) ? data.listeningAudioTracks : [],
        );
        const pauseSecondsRaw = Number(data.listeningSectionPauseSeconds);
        setListeningSectionPauseSeconds(
          Number.isFinite(pauseSecondsRaw)
            ? Math.max(0, Math.min(120, Math.round(pauseSecondsRaw)))
            : DEFAULT_SECTION_PAUSE_SECONDS,
        );
        setListeningSectionTransitionMessage(
          typeof data.listeningSectionTransitionMessage === "string" &&
            data.listeningSectionTransitionMessage.trim()
            ? data.listeningSectionTransitionMessage.trim()
            : DEFAULT_SECTION_TRANSITION_MESSAGE,
        );

        const nextMode = normalizeMode(data.mode || attemptMode);
        setRuntimeMode(nextMode);

        const firstQuestionId = nextSections[0]?.questions[0]?.id;
        if (firstQuestionId) {
          setVisited((prev) => ({ ...prev, [firstQuestionId]: true }));
        }

        const cached = localStorage.getItem(storageKey);
        if (cached) {
          const parsed = JSON.parse(cached) as {
            answers?: Record<string, string>;
            visited?: Record<string, boolean>;
            marked?: Record<string, boolean>;
            reviewSecondsLeft?: number;
            sessionPhase?: SessionPhase;
            sessionStartedAt?: number | null;
            currentUnitIndex?: number;
            audioCompleted?: boolean;
          };
          if (parsed.answers) setAnswers(parsed.answers);
          if (parsed.visited) setVisited(parsed.visited);
          if (parsed.marked) setMarked(parsed.marked);
          if (typeof parsed.reviewSecondsLeft === "number") {
            setReviewSecondsLeft(Math.max(0, parsed.reviewSecondsLeft));
          }
          if (typeof parsed.currentUnitIndex === "number") {
            setCurrentUnitIndex(Math.max(0, Math.round(parsed.currentUnitIndex)));
          }
          if (typeof parsed.audioCompleted === "boolean") {
            setAudioCompleted(parsed.audioCompleted);
          }
          if (
            parsed.sessionPhase === "ready" ||
            parsed.sessionPhase === "review"
          ) {
            setSessionPhase(parsed.sessionPhase);
          }
          if (
            parsed.sessionStartedAt == null ||
            typeof parsed.sessionStartedAt === "number"
          ) {
            setSessionStartedAt(parsed.sessionStartedAt ?? null);
          }
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Unable to load listening test",
        );
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    attemptId,
    attemptMode,
    selectedPartsCsv,
    storageKey,
    durationMins,
    timeLimit,
  ]);

  useEffect(() => {
    if (loading || result) return;
    const saver = setInterval(() => {
      const snapshot = {
        answers,
        visited,
        marked,
        reviewSecondsLeft,
        sessionPhase: sessionPhase === "audio" ? "ready" : sessionPhase,
        sessionStartedAt,
        currentUnitIndex,
        audioCompleted,
      };
      localStorage.setItem(storageKey, JSON.stringify(snapshot));
    }, 30000);

    return () => clearInterval(saver);
  }, [
    answers,
    visited,
    marked,
    reviewSecondsLeft,
    sessionPhase,
    sessionStartedAt,
    currentUnitIndex,
    audioCompleted,
    loading,
    result,
    storageKey,
  ]);

  const allQuestions = useMemo(
    () => sections.flatMap((section) => section.questions),
    [sections],
  );

  const playbackUnits = useMemo<PlaybackUnit[]>(() => {
    if (!sections.length) return [];

    if (listeningAudioMode === "single_full_audio") {
      const joinedPassage = sections
        .map((section) => section.passage || "")
        .join("\n\n")
        .trim();
      const mergedUrl =
        testAudioUrl || sections.find((section) => section.audioUrl)?.audioUrl || null;
      if (!mergedUrl && !joinedPassage) return [];
      return [
        {
          id: "full-listening-audio",
          label: "Full Test Audio",
          audioUrl: mergedUrl,
          passageText: joinedPassage,
        },
      ];
    }

    const sectionIds = new Set(sections.map((section) => section.id));
    const trackMap = new Map(
      listeningAudioTracks
        .filter((track) => sectionIds.has(track.sectionId))
        .map((track) => [track.sectionId, track.audioUrl]),
    );

    return sections
      .map((section, index) => {
        const sectionAudio = section.audioUrl || trackMap.get(section.id) || null;
        return {
          id: `section-${section.id}-${index}`,
          label: section.title,
          audioUrl: sectionAudio,
          passageText: (section.passage || "").trim(),
        };
      })
      .filter((unit) => unit.audioUrl || unit.passageText);
  }, [listeningAudioMode, listeningAudioTracks, sections, testAudioUrl]);

  const currentUnit = playbackUnits[currentUnitIndex] || null;
  const currentSectionLabel = currentUnit?.label || "Listening";

  const navItems = useMemo(
    () =>
      allQuestions.map((question, idx) => ({
        id: question.id,
        number: idx + 1,
        visited: Boolean(visited[question.id]),
        answered: Boolean(answers[question.id]?.trim()),
        markedForReview: Boolean(marked[question.id]),
      })),
    [allQuestions, visited, answers, marked],
  );

  const answeredCount = useMemo(
    () => allQuestions.filter((q) => Boolean(answers[q.id]?.trim())).length,
    [allQuestions, answers],
  );

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setVisited((prev) => ({ ...prev, [questionId]: true }));
  }

  function jumpToQuestion(questionId: string) {
    setVisited((prev) => ({ ...prev, [questionId]: true }));

    requestAnimationFrame(() => {
      const node = document.getElementById(`question-${questionId}`);
      node?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function toggleReview(questionId: string) {
    setMarked((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  }

  const advancePlayback = useCallback(() => {
    setPlaybackRunning(false);
    setCurrentUnitIndex((prev) => {
      const next = prev + 1;
      if (next < playbackUnits.length) {
        if (
          listeningAudioMode === "sequential_section_audio" &&
          listeningSectionPauseSeconds > 0
        ) {
          setBetweenSectionsSecondsLeft(listeningSectionPauseSeconds);
          setWaitingForTransitionAnnouncement(true);
          setTransitionAnnouncementActive(true);
          speakText(listeningSectionTransitionMessage, {
            rate: 1,
            onEnd: () => {
              setTransitionAnnouncementActive(false);
              setWaitingForTransitionAnnouncement(false);
            },
          });
          return next;
        }
        setPendingAutoplayTick((tick) => tick + 1);
        return next;
      }
      setAudioCompleted(true);
      setSessionPhase("review");
      setReviewSecondsLeft(REVIEW_SECONDS);
      return prev;
    });
  }, [
    listeningAudioMode,
    listeningSectionPauseSeconds,
    listeningSectionTransitionMessage,
    playbackUnits.length,
    speakText,
  ]);

  const playCurrentAudio = useCallback(async () => {
    const node = audioRef.current;
    if (!currentUnit?.audioUrl || !node) {
      setError("No playable audio found for current listening segment.");
      return;
    }
    try {
      setError(null);
      node.playbackRate = 1;
      await node.play();
      setPlaybackRunning(true);
    } catch (err) {
      setPlaybackRunning(false);
      setError(
        err instanceof Error ? err.message : "Unable to start listening audio",
      );
    }
  }, [currentUnit?.audioUrl]);

  const playCurrentTts = useCallback(() => {
    if (!currentUnit?.passageText || currentUnit.audioUrl) return;
    setError(null);
    setPlaybackRunning(true);
    speakText(currentUnit.passageText, {
      rate: 0.95,
      onEnd: () => {
        setPlaybackRunning(false);
        advancePlayback();
      },
    });
  }, [advancePlayback, currentUnit, speakText]);

  const pauseCurrentPlayback = useCallback(() => {
    const node = audioRef.current;
    if (node && !node.paused) {
      node.pause();
    }
    if (isSpeaking) {
      stopSpeaking();
    }
    setPlaybackRunning(false);
  }, [isSpeaking, stopSpeaking]);

  const beginAudioFlow = useCallback(() => {
    setError(null);
    if (!allQuestions.length) {
      setError("No listening questions available.");
      return;
    }
    if (!playbackUnits.length) {
      setSessionStartedAt((prev) => prev ?? Date.now());
      setAudioCompleted(true);
      setSessionPhase("review");
      setReviewSecondsLeft(REVIEW_SECONDS);
      return;
    }

    setSessionStartedAt((prev) => prev ?? Date.now());
    setSessionPhase("audio");
    setAudioCompleted(false);
    setPendingAutoplayTick((tick) => tick + 1);
  }, [allQuestions.length, playbackUnits.length]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const payload = allQuestions.map((q) => ({
        questionId: q.id,
        givenAnswer: normalizeAnswer(answers[q.id]),
      }));

      const computedTimeTakenSecs =
        sessionStartedAt != null
          ? Math.max(0, Math.round((Date.now() - sessionStartedAt) / 1000))
          : null;

      const saveRes = await fetch(`/api/attempts/${attemptId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: payload,
          timeTakenSecs: computedTimeTakenSecs,
        }),
      });

      if (!saveRes.ok) {
        const data = (await saveRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "Failed to save listening answers");
      }

      const evalRes = await fetch(`/api/evaluate/${attemptId}`, {
        method: "POST",
      });
      const evalData = (await evalRes.json().catch(() => null)) as
        | EvalPayload
        | { error?: string; detail?: string }
        | null;

      if (!evalRes.ok || !evalData || !("bandScore" in evalData)) {
        const payload = evalData as { error?: string; detail?: string } | null;
        const parts = [payload?.error, payload?.detail].filter(Boolean);
        throw new Error(
          parts.join("\n") || "Failed to evaluate listening attempt",
        );
      }

      setResult(evalData);
      localStorage.removeItem(storageKey);
      setSessionPhase("submitted");
      setPlaybackRunning(false);
      stopSpeaking();
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }, [
    allQuestions,
    answers,
    attemptId,
    sessionStartedAt,
    storageKey,
    submitting,
    stopSpeaking,
  ]);

  useEffect(() => {
    if (
      loading ||
      result ||
      submitting ||
      sessionPhase !== "audio" ||
      !playbackUnits.length ||
      betweenSectionsSecondsLeft != null ||
      waitingForTransitionAnnouncement
    )
      return;
    const unit = playbackUnits[currentUnitIndex];
    if (!unit) {
      setAudioCompleted(true);
      setSessionPhase("review");
      setReviewSecondsLeft(REVIEW_SECONDS);
      return;
    }
    if (unit.audioUrl) {
      void playCurrentAudio();
      return;
    }
    if (unit.passageText) {
      playCurrentTts();
      return;
    }
    advancePlayback();
  }, [
    advancePlayback,
    currentUnitIndex,
    loading,
    pendingAutoplayTick,
    betweenSectionsSecondsLeft,
    playbackUnits,
    playCurrentAudio,
    playCurrentTts,
    result,
    sessionPhase,
    submitting,
    waitingForTransitionAnnouncement,
  ]);

  useEffect(() => {
    if (betweenSectionsSecondsLeft == null) return;
    if (betweenSectionsSecondsLeft <= 0) {
      setBetweenSectionsSecondsLeft(null);
      setPendingAutoplayTick((tick) => tick + 1);
      return;
    }

    const timer = setInterval(() => {
      setBetweenSectionsSecondsLeft((prev) =>
        prev == null ? prev : Math.max(0, prev - 1),
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [betweenSectionsSecondsLeft]);

  useEffect(() => {
    maxPlayedTimeRef.current = 0;
  }, [currentUnitIndex]);

  useEffect(() => {
    if (sessionPhase !== "review" || result || submitting) return;
    if (reviewSecondsLeft <= 0) {
      void handleSubmit();
      return;
    }

    const timer = setInterval(() => {
      setReviewSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [
    handleSubmit,
    reviewSecondsLeft,
    result,
    sessionPhase,
    submitting,
  ]);

  useEffect(() => {
    if (sessionPhase === "review" || sessionPhase === "submitted") {
      pauseCurrentPlayback();
    }
  }, [pauseCurrentPlayback, sessionPhase]);

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-600">
        Loading listening test...
      </div>
    );
  }

  if (error && !sections.length) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (result) {
    return (
      <InstantResultView
        bandScore={result.bandScore}
        rawScore={result.rawScore}
        totalCount={result.totalCount}
        results={result.mcqResults}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-16 z-20 rounded-2xl border border-brand-purple/20 bg-white p-3 shadow-sm">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Listening Audio ({runtimeMode.toUpperCase()})
            </p>
            <p className="rounded-lg bg-brand-purple/10 px-2 py-1 text-xs font-semibold text-brand-purple">
              Answered: {answeredCount}/{allQuestions.length}
            </p>
          </div>

          <div className="grid gap-2 text-xs sm:grid-cols-3">
            <p className="rounded-lg bg-slate-50 px-2 py-1 text-slate-700">
              Mode:{" "}
              <span className="font-semibold">
                {listeningAudioMode === "single_full_audio"
                  ? "Single full audio"
                  : "Sequential section audio"}
              </span>
            </p>
            <p className="rounded-lg bg-slate-50 px-2 py-1 text-slate-700">
              Current: <span className="font-semibold">{currentSectionLabel}</span>
            </p>
            <p className="rounded-lg bg-slate-50 px-2 py-1 text-slate-700">
              Review timer:{" "}
              <span className="font-semibold">
                {sessionPhase === "review" ? formatTime(reviewSecondsLeft) : "--:--"}
              </span>
            </p>
          </div>

          <audio
            ref={audioRef}
            src={currentUnit?.audioUrl || undefined}
            preload="metadata"
            onRateChange={() => {
              if (audioRef.current) audioRef.current.playbackRate = 1;
            }}
            onEnded={advancePlayback}
            onPause={() => setPlaybackRunning(false)}
            onPlay={() => setPlaybackRunning(true)}
            onSeeking={() => {
              const node = audioRef.current;
              if (!node) return;
              if (node.currentTime > maxPlayedTimeRef.current + 1.25) {
                node.currentTime = maxPlayedTimeRef.current;
              }
            }}
            onTimeUpdate={() => {
              const node = audioRef.current;
              if (!node) return;
              if (node.currentTime > maxPlayedTimeRef.current + 1.25) {
                node.currentTime = maxPlayedTimeRef.current;
                return;
              }
              maxPlayedTimeRef.current = Math.max(
                maxPlayedTimeRef.current,
                node.currentTime,
              );
            }}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={beginAudioFlow}
              disabled={
                submitting ||
                sessionPhase === "audio" ||
                sessionPhase === "review" ||
                sessionPhase === "submitted"
              }
              className="rounded-xl bg-gradient-to-r from-brand-purple to-brand-teal px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sessionStartedAt ? "Resume Listening Audio" : "Start Listening Audio"}
            </button>

            <button
              type="button"
              onClick={playCurrentAudio}
              disabled={
                submitting ||
                sessionPhase !== "audio" ||
                !currentUnit?.audioUrl ||
                playbackRunning
              }
              className="rounded-xl border border-brand-purple/30 bg-white px-4 py-2 text-sm font-semibold text-brand-purple disabled:cursor-not-allowed disabled:opacity-60"
            >
              Play
            </button>

            <button
              type="button"
              onClick={pauseCurrentPlayback}
              disabled={submitting || sessionPhase !== "audio" || !playbackRunning}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Pause
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || sessionPhase !== "review"}
              className="ml-auto rounded-xl bg-gradient-to-r from-brand-purple to-brand-teal px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>

          {sessionPhase === "ready" ? (
            <p className="text-xs text-slate-500">
              Audio drives test pace. Questions stay visible while listening.
            </p>
          ) : null}
          {sessionPhase === "audio" ? (
            <p className="text-xs text-slate-500">
              Seeking and fast-forward are disabled during active listening.
            </p>
          ) : null}
          {betweenSectionsSecondsLeft != null ? (
            <p className="text-sm font-semibold text-brand-purple">
              Next section starts in {formatTime(betweenSectionsSecondsLeft)}.{" "}
              {transitionAnnouncementActive
                ? "Announcing transition..."
                : "Prepare for next section."}
            </p>
          ) : null}
          {sessionPhase === "review" ? (
            <p className="text-sm font-semibold text-rose-700">
              Final review time left: {formatTime(reviewSecondsLeft)} (auto-submit
              at 00:00)
            </p>
          ) : null}
          {audioCompleted && sessionPhase !== "review" ? (
            <p className="text-xs text-slate-500">
              Listening audio completed.
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-brand-purple/15 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <p className="rounded-xl border border-brand-purple/20 bg-brand-purple/5 px-3 py-2 text-sm font-semibold text-slate-700">
            Sections: {sections.length}
          </p>
          <p className="rounded-xl border border-brand-purple/20 bg-brand-purple/5 px-3 py-2 text-sm font-semibold text-slate-700">
            Questions: {allQuestions.length}
          </p>
          <p className="rounded-xl border border-brand-purple/20 bg-brand-purple/5 px-3 py-2 text-sm font-semibold text-slate-700">
            Status: {sessionPhase.toUpperCase()}
          </p>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || sessionPhase !== "review"}
            className="ml-auto rounded-xl bg-gradient-to-r from-brand-purple to-brand-teal px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4 rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
          {sections.map((section) => (
            <article key={section.id} className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900">{section.title}</h2>

              {section.questions.map((question) => {
                const value = answers[question.id] || "";
                return (
                  <div key={question.id} id={`question-${question.id}`}>
                    {question.type === "MULTIPLE_CHOICE" ? (
                      <MultipleChoice
                        questionId={question.id}
                        questionText={question.questionText}
                        options={question.options || []}
                        value={value}
                        onChange={(v) => setAnswer(question.id, v)}
                      />
                    ) : null}

                    {question.type === "TRUE_FALSE_NOT_GIVEN" ? (
                      <TrueFalseNg
                        questionId={question.id}
                        questionText={question.questionText}
                        value={value as "TRUE" | "FALSE" | "NOT_GIVEN" | undefined}
                        onChange={(v) => setAnswer(question.id, v)}
                      />
                    ) : null}

                    {question.type === "YES_NO_NOT_GIVEN" ? (
                      <YesNoNg
                        questionId={question.id}
                        questionText={question.questionText}
                        value={value as "YES" | "NO" | "NOT_GIVEN" | undefined}
                        onChange={(v) => setAnswer(question.id, v)}
                      />
                    ) : null}

                    {question.type === "FILL_IN_BLANK" ? (
                      <FillBlank
                        questionId={question.id}
                        questionText={question.questionText}
                        value={value}
                        onChange={(v) => setAnswer(question.id, v)}
                      />
                    ) : null}

                    {question.type === "SHORT_ANSWER" ? (
                      <ShortAnswer
                        questionId={question.id}
                        questionText={question.questionText}
                        value={value}
                        onChange={(v) => setAnswer(question.id, v)}
                      />
                    ) : null}

                    {question.type === "SENTENCE_COMPLETION" ? (
                      <SentenceCompletion
                        questionId={question.id}
                        sentence={question.questionText}
                        value={value}
                        onChange={(v) => setAnswer(question.id, v)}
                      />
                    ) : null}

                    {question.type === "SUMMARY_COMPLETION" ? (
                      <SummaryCompletion
                        questionId={question.id}
                        summaryText={question.questionText}
                        value={value}
                        onChange={(v) => setAnswer(question.id, v)}
                      />
                    ) : null}
                  </div>
                );
              })}
            </article>
          ))}
        </section>

        <QuestionNavPanel
          items={navItems}
          onJump={jumpToQuestion}
          onToggleReview={toggleReview}
        />
      </div>
    </div>
  );
}
