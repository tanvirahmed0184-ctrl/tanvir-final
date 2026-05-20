"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type GeneratedQuestion = {
  id: string;
  question_text: string;
  question_type: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_answer: string;
  explanation?: string;
  approved: boolean;
};

type TestOption = {
  id: string;
  title: string;
};

const DEFAULT_TESTS: TestOption[] = [
  { id: "demo-reading-1", title: "Reading Practice Set 1" },
  { id: "demo-listening-1", title: "Listening Mock 1" },
];

export default function AdminTestGeneratorPage() {
  const [topicOrPassage, setTopicOrPassage] = useState("");
  const [questionType, setQuestionType] = useState("MIXED");
  const [questionCount, setQuestionCount] = useState(5);
  const [testId, setTestId] = useState("");

  const [tests, setTests] = useState<TestOption[]>(DEFAULT_TESTS);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/tests", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch tests");
        const data = (await res.json()) as {
          tests?: Array<{ id: string; title: string }>;
        };
        if (!active) return;
        const mapped = (data.tests || []).map((t) => ({
          id: t.id,
          title: t.title,
        }));
        setTests(mapped.length ? mapped : DEFAULT_TESTS);
        if (!testId) setTestId((mapped[0] || DEFAULT_TESTS[0]).id);
      })
      .catch(() => {
        if (!active) return;
        setTests(DEFAULT_TESTS);
        if (!testId) setTestId(DEFAULT_TESTS[0].id);
      });

    return () => {
      active = false;
    };
  }, [testId]);

  const approvedCount = useMemo(
    () => questions.filter((q) => q.approved).length,
    [questions],
  );

  async function generateQuestions(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!topicOrPassage.trim()) {
      setMessage("Please provide a passage or topic.");
      return;
    }

    if (!testId) {
      setMessage("Please select a target test.");
      return;
    }

    setLoadingGenerate(true);

    try {
      const res = await fetch("/api/admin/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: topicOrPassage,
          questionType,
          count: questionCount,
          testId,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        questions?: Omit<GeneratedQuestion, "approved">[];
        error?: string;
      } | null;

      if (!res.ok) {
        throw new Error(data?.error || "Generation failed");
      }

      const rows = (data?.questions || []).map((q, idx) => ({
        id: q.id || `generated-${idx}-${Date.now()}`,
        question_text: q.question_text,
        question_type: q.question_type,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        approved: true,
      }));

      setQuestions(rows);
      setMessage(`Generated ${rows.length} questions.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Generation failed");
      setQuestions([]);
    } finally {
      setLoadingGenerate(false);
    }
  }

  function setApproved(id: string, approved: boolean) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, approved } : q)),
    );
  }

  async function saveApproved() {
    const approved = questions.filter((q) => q.approved);

    if (!approved.length) {
      setMessage("No approved questions selected.");
      return;
    }

    setLoadingSave(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/questions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, rows: approved }),
      });

      const data = (await res.json().catch(() => null)) as {
        inserted?: number;
        error?: string;
      } | null;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save approved questions");
      }

      setMessage(
        `Saved ${data?.inserted || approved.length} approved questions.`,
      );
      setQuestions([]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoadingSave(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-text">AI Question Generator</h1>
        <p className="mt-1 text-sm text-dash-text-muted">Generate IELTS-style questions from a topic or passage and save
          approved items.</p>
      </div>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <form onSubmit={generateQuestions} className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-[13px] font-medium text-dash-text">
              Passage or Topic
            </span>
            <textarea
              value={topicOrPassage}
              onChange={(e) => setTopicOrPassage(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm outline-none focus:border-dash-accent focus:ring-2 focus:ring-dash-accent/10"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block text-[13px] font-medium text-dash-text">
                Question Type
              </span>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value)}
                className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
              >
                <option value="MULTIPLE_CHOICE">MCQ</option>
                <option value="TRUE_FALSE_NOT_GIVEN">
                  True/False/Not Given
                </option>
                <option value="FILL_IN_BLANK">Fill in Blank</option>
                <option value="MIXED">Mixed</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-[13px] font-medium text-dash-text">
                Number of Questions
              </span>
              <input
                type="number"
                min={1}
                max={20}
                value={questionCount}
                onChange={(e) =>
                  setQuestionCount(
                    Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                  )
                }
                className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-[13px] font-medium text-dash-text">
                Add to Test
              </span>
              <select
                value={testId}
                onChange={(e) => setTestId(e.target.value)}
                className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
              >
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={loadingGenerate}
            className="rounded-lg bg-dash-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-dash-accent-muted disabled:opacity-60"
          >
            {loadingGenerate ? "Generating..." : "Generate with AI"}
          </button>
        </form>
      </section>

      {message ? (
        <section className="rounded-lg border border-dash-border bg-dash-accent-light px-4 py-3 text-sm text-dash-text">
          {message}
        </section>
      ) : null}

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
            Generated Questions Preview
          </h2>
          <button
            type="button"
            onClick={saveApproved}
            disabled={!approvedCount || loadingSave}
            className="rounded-lg bg-dash-accent-muted px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {loadingSave ? "Saving..." : `Save Approved (${approvedCount})`}
          </button>
        </div>

        {questions.length ? (
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <article
                key={q.id}
                className="rounded-xl border border-dash-border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-dash-accent">
                    Q{idx + 1} - {q.question_type}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setApproved(q.id, true)}
                      className={[
                        "rounded-lg px-2 py-1 text-xs font-semibold",
                        q.approved
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-dash-bg text-dash-text-muted",
                      ].join(" ")}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setApproved(q.id, false)}
                      className={[
                        "rounded-lg px-2 py-1 text-xs font-semibold",
                        !q.approved
                          ? "bg-rose-100 text-rose-700"
                          : "bg-dash-bg text-dash-text-muted",
                      ].join(" ")}
                    >
                      Reject
                    </button>
                  </div>
                </div>

                <p className="mt-2 text-sm text-dash-text">{q.question_text}</p>
                <p className="mt-1 text-xs text-dash-text-muted">
                  Correct: {q.correct_answer}
                </p>
                {q.explanation ? (
                  <p className="mt-1 text-xs text-dash-text-muted">{q.explanation}</p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-dash-text-muted">No generated questions yet.</p>
        )}
      </section>
    </div>
  );
}
