"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { parseCsvRows, rowsToObjects } from "@/lib/csv";

type PassageOption = {
  id: string;
  title: string;
  module: "READING" | "LISTENING" | "WRITING" | "SPEAKING";
  sectionPart: number;
};

type BankRow = {
  id: string;
  questionText: string;
  type: string;
  module: string;
  sectionPart?: number | null;
  passageId?: string | null;
  createdAt: string;
  passage?: {
    id: string;
    title: string;
  } | null;
};

const TEMPLATE_HEADERS = [
  "question_text",
  "question_type",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_answer",
  "accepted_answers",
  "explanation",
  "module",
  "section_part",
  "passage_id",
  "difficulty",
  "points",
  "question_image_url",
  "question_audio_url",
  "passage_title",
];

const SAMPLE_ROW = [
  "According to the source, what is the best title?",
  "MULTIPLE_CHOICE",
  "A",
  "B",
  "C",
  "D",
  "B",
  "B|Option B",
  "Option B matches source idea",
  "READING",
  "1",
  "",
  "MEDIUM",
  "1",
  "",
  "",
  "Sample Passage Title",
];

export default function AdminQuestionBankPage() {
  const [passages, setPassages] = useState<PassageOption[]>([]);
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [csvText, setCsvText] = useState("");
  const [defaultPassageId, setDefaultPassageId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loadingRows, setLoadingRows] = useState(true);
  const [recentRows, setRecentRows] = useState<BankRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const previewRows = useMemo(() => rows.slice(0, 12), [rows]);

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setMessage(`Copied passage_id: ${id}`);
      setError(null);
    } catch {
      setError("Could not copy passage ID.");
    }
  }

  async function loadPassages() {
    const res = await fetch("/api/admin/passages", { cache: "no-store" });
    const data = (await res.json().catch(() => null)) as {
      passages?: PassageOption[];
      error?: string;
    } | null;
    if (!res.ok) throw new Error(data?.error || "Failed to load passages");
    const next = Array.isArray(data?.passages) ? data!.passages! : [];
    setPassages(next);
  }

  async function loadRecentRows() {
    setLoadingRows(true);
    const res = await fetch("/api/admin/question-bank/upload-csv", {
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as {
      rows?: BankRow[];
      error?: string;
    } | null;
    if (!res.ok) throw new Error(data?.error || "Failed to load bank rows");
    setRecentRows(Array.isArray(data?.rows) ? data!.rows! : []);
    setLoadingRows(false);
  }

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([loadPassages(), loadRecentRows()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        setLoadingRows(false);
      }
    })();
  }, []);

  function downloadTemplate() {
    const csv = `${TEMPLATE_HEADERS.join(",")}\n${SAMPLE_ROW.join(",")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "question_bank_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    parseLocalCsv(text);
  }

  function parseLocalCsv(text: string) {
    setError(null);
    setMessage(null);
    setWarning(null);
    try {
      const parsed = parseCsvRows(text);
      if (!parsed.length) throw new Error("CSV is empty");
      const csvHeaders = parsed[0].map((h) => h.trim().toLowerCase());
      if (
        !csvHeaders.includes("question_text") ||
        !csvHeaders.includes("question_type")
      ) {
        throw new Error(
          "CSV must include question_text and question_type columns.",
        );
      }
      setHeaders(csvHeaders);
      setRows(rowsToObjects(parsed));
      setMessage(`Loaded ${Math.max(0, parsed.length - 1)} rows from CSV.`);
    } catch (err) {
      setRows([]);
      setHeaders([]);
      setError(err instanceof Error ? err.message : "CSV parse failed");
    }
  }

  async function uploadCsv() {
    if (!csvText.trim()) {
      setError("Please upload a CSV file first.");
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);
    setWarning(null);

    try {
      const res = await fetch("/api/admin/question-bank/upload-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, defaultPassageId }),
      });

      const data = (await res.json().catch(() => null)) as {
        inserted?: number;
        issues?: string[];
        warnings?: string[];
        error?: string;
        detail?: string;
      } | null;

      if (!res.ok) {
        const issues = Array.isArray(data?.issues)
          ? data!.issues!.join("\n")
          : "";
        const detail = typeof data?.detail === "string" ? data.detail : "";
        const parts = [data?.error || "Upload failed", issues, detail].filter(
          Boolean,
        );
        throw new Error(parts.join("\n"));
      }

      setMessage(`Upload complete. Inserted ${data?.inserted || 0} rows.`);
      if (Array.isArray(data?.warnings) && data.warnings.length) {
        setWarning(data.warnings.slice(0, 10).join("\n"));
      }
      setRows([]);
      setHeaders([]);
      setCsvText("");
      await loadRecentRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-text">Question Bank Builder</h1>
        <p className="mt-1 text-sm text-dash-text-muted">Import CSV questions and link them to passage/photo/audio sources.</p>
      </div>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
          Passage IDs Reference
        </h2>
        {passages.length ? (
          <div className="mt-3 space-y-2">
            {passages.slice(0, 20).map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dash-border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-semibold text-dash-text">{p.title}</p>
                  <p className="text-xs text-dash-text-muted">
                    {p.module} Part {p.sectionPart} | {p.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void copyId(p.id)}
                  className="rounded border border-dash-border px-2 py-1 text-xs font-semibold text-dash-text"
                >
                  Copy ID
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-dash-text-muted">No passages found yet.</p>
        )}
      </section>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">How linking works</p>
          <p className="mt-1">
            1) Best: use exact `passage_id` from Passage page.
          </p>
          <p>2) Or use exact `passage_title` (must match exactly).</p>
          <p>3) If those are blank, selected default passage will be used.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded-lg border border-dash-border px-4 py-2 text-sm font-semibold text-dash-text"
          >
            Download CSV Template
          </button>

          <input type="file" accept=".csv,text/csv" onChange={onFileChange} />
        </div>

        <p className="mt-3 text-xs text-dash-text-muted">
          Linking rule: provide <code>passage_id</code> per row, or choose a
          default passage below for rows where <code>passage_id</code> is empty.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-[13px] font-medium text-dash-text">
              Default Passage (optional)
            </span>
            <select
              value={defaultPassageId}
              onChange={(e) => setDefaultPassageId(e.target.value)}
              className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
            >
              <option value="">No default</option>
              {passages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.module} Part {p.sectionPart})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={uploadCsv}
            disabled={uploading || !rows.length}
            className="rounded-lg bg-dash-accent-muted px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {uploading ? "Uploading..." : "Upload to Question Bank"}
          </button>
        </div>
      </section>

      {error ? (
        <div className="whitespace-pre-line rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {warning ? (
        <div className="whitespace-pre-line rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {warning}
        </div>
      ) : null}

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
          CSV Preview
        </h2>

        {previewRows.length ? (
          <div className="mt-3 overflow-x-auto rounded-xl border border-dash-border">
            <table className="min-w-full divide-y divide-dash-border text-sm">
              <thead className="bg-dash-bg">
                <tr>
                  {headers.map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-3 py-2 text-left text-xs uppercase tracking-wide text-dash-text-muted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border bg-dash-surface">
                {previewRows.map((row, idx) => (
                  <tr key={idx}>
                    {headers.map((h) => (
                      <td key={`${idx}-${h}`} className="px-3 py-2 align-top">
                        {row[h] || ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-dash-text-muted">
            Upload a CSV to preview rows before import.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
          Recent Bank Questions
        </h2>

        {loadingRows ? (
          <div className="mt-3 h-40 animate-pulse rounded-xl bg-dash-border/50" />
        ) : recentRows.length ? (
          <div className="mt-3 space-y-2">
            {recentRows.slice(0, 40).map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-dash-border p-3"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-dash-accent">
                  {row.type} - {row.module}
                  {row.sectionPart ? ` Part ${row.sectionPart}` : ""}
                </p>
                <p className="mt-1 text-sm text-dash-text">
                  {row.questionText}
                </p>
                <p className="mt-1 text-xs text-dash-text-muted">
                  Passage: {row.passage?.title || "Unlinked"}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-dash-text-muted">
            No question bank items yet.
          </p>
        )}
      </section>
    </div>
  );
}
