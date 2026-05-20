"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QuestionNavPanel from "@/components/test-engine/question-nav-panel";
import InstantResultView from "@/components/test-engine/instant-result-view";
import MultipleChoice from "@/components/test-engine/question-types/multiple-choice";
import TrueFalseNg from "@/components/test-engine/question-types/true-false-ng";
import YesNoNg from "@/components/test-engine/question-types/yes-no-ng";
import FillBlank from "@/components/test-engine/question-types/fill-blank";
import ShortAnswer from "@/components/test-engine/question-types/short-answer";
import MatchingHeadings from "@/components/test-engine/question-types/matching-headings";
import SentenceCompletion from "@/components/test-engine/question-types/sentence-completion";
import SummaryCompletion from "@/components/test-engine/question-types/summary-completion";

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
    | "MATCHING_HEADINGS"
    | "MATCHING_INFORMATION"
    | "SENTENCE_COMPLETION"
    | "SUMMARY_COMPLETION"
    | "SHORT_ANSWER";
  order: number;
  questionText: string;
  questionContext?: string | null;
  options?: Option[];
};

type Section = {
  id: string;
  title: string;
  passage?: string | null;
  sourcePassageId?: string | null;
  media?: Array<{
    id: string;
    type: "IMAGE" | "AUDIO";
    url: string;
    label?: string | null;
    order: number;
  }>;
  questions: Question[];
};

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

type ReadingTestEngineProps = {
  attemptId: string;
};

const TEST_DURATION_SECONDS = 60 * 60;

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

function normalizeAnswer(
  value: string | Record<string, string> | undefined,
): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join("|");
}

