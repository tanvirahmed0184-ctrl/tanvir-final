"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type QuestionType =
  | "MULTIPLE_CHOICE"
  | "FILL_IN_BLANK"
  | "TRUE_FALSE_NOT_GIVEN"
  | "YES_NO_NOT_GIVEN"
  | "MATCHING_HEADINGS"
  | "MATCHING_INFORMATION"
  | "SENTENCE_COMPLETION"
  | "SUMMARY_COMPLETION"
  | "SHORT_ANSWER";

type QuestionRow = {
  id: string;
  questionText: string;
  type: QuestionType;
  explanation?: string | null;
};

type CsvRow = {
  question_text: string;
  question_type: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string;
};

const QUESTION_TYPES: QuestionType[] = [
  "MULTIPLE_CHOICE",
  "FILL_IN_BLANK",
  "TRUE_FALSE_NOT_GIVEN",
  "YES_NO_NOT_GIVEN",
  "MATCHING_HEADINGS",
  "MATCHING_INFORMATION",
  "SENTENCE_COMPLETION",
  "SUMMARY_COMPLETION",
  "SHORT_ANSWER",
];

const TEMPLATE_HEADERS = [
  "question_text",
  "question_type",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_answer",
  "explanation",
];

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const header = lines[0].split(",").map((x) => x.trim().toLowerCase());
  const idx = TEMPLATE_HEADERS.map((key) => header.indexOf(key));

  if (idx.some((i) => i === -1)) {
    throw new Error("Invalid CSV columns. Please use the template.");
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",").map((x) => x.trim());
    rows.push({
      question_text: cols[idx[0]] || "",
      question_type: cols[idx[1]] || "",
      option_a: cols[idx[2]] || "",
      option_b: cols[idx[3]] || "",
      option_c: cols[idx[4]] || "",
      option_d: cols[idx[5]] || "",
      correct_answer: cols[idx[6]] || "",
      explanation: cols[idx[7]] || "",
    });
  }

  return rows;
}

