"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type SpeakingPart = "PART_1" | "PART_2_PREP" | "PART_2" | "PART_3";

type TurnRow = {
  id: string;
  part: SpeakingPart;
  sequence: number;
  examinerPrompt: string;
  userTranscript: string;
  durationMs: number | null;
  fillerWordCount: number;
  pauseCount: number;
  pauseDurationMs: number;
  speechRateWpm: number | null;
};

type SpeakingResultPayload = {
  attempt?: {
    id: string;
    status: string;
    mode: string;
    startedAt: string;
    submittedAt: string | null;
    completedAt: string | null;
    currentPart: SpeakingPart;
    totalQuestionsAsked: number;
    transcriptFull: string;
  };
  turns?: TurnRow[];
  evaluation?: {
    fluencyCoherence: number | null;
    lexicalResource: number | null;
    grammaticalRangeAccuracy: number | null;
    pronunciation: number | null;
    overallBand: number | null;
    criterionFeedback?: {
      fluencyCoherence?: string;
      lexicalResource?: string;
      grammaticalRangeAccuracy?: string;
      pronunciation?: string;
      provider?: string;
    };
    strengths?: string[];
    weaknesses?: string[];
    actionableTips?: string[];
    grammarCorrections?: Array<{
      original: string;
      corrected: string;
      explanation: string;
    }>;
    vocabularyUpgrades?: Array<{
      original: string;
      better: string;
      reason: string;
    }>;
    pronunciationSummary?: {
      averagePronunciationScore?: number | null;
      scoredTurns?: number;
      totalTurns?: number;
    };
    examinerSummary?: string | null;
  } | null;
};

function partLabel(part: SpeakingPart): string {
  if (part === "PART_1") return "Part 1";
  if (part === "PART_2_PREP") return "Part 2 Prep";
  if (part === "PART_2") return "Part 2";
  return "Part 3";
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

export default function SpeakingAttemptResultPage() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = params?.attemptId || "";
  const missingAttemptId = !attemptId;

  const [loading, setLoading] = useState(!missingAttemptId);
  const [error, setError] = useState<string | null>(
    missingAttemptId ? "Attempt ID missing" : null,
  );
  const [data, setData] = useState<SpeakingResultPayload | null>(null);

  useEffect(() => {
    if (!attemptId) return;

    let active = true;

    fetch(`/api/speaking/attempt/${attemptId}/result`, { cache: "no-store" })
      .then(async (res) => {
        if (!active) return;
        const payload = (await res.json().catch(() => null)) as
          | (SpeakingResultPayload & { error?: string })
          | null;
        if (!res.ok || !payload?.attempt) {
          throw new Error(payload?.error || "Unable to load speaking result");
        }
        setData(payload);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load result");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [attemptId]);

  if (missingAttemptId) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Attempt ID missing
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid gap-4">
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-72 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  if (error || !data?.attempt) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error || "Speaking attempt not found"}
      </div>
    );
  }

  const evaluation = data.evaluation;
  const scoreCards = evaluation
    ? ([
        ["Fluency & Coherence", evaluation.fluencyCoherence],
        ["Lexical Resource", evaluation.lexicalResource],
        ["Grammar", evaluation.grammaticalRangeAccuracy],
        ["Pronunciation", evaluation.pronunciation],
        ["Overall", evaluation.overallBand],
      ] as const)
    : [];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-brand-purple via-brand-purple-dark to-brand-teal p-5 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/85">
          AI Speaking Result
        </p>
        <h1 className="mt-2 text-2xl font-bold">Attempt {data.attempt.id}</h1>
        <p className="mt-1 text-sm text-white/85">
          Status: {data.attempt.status} • Started: {formatDate(data.attempt.startedAt)} • Completed:{" "}
          {formatDate(data.attempt.completedAt)}
        </p>
      </section>

      {evaluation ? (
        <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {scoreCards.map(([label, value]) => (
              <article key={label} className="rounded-xl bg-brand-purple/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </p>
                <p className="text-2xl font-black text-slate-900">
                  {Number(value || 0).toFixed(1)}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <FeedbackCard
              title="Fluency & Coherence"
              text={evaluation.criterionFeedback?.fluencyCoherence || "-"}
            />
            <FeedbackCard
              title="Lexical Resource"
              text={evaluation.criterionFeedback?.lexicalResource || "-"}
            />
            <FeedbackCard
              title="Grammar"
              text={evaluation.criterionFeedback?.grammaticalRangeAccuracy || "-"}
            />
            <FeedbackCard
              title="Pronunciation"
              text={evaluation.criterionFeedback?.pronunciation || "-"}
            />
          </div>

          {evaluation.examinerSummary ? (
            <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {evaluation.examinerSummary}
            </p>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <StringList title="Strengths" items={evaluation.strengths || []} />
            <StringList title="Weaknesses" items={evaluation.weaknesses || []} />
            <StringList title="Actionable Tips" items={evaluation.actionableTips || []} />
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Evaluation is not available yet. Please try again shortly.
        </section>
      )}

      <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Turn-by-Turn Transcript
        </h2>
        <div className="mt-3 space-y-2">
          {(data.turns || []).map((turn) => (
            <article key={turn.id} className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {partLabel(turn.part)} • Turn {turn.sequence}
              </p>
              <p className="mt-1 text-xs text-slate-600">Examiner: {turn.examinerPrompt}</p>
              <p className="mt-2 text-sm text-slate-800">{turn.userTranscript || "-"}</p>
              <p className="mt-2 text-[11px] text-slate-500">
                Duration: {turn.durationMs ? `${Math.round(turn.durationMs / 1000)}s` : "-"} | Fillers:{" "}
                {turn.fillerWordCount} | Pauses: {turn.pauseCount} | Speech rate:{" "}
                {turn.speechRateWpm ?? "-"} wpm
              </p>
            </article>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/student/speaking"
          className="inline-flex rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white"
        >
          Back to Speaking Hub
        </Link>
        <Link
          href="/dashboard/student/progress"
          className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Open Progress
        </Link>
      </div>
    </div>
  );
}

function FeedbackCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-xl border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="mt-1 text-sm text-slate-700">{text}</p>
    </article>
  );
}

function StringList({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="rounded-xl border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      {items.length ? (
        <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-700">
          {items.map((item, idx) => (
            <li key={`${title}-${idx}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-slate-500">No items yet.</p>
      )}
    </article>
  );
}
