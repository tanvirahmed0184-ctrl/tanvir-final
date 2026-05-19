"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { parseCsvRows, rowsToObjects } from "@/lib/csv";

type EntityStatus = "DRAFT" | "READY" | "LIVE" | "ARCHIVED";
type ModuleInput = "READING" | "LISTENING" | "WRITING";
type DifficultyInput = "EASY" | "MEDIUM" | "HARD";

type PassageMedia = {
  id: string;
  type: "IMAGE" | "AUDIO";
  url: string;
  label?: string | null;
  order: number;
};

type PassageRow = {
  id: string;
  title: string;
  content?: string | null;
  module: ModuleInput;
  sectionPart: number;
  difficulty: DifficultyInput;
  linkedQuestions: number;
  media: PassageMedia[];
};

type PassageCreatePayload = {
  title: string;
  content: string;
  module: ModuleInput;
  sectionPart: number;
  difficulty: DifficultyInput;
};

type QuestionBankRow = {
  id: string;
  questionText: string;
  type: string;
  module: string;
  sectionPart?: number | null;
  passageId?: string | null;
};

type CsvDraftRow = Record<string, string>;

const EMPTY_PASSAGE_FORM: PassageCreatePayload = {
  title: "",
  content: "",
  module: "READING",
  sectionPart: 1,
  difficulty: "MEDIUM",
};

const REQUIRED_CSV_HEADERS = ["question_text", "question_type"];

const STATUS_CHIPS: Array<{ key: EntityStatus; label: string; cls: string }> = [
  { key: "DRAFT", label: "Draft", cls: "bg-slate-100 text-slate-700" },
  { key: "READY", label: "Ready", cls: "bg-amber-100 text-amber-700" },
  { key: "LIVE", label: "Live", cls: "bg-emerald-100 text-emerald-700" },
  { key: "ARCHIVED", label: "Archived", cls: "bg-rose-100 text-rose-700" },
];

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

const TEMPLATE_SAMPLE = [
  "Sample question",
  "MULTIPLE_CHOICE",
  "Option A",
  "Option B",
  "Option C",
  "Option D",
  "A",
  "A|Option A",
  "Reason",
  "READING",
  "1",
  "",
  "MEDIUM",
  "1",
  "",
  "",
  "",
];

function normalizeRow(row: Record<string, string>): CsvDraftRow {
  const out: CsvDraftRow = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.trim().toLowerCase()] = value ?? "";
  }
  return out;
}

function passageHint(
  row: CsvDraftRow,
  passages: PassageRow[],
): { suggestedPassageId: string | null; reason: string | null } {
  const moduleName = (row.module || "").trim().toUpperCase();
  const sectionPart = Number(row.section_part || "");
  if (!moduleName || !Number.isFinite(sectionPart)) {
    return { suggestedPassageId: null, reason: null };
  }
  const match = passages.find(
    (passage) =>
      passage.module === moduleName && passage.sectionPart === sectionPart,
  );
  if (!match) return { suggestedPassageId: null, reason: null };
  return {
    suggestedPassageId: match.id,
    reason: `Suggested from ${moduleName} Part ${sectionPart}`,
  };
}

function validateDraftRows(rows: CsvDraftRow[], passages: PassageRow[]) {
  const passageIds = new Set(passages.map((passage) => passage.id));
  return rows.map((row, index) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    const questionText = (row.question_text || "").trim();
    const questionType = (row.question_type || "").trim();
    const passageId = (row.passage_id || "").trim();
    const moduleName = (row.module || "").trim();
    const sectionPart = (row.section_part || "").trim();

    if (!questionText) issues.push("Missing question_text");
    if (!questionType) issues.push("Missing question_type");

    if (!passageId) {
      warnings.push("passage_id missing");
    } else if (!passageIds.has(passageId)) {
      issues.push("Invalid passage_id");
    }

    if (!moduleName) warnings.push("module missing");
    if (!sectionPart) warnings.push("section_part missing");

    return {
      index,
      issues,
      warnings,
      isValid: issues.length === 0,
    };
  });
}

