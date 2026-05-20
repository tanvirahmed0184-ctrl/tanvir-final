"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Sparkles } from "lucide-react";

type WritingEvaluation = {
  taskAchievement: number;
  coherenceCohesion: number;
  lexicalResource: number;
  grammaticalRange: number;
  overallBand: number;
  strengths: string[];
  weaknesses: string[];
  corrections: Array<{
    original: string;
    corrected: string;
    explanation: string;
  }>;
  vocabularySuggestions: Array<{
    original: string;
    suggested: string;
    context: string;
  }>;
  sampleRewrite: string;
  examinerSummary: string;
};

type WritingTestEngineProps = {
  attemptId: string;
  task1PromptId?: string;
  task2PromptId?: string;
  task1ImageUrl?: string;
  task2ImageUrl?: string;
  writingDurationMins?: number;
  task1AttemptId?: string;
  task2AttemptId?: string;
  writingTestAttemptId?: string;
};

const DEFAULT_TASK_1_PROMPT =
  "The chart below shows the percentage of households by housing type in a European country from 2000 to 2020. Summarize the information by selecting and reporting the main features.";

const DEFAULT_TASK_2_PROMPT =
  "Some people believe that unpaid community service should be a compulsory part of high school programs. To what extent do you agree or disagree?";

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function scoreBadge(score: number): string {
  if (score >= 7) return "bg-emerald-100 text-emerald-700";
  if (score >= 6) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

function formatDuration(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const mins = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(clamped % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

export default function WritingTestEngine({
  attemptId,
  task1PromptId = "",
  task2PromptId = "",
  task1ImageUrl = "",
  task2ImageUrl = "",
  writingDurationMins = 60,
  task1AttemptId = "",
  task2AttemptId = "",
  writingTestAttemptId = "",
}: WritingTestEngineProps) {
  const resolvedTask1AttemptId = task1AttemptId || attemptId;
  const resolvedTask2AttemptId = task2AttemptId || attemptId;
  const storageKey = `ielts-writing-attempt:${resolvedTask1AttemptId}:${resolvedTask2AttemptId}`;

  const [task1Prompt, setTask1Prompt] = useState(DEFAULT_TASK_1_PROMPT);
  const [task2Prompt, setTask2Prompt] = useState(DEFAULT_TASK_2_PROMPT);
  const [task1PromptImage, setTask1PromptImage] = useState(task1ImageUrl);
  const [task2PromptImage, setTask2PromptImage] = useState(task2ImageUrl);
  const [task1Type, setTask1Type] = useState<
    "TASK_1_ACADEMIC" | "TASK_1_GENERAL"
  >("TASK_1_ACADEMIC");
  const [task2Type, setTask2Type] = useState<"TASK_2">("TASK_2");
  const [task1Essay, setTask1Essay] = useState("");
  const [task2Essay, setTask2Essay] = useState("");
  const initialDurationSecs = useMemo(
    () => Math.max(10, Math.round(writingDurationMins || 60)) * 60,
    [writingDurationMins],
  );
  const [remainingSecs, setRemainingSecs] = useState(initialDurationSecs);
  const autoSubmittedRef = useRef(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [task1Eval, setTask1Eval] = useState<WritingEvaluation | null>(null);
  const [task2Eval, setTask2Eval] = useState<WritingEvaluation | null>(null);
  const [persistedFinalBand, setPersistedFinalBand] = useState<number | null>(
    null,
  );
  const [leavePromptOpen, setLeavePromptOpen] = useState(false);

  const task1Words = useMemo(() => countWords(task1Essay), [task1Essay]);
  const task2Words = useMemo(() => countWords(task2Essay), [task2Essay]);
  const overallWritingBand = useMemo(() => {
    if (!task1Eval || !task2Eval) return null;
    const weighted = (task1Eval.overallBand + task2Eval.overallBand * 2) / 3;
    return Math.round(weighted * 2) / 2;
  }, [task1Eval, task2Eval]);
  const finalBandToShow = persistedFinalBand ?? overallWritingBand;

  useEffect(() => {
    autoSubmittedRef.current = false;
    setRemainingSecs(initialDurationSecs);

    const cached = localStorage.getItem(storageKey);
    if (!cached) return;

    try {
      const data = JSON.parse(cached) as {
        task1Essay?: string;
        task2Essay?: string;
        remainingSecs?: number;
      };
      if (typeof data.task1Essay === "string") setTask1Essay(data.task1Essay);
      if (typeof data.task2Essay === "string") setTask2Essay(data.task2Essay);
      if (Number.isFinite(data.remainingSecs)) {
        setRemainingSecs(Math.max(0, Number(data.remainingSecs)));
      }
    } catch {
      // Ignore invalid local data.
    }
  }, [storageKey, initialDurationSecs]);

  useEffect(() => {
    if (task1ImageUrl) setTask1PromptImage(task1ImageUrl);
    if (task2ImageUrl) setTask2PromptImage(task2ImageUrl);
  }, [task1ImageUrl, task2ImageUrl]);

  useEffect(() => {
    const ids = [task1PromptId, task2PromptId].filter(Boolean);
    if (!ids.length) return;

    fetch(`/api/writing/prompts?ids=${ids.join(",")}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json().catch(() => null)) as {
          prompts?: Array<{
            id: string;
            promptText: string;
            taskType: "TASK_1_ACADEMIC" | "TASK_1_GENERAL" | "TASK_2";
            imageUrl?: string | null;
          }>;
        } | null;
        return data?.prompts || [];
      })
      .then((rows) => {
        if (!rows?.length) return;
        const task1 =
          rows.find((p) => p.id === task1PromptId) ||
          rows.find((p) => p.taskType !== "TASK_2");
        const task2 =
          rows.find((p) => p.id === task2PromptId) ||
          rows.find((p) => p.taskType === "TASK_2");

        if (task1?.promptText) {
          setTask1Prompt(task1.promptText);
          setTask1PromptImage(task1ImageUrl || task1.imageUrl || "");
          setTask1Type(
            task1.taskType === "TASK_1_GENERAL"
              ? "TASK_1_GENERAL"
              : "TASK_1_ACADEMIC",
          );
        }
        if (task2?.promptText) {
          setTask2Prompt(task2.promptText);
          setTask2PromptImage(task2ImageUrl || task2.imageUrl || "");
          setTask2Type("TASK_2");
        }
      })
      .catch(() => {
        // Keep defaults if mapped prompts fail to load.
      });
  }, [task1PromptId, task2PromptId, task1ImageUrl, task2ImageUrl]);

  useEffect(() => {
    const saver = setInterval(() => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          task1Essay,
          task2Essay,
          remainingSecs,
        }),
      );
    }, 30000);

    return () => clearInterval(saver);
  }, [storageKey, task1Essay, task2Essay, remainingSecs]);

  const submitWriting = useCallback(
    async (source: "manual" | "timeout" = "manual") => {
      if (!resolvedTask1AttemptId || !resolvedTask2AttemptId) {
        setError("Missing attempt ID.");
        return;
      }

      if (!task1Essay.trim() || !task2Essay.trim()) {
        setError(
          source === "timeout"
            ? "Time is over. Please complete both tasks, then submit."
            : "Please complete both Task 1 and Task 2 before submission.",
        );
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        const [task1Res, task2Res] = await Promise.all([
          fetch("/api/evaluate/writing", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attemptId: resolvedTask1AttemptId,
              taskType: task1Type,
              promptText: task1Prompt,
              essay: task1Essay,
              wordCount: task1Words,
            }),
          }),
          fetch("/api/evaluate/writing", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attemptId: resolvedTask2AttemptId,
              taskType: task2Type,
              promptText: task2Prompt,
              essay: task2Essay,
              wordCount: task2Words,
            }),
          }),
        ]);

        const task1Data = (await task1Res.json().catch(() => null)) as {
          evaluation?: WritingEvaluation;
          error?: string;
        } | null;
        const task2Data = (await task2Res.json().catch(() => null)) as {
          evaluation?: WritingEvaluation;
          error?: string;
        } | null;

        if (!task1Res.ok || !task1Data?.evaluation) {
          throw new Error(task1Data?.error || "Task 1 evaluation failed");
        }
        if (!task2Res.ok || !task2Data?.evaluation) {
          throw new Error(task2Data?.error || "Task 2 evaluation failed");
        }

        setTask1Eval(task1Data.evaluation);
        setTask2Eval(task2Data.evaluation);

        const finalizeRes = await fetch("/api/evaluate/writing/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task1AttemptId: resolvedTask1AttemptId,
            task2AttemptId: resolvedTask2AttemptId,
            writingTestAttemptId: writingTestAttemptId || null,
          }),
        });

        const finalizeData = (await finalizeRes.json().catch(() => null)) as {
          finalOverallBand?: number;
        } | null;

        if (finalizeRes.ok && Number.isFinite(finalizeData?.finalOverallBand)) {
          setPersistedFinalBand(Number(finalizeData?.finalOverallBand));
        }

        localStorage.removeItem(storageKey);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to evaluate writing",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      resolvedTask1AttemptId,
      resolvedTask2AttemptId,
      storageKey,
      task1Essay,
      task2Essay,
      task1Type,
      task2Type,
      task1Prompt,
      task2Prompt,
      task1Words,
      task2Words,
      writingTestAttemptId,
    ],
  );

  useEffect(() => {
    if (task1Eval || task2Eval || submitting) return;
    if (remainingSecs <= 0) {
      if (!autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        void submitWriting("timeout");
      }
      return;
    }

    const timer = setInterval(() => {
      setRemainingSecs((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSecs, submitting, task1Eval, task2Eval, submitWriting]);

  useEffect(() => {
    if (task1Eval || task2Eval) return;
    window.history.pushState({ examGuard: "writing" }, "", window.location.href);
    const onPopState = () => {
      if (submitting || task1Eval || task2Eval) return;
      window.history.pushState({ examGuard: "writing" }, "", window.location.href);
      setLeavePromptOpen(true);
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (submitting || task1Eval || task2Eval) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [submitting, task1Eval, task2Eval]);

  return (
    <div className="min-h-screen space-y-5 bg-[#f7f8f5] p-3 text-slate-900 sm:p-4">
      <section className="sticky top-0 z-20 rounded-[1.5rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.7)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              IELTS Writing
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              Split prompt and response workspace
            </p>
          </div>

          <div
            className={[
              "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-lg font-black tabular-nums",
              remainingSecs <= 300
                ? "border-rose-300 bg-rose-50 text-rose-700"
                : remainingSecs <= 900
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-brand-purple/20 bg-brand-purple/5 text-brand-purple",
            ].join(" ")}
          >
            <Clock3 size={18} />
            {formatDuration(remainingSecs)}
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_70px_-48px_rgba(15,23,42,0.75)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Task 1 (Recommended 20 mins)
          </h2>
          <span
            className={[
              "rounded-full px-3 py-1 text-xs font-semibold",
              task1Words >= 150
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700",
            ].join(" ")}
          >
            {task1Words} words (min 150)
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="max-h-[calc(100vh-230px)] overflow-y-auto rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Prompt
            </p>
            <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">
              <p className="whitespace-pre-line">{task1Prompt}</p>
            </div>
            {task1PromptImage ? (
              <img
                src={task1PromptImage}
                alt="Task 1 visual"
                className="mt-3 max-h-56 w-full rounded-lg border border-slate-200 object-contain"
              />
            ) : null}
          </div>

          <div className="max-h-[calc(100vh-230px)] overflow-y-auto rounded-[1.35rem] border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Your Response
            </p>
            <textarea
              value={task1Essay}
              onChange={(e) => setTask1Essay(e.target.value)}
              placeholder="Write Task 1 response here..."
              className="mt-2 h-[calc(100vh-330px)] min-h-72 w-full resize-none rounded-2xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-base leading-7 text-slate-800 outline-none transition focus:border-brand-teal focus:bg-white focus:ring-2 focus:ring-brand-teal/20"
            />
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_70px_-48px_rgba(15,23,42,0.75)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Task 2 (Recommended 40 mins)
          </h2>
          <span
            className={[
              "rounded-full px-3 py-1 text-xs font-semibold",
              task2Words >= 250
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700",
            ].join(" ")}
          >
            {task2Words} words (min 250)
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="max-h-[calc(100vh-230px)] overflow-y-auto rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Prompt
            </p>
            <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-800">
              <p className="whitespace-pre-line">{task2Prompt}</p>
            </div>
            {task2PromptImage ? (
              <img
                src={task2PromptImage}
                alt="Task 2 visual"
                className="mt-3 max-h-56 w-full rounded-2xl border border-slate-200 object-contain"
              />
            ) : null}
          </div>

          <div className="max-h-[calc(100vh-230px)] overflow-y-auto rounded-[1.35rem] border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Your Response
            </p>
            <textarea
              value={task2Essay}
              onChange={(e) => setTask2Essay(e.target.value)}
              placeholder="Write Task 2 response here..."
              className="mt-2 h-[calc(100vh-330px)] min-h-80 w-full resize-none rounded-2xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-base leading-7 text-slate-800 outline-none transition focus:border-brand-teal focus:bg-white focus:ring-2 focus:ring-brand-teal/20"
            />
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <p className="inline-flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5" />
            {error}
          </p>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            void submitWriting("manual");
          }}
          disabled={submitting}
          className="rounded-2xl bg-gradient-to-r from-slate-900 to-teal-800 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Evaluating..." : "Submit for AI Evaluation"}
        </button>
      </div>

      {task1Eval || task2Eval ? (
        <section className="space-y-4 rounded-2xl border border-brand-purple/20 bg-white p-5 shadow-sm">
          <h3 className="inline-flex items-center gap-2 text-lg font-bold text-slate-900">
            <Sparkles size={18} className="text-brand-purple" />
            AI Evaluation Result
          </h3>

          {finalBandToShow !== null ? (
            <div className="rounded-xl border border-brand-purple/20 bg-brand-purple/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">
                Final Writing Band (IELTS Weighted)
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {finalBandToShow.toFixed(1)}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Computed as (Task 1 + 2 x Task 2) / 3, rounded to nearest 0.5.
              </p>
            </div>
          ) : null}

          {[
            { label: "Task 1", eval: task1Eval },
            { label: "Task 2", eval: task2Eval },
          ].map((entry) =>
            entry.eval ? (
              <article
                key={entry.label}
                className="rounded-xl border border-slate-200 p-4"
              >
                <h4 className="mb-3 text-base font-semibold text-slate-900">
                  {entry.label}
                </h4>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    ["Task", entry.eval.taskAchievement],
                    ["Coherence", entry.eval.coherenceCohesion],
                    ["Lexical", entry.eval.lexicalResource],
                    ["Grammar", entry.eval.grammaticalRange],
                    ["Overall", entry.eval.overallBand],
                  ].map(([label, score]) => (
                    <div
                      key={label}
                      className={[
                        "rounded-lg px-3 py-2 text-sm",
                        scoreBadge(Number(score)),
                      ].join(" ")}
                    >
                      <p className="text-xs font-semibold uppercase">{label}</p>
                      <p className="text-lg font-bold">
                        {Number(score).toFixed(1)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Strengths
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-emerald-800">
                      {entry.eval.strengths.map((s) => (
                        <li key={s} className="inline-flex items-start gap-2">
                          <CheckCircle2 size={14} className="mt-0.5" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Weaknesses
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-amber-800">
                      {entry.eval.weaknesses.map((w) => (
                        <li key={w}>- {w}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {entry.eval.corrections.length ? (
                  <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2">Original</th>
                          <th className="px-3 py-2">Corrected</th>
                          <th className="px-3 py-2">Explanation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {entry.eval.corrections.map((row, idx) => (
                          <tr key={`${entry.label}-corr-${idx}`}>
                            <td className="px-3 py-2">{row.original}</td>
                            <td className="px-3 py-2">{row.corrected}</td>
                            <td className="px-3 py-2">{row.explanation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {entry.eval.sampleRewrite ? (
                  <div className="mt-4 rounded-lg border border-brand-purple/20 bg-brand-purple/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">
                      Improved Rewrite
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                      {entry.eval.sampleRewrite}
                    </p>
                  </div>
                ) : null}
              </article>
            ) : null,
          )}
        </section>
      ) : null}

      {leavePromptOpen ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-slate-950">
              Leave writing exam?
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Leaving now will submit your current writing responses for
              evaluation. Cancel to remain inside the exam.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setLeavePromptOpen(false)}
                className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Stay in exam
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeavePromptOpen(false);
                  void submitWriting("manual");
                }}
                className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
              >
                Submit exam
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