export default function AdminQuestionManagerPage() {
  const params = useParams<{ testId: string }>();
  const testId = params?.testId || "";

  const [tab, setTab] = useState<"manual" | "csv">("manual");
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [questionType, setQuestionType] =
    useState<QuestionType>("MULTIPLE_CHOICE");
  const [questionText, setQuestionText] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [explanation, setExplanation] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctOption, setCorrectOption] = useState<"A" | "B" | "C" | "D">(
    "A",
  );

  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);

  const mcqEnabled = questionType === "MULTIPLE_CHOICE";

  useMemo(() => {
    if (!testId) return;
    setLoading(true);
    fetch(`/api/tests/${testId}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load test questions");
        const data = (await res.json()) as {
          test?: {
            sections?: Array<{ questions?: Array<QuestionRow> }>;
          };
        };

        const rows: QuestionRow[] =
          data.test?.sections?.flatMap((s) => s.questions || []) || [];
        setQuestions(rows);
      })
      .catch(() => {
        setQuestions([]);
      })
      .finally(() => setLoading(false));
  }, [testId]);

  async function addQuestion(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    const payload = {
      testId,
      question_type: questionType,
      question_text: questionText,
      correct_answer: mcqEnabled ? correctOption : correctAnswer,
      explanation,
      options: mcqEnabled
        ? [
            { label: "A", text: optionA, isCorrect: correctOption === "A" },
            { label: "B", text: optionB, isCorrect: correctOption === "B" },
            { label: "C", text: optionC, isCorrect: correctOption === "C" },
            { label: "D", text: optionD, isCorrect: correctOption === "D" },
          ]
        : [],
    };

    const res = await fetch("/api/admin/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => null)) as {
      question?: QuestionRow;
      error?: string;
    } | null;

    if (!res.ok || !data?.question) {
      setMessage(data?.error || "Failed to add question.");
      return;
    }

    setQuestions((prev) => [data.question!, ...prev]);
    setQuestionText("");
    setCorrectAnswer("");
    setExplanation("");
    setOptionA("");
    setOptionB("");
    setOptionC("");
    setOptionD("");
    setCorrectOption("A");
    setMessage("Question added successfully.");
  }

  function downloadTemplate() {
    const sample =
      TEMPLATE_HEADERS.join(",") +
      "\n" +
      [
        "Sample question text",
        "MULTIPLE_CHOICE",
        "Option A",
        "Option B",
        "Option C",
        "Option D",
        "A",
        "Short explanation",
      ].join(",");

    const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "question_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onCsvFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    try {
      const rows = parseCsv(text);
      setCsvRows(rows);
      setMessage(`Loaded ${rows.length} rows from CSV.`);
    } catch (err) {
      setCsvRows([]);
      setMessage(err instanceof Error ? err.message : "Failed to parse CSV.");
    }
  }

  async function confirmCsvUpload() {
    if (!csvRows.length) return;
    setMessage(null);

    const previewRes = await fetch("/api/admin/upload-csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testId, rows: csvRows }),
    });

    const previewData = (await previewRes.json().catch(() => null)) as {
      rows?: CsvRow[];
      error?: string;
    } | null;

    if (!previewRes.ok) {
      setMessage(previewData?.error || "CSV validation failed.");
      return;
    }

    const saveRes = await fetch("/api/admin/questions/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testId, rows: previewData?.rows || csvRows }),
    });

    const saveData = (await saveRes.json().catch(() => null)) as {
      inserted?: number;
      error?: string;
    } | null;

    if (!saveRes.ok) {
      setMessage(saveData?.error || "Failed to save CSV questions.");
      return;
    }

    setMessage(
      `CSV import completed. Inserted ${saveData?.inserted || 0} questions.`,
    );
    setCsvRows([]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-text">Question Manager</h1>
        <p className="mt-1 text-sm text-dash-text-muted">Test ID: {testId || "N/A"}</p>
      </div>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("manual")}
            className={[
              "rounded-lg px-4 py-2 text-sm font-medium",
              tab === "manual"
                ? "bg-dash-accent text-white"
                : "bg-dash-bg text-dash-text",
            ].join(" ")}
          >
            Add Question
          </button>
          <button
            type="button"
            onClick={() => setTab("csv")}
            className={[
              "rounded-lg px-4 py-2 text-sm font-medium",
              tab === "csv"
                ? "bg-dash-accent-muted text-white"
                : "bg-dash-bg text-dash-text",
            ].join(" ")}
          >
            CSV Upload
          </button>
        </div>

        {message ? (
          <div className="mb-3 rounded-lg border border-dash-border bg-dash-accent-light px-4 py-3 text-sm text-dash-text">
            {message}
          </div>
        ) : null}

        {tab === "manual" ? (
          <form onSubmit={addQuestion} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Question Type">
                <select
                  value={questionType}
                  onChange={(e) =>
                    setQuestionType(e.target.value as QuestionType)
                  }
                  className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
                >
                  {QUESTION_TYPES.map((qt) => (
                    <option key={qt} value={qt}>
                      {qt}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Correct Answer">
                <input
                  value={mcqEnabled ? correctOption : correctAnswer}
                  onChange={(e) =>
                    mcqEnabled
                      ? setCorrectOption(
                          e.target.value as "A" | "B" | "C" | "D",
                        )
                      : setCorrectAnswer(e.target.value)
                  }
                  className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <Field label="Question Text">
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                rows={3}
                required
                className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Explanation">
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
              />
            </Field>

            {mcqEnabled ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Option A">
                  <input
                    value={optionA}
                    onChange={(e) => setOptionA(e.target.value)}
                    className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Option B">
                  <input
                    value={optionB}
                    onChange={(e) => setOptionB(e.target.value)}
                    className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Option C">
                  <input
                    value={optionC}
                    onChange={(e) => setOptionC(e.target.value)}
                    className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Option D">
                  <input
                    value={optionD}
                    onChange={(e) => setOptionD(e.target.value)}
                    className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
                  />
                </Field>
              </div>
            ) : null}

            <button
              type="submit"
              className="rounded-lg bg-dash-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-dash-accent-muted disabled:opacity-60"
            >
              Add Question
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={downloadTemplate}
                className="rounded-lg border border-dash-border px-4 py-2 text-sm font-semibold text-dash-text"
              >
                Download Template
              </button>
              <input
                type="file"
                accept=".csv"
                onChange={onCsvFile}
                className="text-sm"
              />
              <button
                type="button"
                onClick={confirmCsvUpload}
                disabled={!csvRows.length}
                className="rounded-lg bg-dash-accent-muted px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
              >
                Confirm Upload
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-dash-border">
              <table className="min-w-full divide-y divide-dash-border text-sm">
                <thead className="bg-dash-bg">
                  <tr>
                    {TEMPLATE_HEADERS.map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-xs uppercase tracking-wide text-dash-text-muted"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-dash-border bg-dash-surface">
                  {csvRows.length ? (
                    csvRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">{row.question_text}</td>
                        <td className="px-3 py-2">{row.question_type}</td>
                        <td className="px-3 py-2">{row.option_a}</td>
                        <td className="px-3 py-2">{row.option_b}</td>
                        <td className="px-3 py-2">{row.option_c}</td>
                        <td className="px-3 py-2">{row.option_d}</td>
                        <td className="px-3 py-2">{row.correct_answer}</td>
                        <td className="px-3 py-2">{row.explanation}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        className="px-3 py-6 text-center text-sm text-dash-text-muted"
                        colSpan={8}
                      >
                        Upload a CSV file to preview rows.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
          Existing Questions
        </h2>

        {loading ? (
          <div className="mt-3 h-32 animate-pulse rounded-xl bg-dash-border/50" />
        ) : (
          <div className="mt-3 space-y-2">
            {questions.length ? (
              questions.map((q) => (
                <article
                  key={q.id}
                  className="rounded-xl border border-dash-border p-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-dash-accent">
                    {q.type}
                  </p>
                  <p className="mt-1 text-sm text-dash-text">
                    {q.questionText}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-sm text-dash-text-muted">
                No questions found for this test yet.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-[13px] font-medium text-dash-text">
        {label}
      </span>
      {children}
    </label>
  );
}
