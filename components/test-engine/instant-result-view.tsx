"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, CircleX } from "lucide-react";

type ResultItem = {
  questionId: string;
  questionText: string;
  yourAnswer: string | null;
  correctAnswer: string;
  explanation?: string | null;
  isCorrect: boolean;
};

type InstantResultViewProps = {
  bandScore: number;
  rawScore: number;
  totalCount?: number;
  results: ResultItem[];
  className?: string;
};

export default function InstantResultView({
  bandScore,
  rawScore,
  totalCount = 40,
  results,
  className,
}: InstantResultViewProps) {
  const [animatedBand, setAnimatedBand] = useState(0);
  const [openExplanation, setOpenExplanation] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    const start = performance.now();
    const duration = 700;

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      setAnimatedBand(Number((bandScore * progress).toFixed(1)));
      if (progress < 1) requestAnimationFrame(tick);
    }

    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bandScore]);

  const summaryText = useMemo(() => {
    if (rawScore >= totalCount * 0.8)
      return "Excellent accuracy. Keep consistency.";
    if (rawScore >= totalCount * 0.6)
      return "Good progress. Focus on weak question types.";
    return "You can improve fast with targeted practice.";
  }, [rawScore, totalCount]);

  function toggleExplanation(questionId: string) {
    setOpenExplanation((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  }

  return (
    <section
      className={[
        "rounded-3xl border border-brand-purple/20 bg-white p-5 shadow-sm",
        className || "",
      ].join(" ")}
    >
      <header className="rounded-2xl bg-gradient-to-r from-brand-purple via-brand-purple-dark to-brand-teal p-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/85">
          Instant IELTS Result
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-white/85">Estimated Band Score</p>
            <p className="text-5xl font-black leading-none sm:text-6xl">
              {animatedBand.toFixed(1)}
            </p>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3">
            <p className="text-xs text-white/80">Raw Score</p>
            <p className="text-2xl font-bold">
              {rawScore} / {totalCount}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-white/90">{summaryText}</p>
      </header>

      <div className="mt-5 space-y-3">
        {results.map((item, index) => {
          const open = Boolean(openExplanation[item.questionId]);
          return (
            <article
              key={item.questionId}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  Q{index + 1}. {item.questionText}
                </p>
                <span
                  className={[
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                    item.isCorrect
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700",
                  ].join(" ")}
                >
                  {item.isCorrect ? (
                    <CheckCircle2 size={13} />
                  ) : (
                    <CircleX size={13} />
                  )}
                  {item.isCorrect ? "Correct" : "Incorrect"}
                </span>
              </div>

              <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                <p className="rounded-lg bg-white px-3 py-2 text-slate-700">
                  <span className="font-semibold text-slate-900">
                    Your Answer:
                  </span>{" "}
                  {item.yourAnswer?.trim() ? item.yourAnswer : "-"}
                </p>
                <p className="rounded-lg bg-white px-3 py-2 text-slate-700">
                  <span className="font-semibold text-slate-900">Correct:</span>{" "}
                  {item.correctAnswer}
                </p>
              </div>

              {item.explanation ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => toggleExplanation(item.questionId)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-purple"
                  >
                    {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {open ? "Hide Explanation" : "Show Explanation"}
                  </button>
                  {open ? (
                    <p className="mt-2 rounded-lg border border-brand-purple/20 bg-brand-purple/5 px-3 py-2 text-sm text-slate-700">
                      {item.explanation}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="mt-6">
        <Link
          href="/dashboard/student/progress"
          className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-brand-purple to-brand-teal px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-white shadow-lg shadow-brand-purple/30"
        >
          See What Needs To Improve
        </Link>
      </div>
    </section>
  );
}