export default function ReadingTestEngine({
  attemptId,
}: ReadingTestEngineProps) {
  const router = useRouter();
  const storageKey = `ielts-reading-attempt:${attemptId}`;

  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<
    Record<string, string | Record<string, string>>
  >({});
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [activeQuestionId, setActiveQuestionId] = useState<string | undefined>(
    undefined,
  );

  const [secondsLeft, setSecondsLeft] = useState(TEST_DURATION_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EvalPayload | null>(null);

  const allQuestions = useMemo(
    () => sections.flatMap((section) => section.questions),
    [sections],
  );

  useEffect(() => {
    let active = true;

    fetch(`/api/attempts/${attemptId}/test`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load reading test");
        const data = (await res.json()) as { sections?: Section[] };
        if (!active) return;
        const nextSections = Array.isArray(data.sections) ? data.sections : [];
        setSections(nextSections);

        const firstQuestionId = nextSections[0]?.questions[0]?.id;
        if (firstQuestionId) {
          setActiveQuestionId(firstQuestionId);
          setVisited((prev) => ({ ...prev, [firstQuestionId]: true }));
        }

        const cached = localStorage.getItem(storageKey);
        if (cached) {
          const parsed = JSON.parse(cached) as {
            answers?: Record<string, string | Record<string, string>>;
            visited?: Record<string, boolean>;
            marked?: Record<string, boolean>;
            secondsLeft?: number;
          };
          if (parsed.answers) setAnswers(parsed.answers);
          if (parsed.visited) setVisited(parsed.visited);
          if (parsed.marked) setMarked(parsed.marked);
          if (typeof parsed.secondsLeft === "number") {
            setSecondsLeft(Math.max(0, parsed.secondsLeft));
          }
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Unable to load reading test",
        );
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [attemptId, storageKey]);

  useEffect(() => {
    if (loading || result) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, result]);

  useEffect(() => {
    if (secondsLeft !== 0 || result || loading || submitting) return;
    void handleSubmit();
  }, [secondsLeft, result, loading, submitting]);

  useEffect(() => {
    if (loading || result) return;
    const saver = setInterval(() => {
      const snapshot = {
        answers,
        visited,
        marked,
        secondsLeft,
      };
      localStorage.setItem(storageKey, JSON.stringify(snapshot));
    }, 30000);

    return () => clearInterval(saver);
  }, [answers, visited, marked, secondsLeft, loading, result, storageKey]);

  function jumpToQuestion(questionId: string) {
    setActiveQuestionId(questionId);
    setVisited((prev) => ({ ...prev, [questionId]: true }));

    const node = document.getElementById(`question-${questionId}`);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function toggleReview(questionId: string) {
    setMarked((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  }

  function updateAnswer(
    questionId: string,
    value: string | Record<string, string>,
  ) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setVisited((prev) => ({ ...prev, [questionId]: true }));
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const answerRows = allQuestions.map((question) => ({
        questionId: question.id,
        givenAnswer: normalizeAnswer(answers[question.id]),
      }));

      const saveRes = await fetch(`/api/attempts/${attemptId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answerRows }),
      });

      if (!saveRes.ok) {
        const payload = (await saveRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "Failed to save answers");
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
        throw new Error(parts.join("\n") || "Failed to evaluate test");
      }

      setResult(evalData);
      localStorage.removeItem(storageKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-600">Loading reading test...</div>
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

  const navItems = allQuestions.map((question, idx) => {
    const rawValue = answers[question.id];
    const answered =
      typeof rawValue === "string"
        ? rawValue.trim().length > 0
        : rawValue
          ? Object.values(rawValue).some((v) => String(v).trim().length > 0)
          : false;

    return {
      id: question.id,
      number: idx + 1,
      visited: Boolean(visited[question.id]),
      answered,
      markedForReview: Boolean(marked[question.id]),
    };
  });

  return (
    <div className="min-h-screen space-y-4 bg-[#f7f8f5] p-3 text-slate-900 sm:p-4">
      <div className="sticky top-0 z-20 rounded-[1.5rem] border border-slate-200/80 bg-white/95 p-3 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.7)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              IELTS Reading
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              Split passage workspace
            </p>
          </div>
          <div
            className={[
              "rounded-2xl px-4 py-2 text-sm font-semibold tabular-nums",
              secondsLeft < 300
                ? "bg-rose-100 text-rose-700"
                : "bg-slate-100 text-slate-700",
            ].join(" ")}
          >
            Time Left: {formatTime(secondsLeft)}
          </div>

          <div className="hidden flex-wrap gap-2 md:flex">
            {navItems.slice(0, 12).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => jumpToQuestion(item.id)}
                className={[
                  "h-8 w-8 rounded-full text-xs font-bold transition hover:scale-105",
                  item.answered
                    ? "bg-emerald-500 text-white"
                    : item.visited
                      ? "bg-amber-400 text-slate-900"
                      : "bg-slate-200 text-slate-700",
                ].join(" ")}
              >
                {item.number}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-2xl bg-gradient-to-r from-slate-900 to-teal-800 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 disabled:cursor-not-allowed disabled:opacity-70"
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

      <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="h-[calc(100vh-150px)] overflow-y-auto rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_70px_-48px_rgba(15,23,42,0.75)]">
          <div className="sticky -top-5 z-10 -mx-5 mb-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Reading document
            </p>
            <h2 className="mt-1 text-xl font-display tracking-tight text-slate-950">
              Passages 1-3
            </h2>
          </div>

          <div className="space-y-10">
            {sections.map((section, index) => (
              <article
                key={section.id}
                className="border-b border-slate-100 pb-10 last:border-b-0 last:pb-0"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-teal-dark">
                  Passage {index + 1}
                </p>
                <h3 className="mt-2 text-2xl font-display tracking-tight text-slate-950">
                  {section.title}
                </h3>

                {section.media?.filter((item) => item.type === "IMAGE").length ? (
                  <div className="my-5 grid gap-3">
                    {section.media
                      ?.filter((item) => item.type === "IMAGE")
                      .map((image) => (
                        <figure key={image.id} className="rounded-2xl bg-slate-50 p-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.url}
                            alt={image.label || `${section.title} visual`}
                            className="max-h-96 w-full rounded-xl object-contain"
                            loading="lazy"
                          />
                          {image.label ? (
                            <figcaption className="mt-2 text-xs text-slate-500">
                              {image.label}
                            </figcaption>
                          ) : null}
                        </figure>
                      ))}
                  </div>
                ) : null}

                <div className="mt-5 whitespace-pre-line text-[15px] leading-8 text-slate-700">
                  {section.passage || "No passage text available."}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="h-[calc(100vh-150px)] space-y-4 overflow-y-auto rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_70px_-48px_rgba(15,23,42,0.75)]">
          <div className="sticky -top-5 z-10 -mx-5 mb-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Questions
            </p>
            <h2 className="mt-1 text-xl font-display tracking-tight text-slate-950">
              Answer workspace
            </h2>
          </div>
          {sections.map((section) => (
            <div key={section.id} className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900">
                {section.title}
              </h3>

              {section.questions.map((question) => {
                const value = answers[question.id];
                const stringValue = typeof value === "string" ? value : "";
                const mapValue =
                  typeof value === "object" && value
                    ? value
                    : ({} as Record<string, string>);

                return (
                  <div key={question.id} id={`question-${question.id}`}>
                    {question.type === "MULTIPLE_CHOICE" ? (
                      <MultipleChoice
                        questionId={question.id}
                        questionText={question.questionText}
                        options={question.options || []}
                        value={stringValue}
                        onChange={(v) => updateAnswer(question.id, v)}
                      />
                    ) : null}

                    {question.type === "TRUE_FALSE_NOT_GIVEN" ? (
                      <TrueFalseNg
                        questionId={question.id}
                        questionText={question.questionText}
                        value={
                          stringValue as
                            | "TRUE"
                            | "FALSE"
                            | "NOT_GIVEN"
                            | undefined
                        }
                        onChange={(v) => updateAnswer(question.id, v)}
                      />
                    ) : null}

                    {question.type === "YES_NO_NOT_GIVEN" ? (
                      <YesNoNg
                        questionId={question.id}
                        questionText={question.questionText}
                        value={
                          stringValue as "YES" | "NO" | "NOT_GIVEN" | undefined
                        }
                        onChange={(v) => updateAnswer(question.id, v)}
                      />
                    ) : null}

                    {question.type === "FILL_IN_BLANK" ? (
                      <FillBlank
                        questionId={question.id}
                        questionText={question.questionText}
                        value={stringValue}
                        onChange={(v) => updateAnswer(question.id, v)}
                      />
                    ) : null}

                    {question.type === "SHORT_ANSWER" ? (
                      <ShortAnswer
                        questionId={question.id}
                        questionText={question.questionText}
                        value={stringValue}
                        onChange={(v) => updateAnswer(question.id, v)}
                      />
                    ) : null}

                    {question.type === "MATCHING_HEADINGS" ||
                    question.type === "MATCHING_INFORMATION" ? (
                      <MatchingHeadings
                        questionId={question.id}
                        items={[
                          {
                            id: `${question.id}-a`,
                            label: "A",
                            text: question.questionText,
                          },
                        ]}
                        options={(question.options || []).map((opt) => ({
                          value: opt.label,
                          label: `${opt.label}. ${opt.text}`,
                        }))}
                        value={mapValue}
                        onChange={(v) => updateAnswer(question.id, v)}
                      />
                    ) : null}

                    {question.type === "SENTENCE_COMPLETION" ? (
                      <SentenceCompletion
                        questionId={question.id}
                        sentence={question.questionText}
                        value={stringValue}
                        onChange={(v) => updateAnswer(question.id, v)}
                      />
                    ) : null}

                    {question.type === "SUMMARY_COMPLETION" ? (
                      <SummaryCompletion
                        questionId={question.id}
                        summaryText={question.questionText}
                        value={stringValue}
                        onChange={(v) => updateAnswer(question.id, v)}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      </div>

      <QuestionNavPanel
        items={navItems}
        activeQuestionId={activeQuestionId}
        onJump={jumpToQuestion}
        onToggleReview={toggleReview}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => router.push("/dashboard/student/progress")}
          className="rounded-xl border border-brand-purple/25 px-4 py-2 text-sm font-semibold text-brand-purple"
        >
          View Progress Dashboard
        </button>
      </div>
    </div>
  );
}