function csvFromRows(headers: string[], rows: CsvDraftRow[]): string {
  const allHeaders = headers.length ? headers : Object.keys(rows[0] || {});
  const escape = (value: string) => {
    const safe = String(value ?? "");
    const escaped = safe.replace(/"/g, '""');
    return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
  };
  const headerLine = allHeaders.map((h) => escape(h)).join(",");
  const body = rows.map((row) =>
    allHeaders.map((h) => escape(row[h] || "")).join(","),
  );
  return [headerLine, ...body].join("\n");
}

export default function ContentStudioPage() {
  const [passages, setPassages] = useState<PassageRow[]>([]);
  const [recentRows, setRecentRows] = useState<QuestionBankRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [creatingPassage, setCreatingPassage] = useState(false);
  const [addingMedia, setAddingMedia] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<EntityStatus | "ALL">("ALL");
  const [historyFilter, setHistoryFilter] = useState("ALL");
  const [historySearch, setHistorySearch] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const [passageForm, setPassageForm] =
    useState<PassageCreatePayload>(EMPTY_PASSAGE_FORM);
  const [targetPassageId, setTargetPassageId] = useState("");
  const [mediaType, setMediaType] = useState<"IMAGE" | "AUDIO">("IMAGE");
  const [mediaLabel, setMediaLabel] = useState("");
  const [mediaOrder, setMediaOrder] = useState(1);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvDraftRow[]>([]);
  const [defaultPassageId, setDefaultPassageId] = useState("");
  const [csvSearch, setCsvSearch] = useState("");
  const [csvModuleFilter, setCsvModuleFilter] = useState("ALL");
  const [csvSectionFilter, setCsvSectionFilter] = useState("ALL");
  const [csvDifficultyFilter, setCsvDifficultyFilter] = useState("ALL");
  const [allowInvalidOverride, setAllowInvalidOverride] = useState(false);

  const wordCount = useMemo(() => {
    const text = passageForm.content.trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  }, [passageForm.content]);

  async function loadAllData() {
    setLoading(true);
    setError(null);
    try {
      const [passagesRes, bankRes] = await Promise.all([
        fetch("/api/admin/passages", { cache: "no-store" }),
        fetch("/api/admin/question-bank/upload-csv", { cache: "no-store" }),
      ]);

      const passagesData = (await passagesRes.json().catch(() => null)) as {
        passages?: PassageRow[];
        error?: string;
      } | null;
      const bankData = (await bankRes.json().catch(() => null)) as {
        rows?: QuestionBankRow[];
        error?: string;
      } | null;

      if (!passagesRes.ok) {
        throw new Error(passagesData?.error || "Failed to load passages");
      }
      if (!bankRes.ok) {
        throw new Error(bankData?.error || "Failed to load question bank");
      }

      const nextPassages = Array.isArray(passagesData?.passages)
        ? passagesData.passages
        : [];
      setPassages(nextPassages);
      setRecentRows(Array.isArray(bankData?.rows) ? bankData.rows : []);
      setTargetPassageId((prev) => prev || nextPassages[0]?.id || "");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load content studio",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAllData();
  }, []);

  const passageStatuses = useMemo(() => {
    return passages.map((passage) => {
      const hasMedia = passage.media.length > 0;
      const hasQuestions = passage.linkedQuestions > 0;
      const status = (
        hasMedia && hasQuestions
          ? "LIVE"
          : hasMedia || hasQuestions
            ? "READY"
            : "DRAFT"
      ) as EntityStatus;

      if (statusFilter !== "ALL" && status !== statusFilter) return null;

      return {
        ...passage,
        status,
      };
    }) as Array<(PassageRow & { status: EntityStatus }) | null>;
  }, [passages, statusFilter]);

  const filteredPassageStatuses = useMemo(
    () =>
      passageStatuses.filter(
        (item): item is PassageRow & { status: EntityStatus } => item !== null,
      ),
    [passageStatuses],
  );

  async function copyPassageId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setMessage(`Copied passage ID: ${id}`);
      setError(null);
    } catch {
      setError("Could not copy passage ID");
    }
  }

  async function createPassage(e: FormEvent) {
    e.preventDefault();
    setCreatingPassage(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/passages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passageForm),
      });
      const data = (await res.json().catch(() => null)) as {
        passage?: PassageRow;
        error?: string;
      } | null;
      if (!res.ok || !data?.passage) {
        throw new Error(data?.error || "Failed to create passage");
      }

      setPassages((prev) => [data.passage!, ...prev]);
      setTargetPassageId(data.passage.id);
      setPassageForm(EMPTY_PASSAGE_FORM);

      try {
        await navigator.clipboard.writeText(data.passage.id);
        setMessage(
          `Passage created and copied to clipboard: ${data.passage.id}`,
        );
      } catch {
        setMessage(`Passage created: ${data.passage.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create passage");
    } finally {
      setCreatingPassage(false);
    }
  }

  async function addMedia(e: FormEvent) {
    e.preventDefault();
    if (!targetPassageId) {
      setError("Please select a passage first");
      return;
    }
    setAddingMedia(true);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.set("type", mediaType);
      formData.set("label", mediaLabel);
      formData.set("order", String(mediaOrder));
      if (mediaUrl.trim()) formData.set("url", mediaUrl.trim());
      if (mediaFile) formData.set("file", mediaFile);

      const res = await fetch(`/api/admin/passages/${targetPassageId}/media`, {
        method: "POST",
        body: formData,
      });
      const data = (await res.json().catch(() => null)) as {
        media?: PassageMedia;
        error?: string;
      } | null;
      if (!res.ok || !data?.media) {
        throw new Error(data?.error || "Failed to add media");
      }

      setPassages((prev) =>
        prev.map((passage) =>
          passage.id === targetPassageId
            ? {
                ...passage,
                media: [...passage.media, data.media!].sort(
                  (a, b) => a.order - b.order,
                ),
              }
            : passage,
        ),
      );

      setMediaLabel("");
      setMediaUrl("");
      setMediaFile(null);
      setMediaOrder(1);
      setMessage("Media added successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add media");
    } finally {
      setAddingMedia(false);
    }
  }

  function onCsvFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    void (async () => {
      setError(null);
      setWarning(null);
      setMessage(null);
      try {
        const text = await file.text();
        const parsedRows = parseCsvRows(text);
        if (!parsedRows.length) throw new Error("CSV is empty");
        const headers = parsedRows[0].map((header) =>
          header.trim().toLowerCase(),
        );
        const missingRequired = REQUIRED_CSV_HEADERS.filter(
          (header) => !headers.includes(header),
        );
        if (missingRequired.length) {
          throw new Error(
            `CSV missing required columns: ${missingRequired.join(", ")}`,
          );
        }

        const objects = rowsToObjects(parsedRows).map(normalizeRow);
        if (!headers.includes("passage_id")) headers.push("passage_id");
        if (!headers.includes("module")) headers.push("module");
        if (!headers.includes("section_part")) headers.push("section_part");
        if (!headers.includes("difficulty")) headers.push("difficulty");

        setCsvHeaders(headers);
        setCsvRows(objects);
        setMessage(`Loaded ${objects.length} rows into editable CSV draft.`);
      } catch (err) {
        setCsvHeaders([]);
        setCsvRows([]);
        setError(err instanceof Error ? err.message : "CSV parse failed");
      }
    })();
  }

  function downloadCsvTemplate() {
    const csv = `${TEMPLATE_HEADERS.join(",")}\n${TEMPLATE_SAMPLE.join(",")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "content_studio_question_template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function updateCsvCell(rowIndex: number, key: string, value: string) {
    setCsvRows((prev) =>
      prev.map((row, idx) =>
        idx === rowIndex ? { ...row, [key]: value } : row,
      ),
    );
  }

  function duplicateCsvRow(rowIndex: number) {
    setCsvRows((prev) => {
      const row = prev[rowIndex];
      if (!row) return prev;
      const copy = { ...row };
      const next = [...prev];
      next.splice(rowIndex + 1, 0, copy);
      return next;
    });
  }

  function deleteCsvRow(rowIndex: number) {
    setCsvRows((prev) => prev.filter((_, idx) => idx !== rowIndex));
  }

  function addCsvRow() {
    const base: CsvDraftRow = {};
    csvHeaders.forEach((header) => {
      base[header] = "";
    });
    setCsvRows((prev) => [...prev, base]);
  }

  const draftWithSuggestions = useMemo(() => {
    return csvRows.map((row) => {
      const hint = passageHint(row, passages);
      return {
        row,
        ...hint,
      };
    });
  }, [csvRows, passages]);

  const validations = useMemo(
    () => validateDraftRows(csvRows, passages),
    [csvRows, passages],
  );

  const filteredDraft = useMemo(() => {
    return draftWithSuggestions
      .map((entry, index) => ({ ...entry, index, v: validations[index] }))
      .filter((entry) => {
        const row = entry.row;
        const query = csvSearch.trim().toLowerCase();
        if (query) {
          const joined = Object.values(row).join(" ").toLowerCase();
          if (!joined.includes(query)) return false;
        }
        if (csvModuleFilter !== "ALL") {
          const moduleName = (row.module || "").trim().toUpperCase();
          if (moduleName !== csvModuleFilter) return false;
        }
        if (csvSectionFilter !== "ALL") {
          if ((row.section_part || "").trim() !== csvSectionFilter)
            return false;
        }
        if (csvDifficultyFilter !== "ALL") {
          const difficulty = (row.difficulty || "").trim().toUpperCase();
          if (difficulty !== csvDifficultyFilter) return false;
        }
        return true;
      });
  }, [
    csvDifficultyFilter,
    csvModuleFilter,
    csvSearch,
    csvSectionFilter,
    draftWithSuggestions,
    validations,
  ]);

  const validationSummary = useMemo(() => {
    const invalidRows = validations.filter((v) => !v.isValid).length;
    const warningRows = validations.filter((v) => v.warnings.length > 0).length;
    return { invalidRows, warningRows };
  }, [validations]);

  function applyPassageSuggestion(index: number) {
    const hint = draftWithSuggestions[index];
    if (!hint?.suggestedPassageId) return;
    updateCsvCell(index, "passage_id", hint.suggestedPassageId);
  }

  function applyDefaultPassageToMissingRows() {
    if (!defaultPassageId) return;
    setCsvRows((prev) =>
      prev.map((row) =>
        (row.passage_id || "").trim()
          ? row
          : {
              ...row,
              passage_id: defaultPassageId,
            },
      ),
    );
    setMessage("Applied default passage_id to rows missing passage link.");
  }

  async function uploadDraftCsv() {
    if (!csvRows.length) {
      setError("No CSV draft rows to upload");
      return;
    }
    if (validationSummary.invalidRows > 0 && !allowInvalidOverride) {
      setError(
        `Fix ${validationSummary.invalidRows} invalid row(s), or enable override.`,
      );
      return;
    }

    setUploading(true);
    setError(null);
    setWarning(null);
    setMessage(null);
    try {
      const csvText = csvFromRows(csvHeaders, csvRows);
      const res = await fetch("/api/admin/question-bank/upload-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, defaultPassageId }),
      });
      const data = (await res.json().catch(() => null)) as {
        inserted?: number;
        warnings?: string[];
        issues?: string[];
        error?: string;
        detail?: string;
      } | null;

      if (!res.ok) {
        const issues = Array.isArray(data?.issues)
          ? data.issues.join("\n")
          : "";
        const detail = typeof data?.detail === "string" ? data.detail : "";
        throw new Error(
          [data?.error || "Upload failed", issues, detail]
            .filter(Boolean)
            .join("\n"),
        );
      }

      setMessage(`Upload complete. Inserted ${data?.inserted || 0} rows.`);
      if (Array.isArray(data?.warnings) && data.warnings.length) {
        setWarning(data.warnings.slice(0, 12).join("\n"));
      }
      setCsvRows([]);
      setCsvHeaders([]);
      setAllowInvalidOverride(false);
      await loadAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const historyRows = useMemo(() => {
    const search = historySearch.trim().toLowerCase();

    let base = filteredPassageStatuses;
    if (historyFilter === "HAS_MEDIA") {
      base = base.filter((row) => row.media.length > 0);
    } else if (historyFilter === "UNUSED") {
      base = base.filter((row) => row.linkedQuestions === 0);
    }

    if (!search) return base;
    return base.filter((row) => {
      const haystack = [
        row.title,
        row.id,
        row.module,
        String(row.sectionPart),
        row.status,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [filteredPassageStatuses, historyFilter, historySearch]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-brand-purple via-brand-purple-dark to-brand-teal p-5 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Content Studio</h1>
        <p className="mt-2 text-sm text-white/85">
          Unified passage + question bank authoring with editable CSV draft
          flow.
        </p>
      </section>

      {error ? (
        <div className="whitespace-pre-line rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {warning ? (
        <div className="whitespace-pre-line rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {warning}
        </div>
      ) : null}

      <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Passage Authoring Workspace
          </h2>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="rounded-lg border border-brand-purple/35 bg-brand-purple/5 px-3 py-1.5 text-xs font-semibold text-brand-purple"
          >
            Open Passage History & Usage
          </button>
        </div>

        <div className="mt-3 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <article className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Passage Authoring
            </h3>

            <form onSubmit={createPassage} className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Title">
                  <input
                    value={passageForm.title}
                    onChange={(e) =>
                      setPassageForm((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Section / Part">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={passageForm.sectionPart}
                    onChange={(e) =>
                      setPassageForm((prev) => ({
                        ...prev,
                        sectionPart: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Module">
                  <select
                    value={passageForm.module}
                    onChange={(e) =>
                      setPassageForm((prev) => ({
                        ...prev,
                        module: e.target.value as ModuleInput,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="READING">READING</option>
                    <option value="LISTENING">LISTENING</option>
                    <option value="WRITING">WRITING</option>
                  </select>
                </Field>
                <Field label="Difficulty">
                  <select
                    value={passageForm.difficulty}
                    onChange={(e) =>
                      setPassageForm((prev) => ({
                        ...prev,
                        difficulty: e.target.value as DifficultyInput,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="EASY">EASY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HARD">HARD</option>
                  </select>
                </Field>
              </div>
              <Field label={`Main Content (optional) - ${wordCount} words`}>
                <textarea
                  value={passageForm.content}
                  onChange={(e) =>
                    setPassageForm((prev) => ({
                      ...prev,
                      content: e.target.value,
                    }))
                  }
                  rows={6}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Paste full content, or keep empty for media-only source."
                />
              </Field>

              <button
                type="submit"
                disabled={creatingPassage}
                className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
              >
                {creatingPassage ? "Saving..." : "Save Passage"}
              </button>
            </form>
          </article>

          <article className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Media Attachments
            </h3>

            <form onSubmit={addMedia} className="mt-3 space-y-3">
              <Field label="Passage ID (manual/editable)">
                <input
                  value={targetPassageId}
                  onChange={(e) => setTargetPassageId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Or select passage">
                <select
                  value={targetPassageId}
                  onChange={(e) => setTargetPassageId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a passage</option>
                  {passages.map((passage) => (
                    <option key={passage.id} value={passage.id}>
                      {passage.title} ({passage.module} Part{" "}
                      {passage.sectionPart})
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Type">
                  <select
                    value={mediaType}
                    onChange={(e) =>
                      setMediaType(e.target.value as "IMAGE" | "AUDIO")
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="IMAGE">IMAGE</option>
                    <option value="AUDIO">AUDIO</option>
                  </select>
                </Field>
                <Field label="Order">
                  <input
                    type="number"
                    min={1}
                    value={mediaOrder}
                    onChange={(e) =>
                      setMediaOrder(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <Field label="Media URL (optional)">
                <input
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="https://..."
                />
              </Field>
              <Field label="Upload file (optional)">
                <input
                  type="file"
                  accept={mediaType === "IMAGE" ? "image/*" : "audio/*"}
                  onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Label (optional)">
                <input
                  value={mediaLabel}
                  onChange={(e) => setMediaLabel(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <button
                type="submit"
                disabled={addingMedia}
                className="rounded-xl bg-brand-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
              >
                {addingMedia ? "Saving..." : "Attach Media"}
              </button>
            </form>
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
        <article>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              CSV Draft Editor
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs">
                <input
                  type="checkbox"
                  checked={allowInvalidOverride}
                  onChange={(e) => setAllowInvalidOverride(e.target.checked)}
                />
                Allow override
              </label>
              <button
                type="button"
                onClick={addCsvRow}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
              >
                Add Row
              </button>
              <button
                type="button"
                onClick={uploadDraftCsv}
                disabled={uploading || !csvRows.length}
                className="rounded-lg bg-brand-teal px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Confirm & Upload"}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadCsvTemplate}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
            >
              Download CSV Template
            </button>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={onCsvFileChange}
            />
            <FieldInline label="Default passage_id fallback">
              <select
                value={defaultPassageId}
                onChange={(e) => setDefaultPassageId(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="">No default</option>
                {passages.map((passage) => (
                  <option key={passage.id} value={passage.id}>
                    {passage.title}
                  </option>
                ))}
              </select>
            </FieldInline>
            <button
              type="button"
              onClick={applyDefaultPassageToMissingRows}
              disabled={!defaultPassageId || !csvRows.length}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
            >
              Apply default passage_id
            </button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input
              value={csvSearch}
              onChange={(e) => setCsvSearch(e.target.value)}
              placeholder="Search rows..."
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
            <select
              value={csvModuleFilter}
              onChange={(e) => setCsvModuleFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            >
              <option value="ALL">All modules</option>
              <option value="READING">READING</option>
              <option value="LISTENING">LISTENING</option>
              <option value="WRITING">WRITING</option>
            </select>
            <select
              value={csvSectionFilter}
              onChange={(e) => setCsvSectionFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            >
              <option value="ALL">All sections</option>
              {Array.from({ length: 10 }).map((_, idx) => (
                <option key={idx + 1} value={String(idx + 1)}>
                  Part {idx + 1}
                </option>
              ))}
            </select>
            <select
              value={csvDifficultyFilter}
              onChange={(e) => setCsvDifficultyFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            >
              <option value="ALL">All difficulties</option>
              <option value="EASY">EASY</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HARD">HARD</option>
            </select>
          </div>

          <div className="mt-3 text-xs text-slate-600">
            Invalid rows: {validationSummary.invalidRows} - Warning rows:{" "}
            {validationSummary.warningRows}
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="max-h-[60vh] overflow-auto">
              {filteredDraft.length ? (
                <table className="w-max min-w-[1200px] divide-y divide-slate-200 text-xs">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      <th className="px-2 py-2 text-left">#</th>
                      <th className="px-2 py-2 text-left">Actions</th>
                      {csvHeaders.map((header) => (
                        <th
                          key={header}
                          className="px-2 py-2 text-left uppercase"
                        >
                          {header}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-left">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredDraft.map((entry) => (
                      <tr
                        key={entry.index}
                        className={
                          entry.v.issues.length
                            ? "bg-rose-50/60"
                            : entry.v.warnings.length
                              ? "bg-amber-50/60"
                              : ""
                        }
                      >
                        <td className="px-2 py-2 align-top">
                          {entry.index + 1}
                        </td>
                        <td className="px-2 py-2 align-top">
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => duplicateCsvRow(entry.index)}
                              className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px]"
                            >
                              Duplicate
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteCsvRow(entry.index)}
                              className="rounded border border-rose-300 px-1.5 py-0.5 text-[10px] text-rose-700"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                        {csvHeaders.map((header) => (
                          <td
                            key={`${entry.index}-${header}`}
                            className="px-2 py-2 align-top"
                          >
                            {header === "passage_id" ? (
                              <div className="space-y-1">
                                <input
                                  value={entry.row[header] || ""}
                                  onChange={(e) =>
                                    updateCsvCell(
                                      entry.index,
                                      header,
                                      e.target.value,
                                    )
                                  }
                                  placeholder="manual passage_id"
                                  className="w-[200px] rounded border border-slate-300 px-1.5 py-1 text-[11px]"
                                />
                                <select
                                  value={entry.row[header] || ""}
                                  onChange={(e) =>
                                    updateCsvCell(
                                      entry.index,
                                      header,
                                      e.target.value,
                                    )
                                  }
                                  className="w-[200px] rounded border border-slate-300 px-1.5 py-1 text-[11px]"
                                >
                                  <option value="">Select passage</option>
                                  {passages.map((passage) => (
                                    <option key={passage.id} value={passage.id}>
                                      {passage.title} ({passage.module}{" "}
                                      {passage.sectionPart})
                                    </option>
                                  ))}
                                </select>
                                {entry.suggestedPassageId ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      applyPassageSuggestion(entry.index)
                                    }
                                    className="rounded border border-brand-purple/30 bg-brand-purple/5 px-1.5 py-0.5 text-[10px] text-brand-purple"
                                  >
                                    Use suggestion
                                  </button>
                                ) : null}
                              </div>
                            ) : (
                              <input
                                value={entry.row[header] || ""}
                                onChange={(e) =>
                                  updateCsvCell(
                                    entry.index,
                                    header,
                                    e.target.value,
                                  )
                                }
                                className="w-[170px] rounded border border-slate-300 px-1.5 py-1 text-[11px]"
                              />
                            )}
                          </td>
                        ))}
                        <td className="px-2 py-2 align-top">
                          {entry.v.issues.length ? (
                            <p className="text-[11px] text-rose-700">
                              {entry.v.issues.join(", ")}
                            </p>
                          ) : null}
                          {entry.v.warnings.length ? (
                            <p className="text-[11px] text-amber-700">
                              {entry.v.warnings.join(", ")}
                            </p>
                          ) : null}
                          {entry.reason ? (
                            <p className="text-[10px] text-slate-500">
                              {entry.reason}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-4 text-sm text-slate-500">
                  Upload CSV and start editing draft rows here before final
                  upload.
                </div>
              )}
            </div>
          </div>
        </article>
      </section>

      {historyOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/40">
          <div className="absolute inset-y-0 right-0 w-full max-w-none bg-white shadow-2xl md:w-1/2">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 p-4">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Passage History & Usage
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Search passage status, usage, media, and recent linked rows.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Close sidebar
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  <input
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search title / id / module..."
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as EntityStatus | "ALL")
                    }
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="ALL">All statuses</option>
                    {STATUS_CHIPS.map((status) => (
                      <option key={status.key} value={status.key}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={historyFilter}
                    onChange={(e) => setHistoryFilter(e.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="ALL">All</option>
                    <option value="HAS_MEDIA">Has media</option>
                    <option value="UNUSED">Unused passages</option>
                  </select>
                </div>

                <div className="mt-4 space-y-2">
                  {loading ? (
                    <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
                  ) : historyRows.length ? (
                    historyRows.slice(0, 80).map((passage) => {
                      const statusCls =
                        STATUS_CHIPS.find(
                          (status) => status.key === passage.status,
                        )?.cls || STATUS_CHIPS[0].cls;
                      return (
                        <article
                          key={passage.id}
                          className="rounded-xl border border-slate-200 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {passage.title}
                            </p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] ${statusCls}`}
                            >
                              {passage.status}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {passage.module} Part {passage.sectionPart} -
                            Questions: {passage.linkedQuestions} - Media:{" "}
                            {passage.media.length}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-600">
                            ID: {passage.id}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => void copyPassageId(passage.id)}
                              className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"
                            >
                              Copy ID
                            </button>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-500">No passages found.</p>
                  )}
                </div>

                <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Used-by references (recent questions)
                </h3>
                <div className="mt-2 space-y-2">
                  {recentRows.slice(0, 20).map((row) => (
                    <div
                      key={row.id}
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                    >
                      <p className="font-semibold text-slate-800">
                        {row.questionText}
                      </p>
                      <p className="text-slate-500">
                        {row.type} - {row.module}
                        {row.sectionPart ? ` Part ${row.sectionPart}` : ""} -
                        passage: {row.passageId || "unlinked"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function FieldInline({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
      <span>{label}</span>
      {children}
    </label>
  );
}
