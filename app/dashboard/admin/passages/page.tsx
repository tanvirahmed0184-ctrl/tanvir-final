"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type PassageMediaRow = {
  id: string;
  type: "IMAGE" | "AUDIO";
  url: string;
  label?: string | null;
  order: number;
  storagePath?: string | null;
};

type PassageRow = {
  id: string;
  title: string;
  content?: string | null;
  module: "READING" | "LISTENING" | "WRITING" | "SPEAKING";
  sectionPart: number;
  wordCount?: number | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  linkedQuestions: number;
  media: PassageMediaRow[];
};

type PassageCreatePayload = {
  title: string;
  content: string;
  module: "READING" | "LISTENING" | "WRITING";
  sectionPart: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
};

const EMPTY_PASSAGE_FORM: PassageCreatePayload = {
  title: "",
  content: "",
  module: "READING",
  sectionPart: 1,
  difficulty: "MEDIUM",
};

export default function AdminPassagesPage() {
  const [passages, setPassages] = useState<PassageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [passageForm, setPassageForm] =
    useState<PassageCreatePayload>(EMPTY_PASSAGE_FORM);
  const [creatingPassage, setCreatingPassage] = useState(false);

  const [targetPassageId, setTargetPassageId] = useState("");
  const [mediaType, setMediaType] = useState<"IMAGE" | "AUDIO">("IMAGE");
  const [mediaLabel, setMediaLabel] = useState("");
  const [mediaOrder, setMediaOrder] = useState(1);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [creatingMedia, setCreatingMedia] = useState(false);
  const [generatingAudioPassageId, setGeneratingAudioPassageId] = useState<
    string | null
  >(null);

  const wordCount = useMemo(() => {
    const text = passageForm.content.trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  }, [passageForm.content]);

  const loadPassages = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/passages", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as {
        passages?: PassageRow[];
        error?: string;
      } | null;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load passages");
      }

      const rows = Array.isArray(data?.passages) ? data!.passages! : [];
      setPassages(rows);
      setTargetPassageId((prev) => prev || rows[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load passages");
      setPassages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  async function copyPassageId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setMessage(`Copied passage ID: ${id}`);
      setError(null);
    } catch {
      setError("Could not copy passage ID.");
    }
  }

  useEffect(() => {
    void loadPassages();
  }, [loadPassages]);

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
      setMessage("Passage created successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create passage");
    } finally {
      setCreatingPassage(false);
    }
  }

  async function addMedia(e: FormEvent) {
    e.preventDefault();
    setCreatingMedia(true);
    setError(null);
    setMessage(null);

    try {
      if (!targetPassageId) {
        throw new Error("Please select a passage");
      }

      const formData = new FormData();
      formData.set("type", mediaType);
      formData.set("label", mediaLabel);
      formData.set("order", String(mediaOrder));
      if (mediaUrl.trim()) {
        formData.set("url", mediaUrl.trim());
      }
      if (mediaFile) {
        formData.set("file", mediaFile);
      }

      const res = await fetch(`/api/admin/passages/${targetPassageId}/media`, {
        method: "POST",
        body: formData,
      });

      const data = (await res.json().catch(() => null)) as {
        media?: PassageMediaRow;
        error?: string;
      } | null;

      if (!res.ok || !data?.media) {
        throw new Error(data?.error || "Failed to add media");
      }

      setPassages((prev) =>
        prev.map((row) =>
          row.id === targetPassageId
            ? {
                ...row,
                media: [...row.media, data.media!].sort(
                  (a, b) => a.order - b.order,
                ),
              }
            : row,
        ),
      );

      setMediaLabel("");
      setMediaUrl("");
      setMediaFile(null);
      setMediaOrder(1);
      setMessage("Media added successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add media");
    } finally {
      setCreatingMedia(false);
    }
  }

  async function generatePassageAudio(passage: PassageRow) {
    setGeneratingAudioPassageId(passage.id);
    setError(null);
    setMessage(null);

    const hasAudio = passage.media.some((m) => m.type === "AUDIO");
    const force = hasAudio;

    try {
      const res = await fetch(
        `/api/admin/passages/${passage.id}/generate-audio`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
        },
      );

      const data = (await res.json().catch(() => null)) as {
        generated?: boolean;
        media?: PassageMediaRow;
        error?: string;
        detail?: string;
      } | null;

      if (!res.ok || !data?.media) {
        const detail = typeof data?.detail === "string" ? data.detail : "";
        const parts = [
          data?.error || "Failed to generate passage audio",
          detail,
        ]
          .filter(Boolean)
          .join("\n");
        throw new Error(parts);
      }

      setPassages((prev) =>
        prev.map((row) => {
          if (row.id !== passage.id) return row;

          const withoutSame = row.media.filter((m) => m.id !== data.media!.id);
          return {
            ...row,
            media: [...withoutSame, data.media!].sort(
              (a, b) => a.order - b.order,
            ),
          };
        }),
      );

      setMessage(
        data.generated
          ? "Listening audio generated and saved."
          : "Passage already had audio; existing media is being used.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate passage audio",
      );
    } finally {
      setGeneratingAudioPassageId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-text">Passage Manager</h1>
        <p className="mt-1 text-sm text-dash-text-muted">Add passage/audio/image sources and keep question links organized.</p>
      </div>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
          Add Passage Source
        </h2>

        <form onSubmit={createPassage} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title">
              <input
                value={passageForm.title}
                onChange={(e) =>
                  setPassageForm((prev) => ({ ...prev, title: e.target.value }))
                }
                required
                className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
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
                className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
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
                    module: e.target.value as PassageCreatePayload["module"],
                  }))
                }
                className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
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
                    difficulty: e.target
                      .value as PassageCreatePayload["difficulty"],
                  }))
                }
                className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
              >
                <option value="EASY">EASY</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
              </select>
            </Field>
          </div>

          <Field label={`Content (optional) - ${wordCount} words`}>
            <textarea
              value={passageForm.content}
              onChange={(e) =>
                setPassageForm((prev) => ({ ...prev, content: e.target.value }))
              }
              rows={5}
              placeholder="You can leave this empty if this source is image-only or audio-only."
              className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
            />
          </Field>

          <button
            type="submit"
            disabled={creatingPassage}
            className="rounded-lg bg-dash-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-dash-accent-muted disabled:opacity-60"
          >
            {creatingPassage ? "Creating..." : "Create Passage"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
          Add Media (URL or Upload)
        </h2>

        <form onSubmit={addMedia} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Passage">
              <select
                value={targetPassageId}
                onChange={(e) => setTargetPassageId(e.target.value)}
                className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
              >
                <option value="">Select a passage</option>
                {passages.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.title} ({row.module} Part {row.sectionPart})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Type">
              <select
                value={mediaType}
                onChange={(e) =>
                  setMediaType(e.target.value as "IMAGE" | "AUDIO")
                }
                className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
              >
                <option value="IMAGE">IMAGE</option>
                <option value="AUDIO">AUDIO</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Media URL (optional)">
              <input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Upload File (optional)">
              <input
                type="file"
                accept={mediaType === "IMAGE" ? "image/*" : "audio/*"}
                onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Label (optional)">
              <input
                value={mediaLabel}
                onChange={(e) => setMediaLabel(e.target.value)}
                className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Order">
              <input
                type="number"
                min={1}
                value={mediaOrder}
                onChange={(e) =>
                  setMediaOrder(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={creatingMedia}
            className="rounded-lg bg-dash-accent-muted px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {creatingMedia ? "Saving..." : "Add Media"}
          </button>
        </form>
      </section>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
          Existing Sources
        </h2>

        {loading ? (
          <div className="mt-3 h-40 animate-pulse rounded-xl bg-dash-border/50" />
        ) : passages.length ? (
          <div className="mt-3 space-y-3">
            {passages.map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-dash-border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-dash-text">{row.title}</p>
                  <p className="text-xs text-dash-text-muted">
                    {row.module} - Part {row.sectionPart} - {row.difficulty}
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-dash-text-muted">
                  <span className="rounded bg-dash-bg px-2 py-1">
                    ID: {row.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyPassageId(row.id)}
                    className="rounded border border-dash-border px-2 py-1 font-semibold text-dash-text"
                  >
                    Copy ID
                  </button>
                  {row.module === "LISTENING" ? (
                    <button
                      type="button"
                      onClick={() => void generatePassageAudio(row)}
                      disabled={generatingAudioPassageId === row.id}
                      className="rounded border border-dash-accent/30 bg-dash-accent-light px-2 py-1 font-semibold text-dash-accent disabled:opacity-60"
                    >
                      {generatingAudioPassageId === row.id
                        ? "Generating..."
                        : row.media.some((m) => m.type === "AUDIO")
                          ? "Regenerate Audio"
                          : "Generate Audio"}
                    </button>
                  ) : null}
                </div>

                <p className="mt-1 text-xs text-dash-text-muted">
                  Words: {row.wordCount || 0} | Linked Questions:{" "}
                  {row.linkedQuestions} | Media: {row.media.length}
                </p>

                {row.content ? (
                  <p className="mt-2 line-clamp-2 text-sm text-dash-text">
                    {row.content}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-dash-text-muted">
                    No text content (media-only source).
                  </p>
                )}

                {row.media.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.media.map((m) => (
                      <span
                        key={m.id}
                        className="rounded-full bg-dash-bg px-2 py-1 text-xs text-dash-text"
                      >
                        {m.type} #{m.order}
                        {m.label ? ` - ${m.label}` : ""}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-dash-text-muted">
            No passages created yet.
          </p>
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
