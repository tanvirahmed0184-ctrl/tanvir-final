"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type SpeakingPart = "PART_1" | "PART_2_PREP" | "PART_2" | "PART_3";

type SpeakingTestRow = {
  id: string;
  title: string;
  isActive: boolean;
  totalQuestions: number;
};

type PromptRow = {
  part: SpeakingPart;
  prompt: string;
  prepSeconds: number;
  targetAnswerSeconds: number;
  hardLimitSeconds: number;
  silencePromptSeconds: number;
};

type PromptSetRow = {
  id: string;
  name: string;
  prompts: PromptRow[];
};

type PromptSetResponse = {
  test?: {
    id: string;
    title: string;
    isActive: boolean;
    updatedAt: string;
    totalQuestions?: number;
  };
  activeSetId?: string | null;
  sets?: unknown;
  error?: string;
};

const VALID_PARTS: SpeakingPart[] = ["PART_1", "PART_2_PREP", "PART_2", "PART_3"];

const DEFAULT_ROW: PromptRow = {
  part: "PART_1",
  prompt: "",
  prepSeconds: 0,
  targetAnswerSeconds: 45,
  hardLimitSeconds: 80,
  silencePromptSeconds: 11,
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizePart(value: unknown): SpeakingPart {
  if (typeof value === "string" && VALID_PARTS.includes(value as SpeakingPart)) {
    return value as SpeakingPart;
  }
  return "PART_1";
}

function normalizePrompt(input: unknown): PromptRow | null {
  const row = asObject(input);
  if (!row) return null;
  const prompt = typeof row.prompt === "string" ? row.prompt.trim() : "";
  if (!prompt) return null;

  const targetAnswerSeconds = clampInt(row.targetAnswerSeconds, 45, 10, 300);
  return {
    part: normalizePart(row.part),
    prompt,
    prepSeconds: clampInt(row.prepSeconds, 0, 0, 180),
    targetAnswerSeconds,
    hardLimitSeconds: Math.max(
      targetAnswerSeconds + 5,
      clampInt(row.hardLimitSeconds, targetAnswerSeconds + 20, 15, 360),
    ),
    silencePromptSeconds: clampInt(row.silencePromptSeconds, 11, 5, 60),
  };
}

function normalizePrompts(value: unknown): PromptRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => normalizePrompt(row))
    .filter((row): row is PromptRow => row !== null);
}

function normalizeSets(value: unknown): PromptSetRow[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: PromptSetRow[] = [];

  value.forEach((raw, index) => {
    const row = asObject(raw);
    if (!row) return;
    const prompts = normalizePrompts(row.prompts);
    const candidateId =
      typeof row.id === "string" && row.id.trim() ? row.id.trim() : `set-${index + 1}`;
    const id = seen.has(candidateId) ? `${candidateId}-${index + 1}` : candidateId;
    seen.add(id);

    normalized.push({
      id,
      name:
        typeof row.name === "string" && row.name.trim()
          ? row.name.trim()
          : `Set ${index + 1}`,
      prompts,
    });
  });

  return normalized;
}

function createSetId(name: string, existing: PromptSetRow[]): string {
  const slugBase = (name || "set")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "set";
  let candidate = slugBase;
  let suffix = 2;
  while (existing.some((set) => set.id === candidate)) {
    candidate = `${slugBase}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AdminSpeakingPromptsPage() {
  const [loadingTests, setLoadingTests] = useState(true);
  const [loadingSets, setLoadingSets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tests, setTests] = useState<SpeakingTestRow[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>("");
  const [sets, setSets] = useState<PromptSetRow[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string>("");
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingTests(true);
    setError(null);

    fetch("/api/tests?module=SPEAKING&fresh=1", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load speaking tests");
        const data = (await res.json()) as {
          tests?: Array<{
            id: string;
            title: string;
            isActive: boolean;
            totalQuestions: number;
          }>;
        };
        if (!active) return;
        const next = Array.isArray(data.tests) ? data.tests : [];
        setTests(next);
        setSelectedTestId((prev) => {
          if (prev && next.some((test) => test.id === prev)) return prev;
          return next[0]?.id || "";
        });
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load tests");
      })
      .finally(() => {
        if (!active) return;
        setLoadingTests(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedTestId) return;
    let active = true;
    setLoadingSets(true);
    setError(null);
    setSuccess(null);

    fetch(`/api/admin/speaking/prompt-sets?testId=${selectedTestId}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as PromptSetResponse | null;
        if (!res.ok) throw new Error(data?.error || "Failed to load prompt sets");
        if (!active) return;

        const normalizedSets = normalizeSets(data?.sets);
        const fallbackSet: PromptSetRow = {
          id: "default-set",
          name: "Default Set",
          prompts: [],
        };
        const nextSets = normalizedSets.length > 0 ? normalizedSets : [fallbackSet];
        const preferredActive =
          typeof data?.activeSetId === "string" ? data.activeSetId : null;
        const nextActive =
          nextSets.find((set) => set.id === preferredActive)?.id || nextSets[0].id;

        setSets(nextSets);
        setActiveSetId(nextActive);
        setSelectedSetId(nextActive);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load prompt sets");
      })
      .finally(() => {
        if (!active) return;
        setLoadingSets(false);
      });

    return () => {
      active = false;
    };
  }, [selectedTestId]);

  const selectedTest = useMemo(
    () => tests.find((test) => test.id === selectedTestId) || null,
    [selectedTestId, tests],
  );

  const selectedSet = useMemo(
    () => sets.find((set) => set.id === selectedSetId) || null,
    [selectedSetId, sets],
  );

  function patchCurrentSet(fn: (set: PromptSetRow) => PromptSetRow) {
    if (!selectedSetId) return;
    setSets((prev) =>
      prev.map((set) => (set.id === selectedSetId ? fn(set) : set)),
    );
  }

  function updatePrompt<K extends keyof PromptRow>(
    index: number,
    key: K,
    value: PromptRow[K],
  ) {
    patchCurrentSet((set) => ({
      ...set,
      prompts: set.prompts.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    }));
  }

  function movePrompt(from: number, to: number) {
    if (!selectedSet) return;
    if (from === to || from < 0 || to < 0) return;
    if (from >= selectedSet.prompts.length || to >= selectedSet.prompts.length) return;

    patchCurrentSet((set) => {
      const next = [...set.prompts];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return { ...set, prompts: next };
    });
  }

  function addPrompt(part: SpeakingPart) {
    patchCurrentSet((set) => ({
      ...set,
      prompts: [...set.prompts, { ...DEFAULT_ROW, part }],
    }));
  }

  function removePrompt(index: number) {
    patchCurrentSet((set) => ({
      ...set,
      prompts: set.prompts.filter((_, i) => i !== index),
    }));
  }

  function addSet() {
    const seedName = `Set ${sets.length + 1}`;
    const id = createSetId(seedName, sets);
    const nextSet: PromptSetRow = {
      id,
      name: seedName,
      prompts: [],
    };
    setSets((prev) => [...prev, nextSet]);
    setSelectedSetId(id);
    setActiveSetId((prev) => prev || id);
  }

  function duplicateCurrentSet() {
    if (!selectedSet) return;
    const name = `${selectedSet.name} Copy`;
    const id = createSetId(name, sets);
    const duplicate: PromptSetRow = {
      id,
      name,
      prompts: selectedSet.prompts.map((prompt) => ({ ...prompt })),
    };
    setSets((prev) => [...prev, duplicate]);
    setSelectedSetId(id);
  }

  function removeCurrentSet() {
    if (!selectedSet) return;
    if (sets.length <= 1) {
      setError("At least one speaking set must remain.");
      return;
    }

    const nextSets = sets.filter((set) => set.id !== selectedSet.id);
    const fallbackId = nextSets[0]?.id || "";
    setSets(nextSets);
    setSelectedSetId(fallbackId);
    if (activeSetId === selectedSet.id) {
      setActiveSetId(fallbackId || null);
    }
  }

  function exportSetsJson() {
    if (!selectedTest || sets.length === 0) return;
    downloadJson(
      `speaking-prompt-sets-${selectedTest.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`,
      {
        version: 2,
        testId: selectedTest.id,
        testTitle: selectedTest.title,
        activeSetId: activeSetId,
        sets,
      },
    );
    setSuccess("Prompt sets exported as JSON.");
    setError(null);
  }

  async function onImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const row = asObject(parsed);
      if (!row) throw new Error("Invalid JSON format");

      const importedSets = normalizeSets(row.sets);
      if (importedSets.length === 0) {
        throw new Error("JSON must contain at least one non-empty set");
      }
      const preferredActive =
        typeof row.activeSetId === "string" ? row.activeSetId.trim() : "";
      const resolvedActive =
        importedSets.find((set) => set.id === preferredActive)?.id || importedSets[0].id;

      setSets(importedSets);
      setSelectedSetId(resolvedActive);
      setActiveSetId(resolvedActive);
      setSuccess(`Imported ${importedSets.length} set(s) from JSON.`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import JSON");
      setSuccess(null);
    } finally {
      e.target.value = "";
    }
  }

  async function savePromptSets(e: FormEvent) {
    e.preventDefault();
    if (!selectedTestId) return;
    if (sets.length === 0) {
      setError("At least one set is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/speaking/prompt-sets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: selectedTestId,
          activeSetId,
          sets,
        }),
      });
      const data = (await res.json().catch(() => null)) as PromptSetResponse | null;
      if (!res.ok) throw new Error(data?.error || "Failed to save speaking prompt sets");

      const savedSets = normalizeSets(data?.sets);
      const nextSets = savedSets.length > 0 ? savedSets : sets;
      const nextActive =
        nextSets.find((set) => set.id === data?.activeSetId)?.id ||
        nextSets[0]?.id ||
        null;
      setSets(nextSets);
      setActiveSetId(nextActive);
      setSelectedSetId(nextActive || "");

      setTests((prev) =>
        prev.map((test) =>
          test.id === selectedTestId
            ? {
                ...test,
                totalQuestions:
                  typeof data?.test?.totalQuestions === "number"
                    ? data.test.totalQuestions
                    : test.totalQuestions,
              }
            : test,
        ),
      );
      setSuccess("Speaking prompt sets saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save speaking prompt sets");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-brand-purple via-brand-purple-dark to-brand-teal p-5 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Speaking Prompt Manager</h1>
        <p className="mt-2 text-sm text-white/85">
          Manage multiple named speaking sets per test, reorder prompts via drag/drop, and import/export JSON.
        </p>
      </section>

      <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
        {loadingTests ? (
          <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
        ) : tests.length === 0 ? (
          <p className="text-sm text-slate-600">
            No SPEAKING test found. Create one from Test Manager first.
          </p>
        ) : (
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Speaking Test
            </span>
            <select
              value={selectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {tests.map((test) => (
                <option key={test.id} value={test.id}>
                  {test.title} {test.isActive ? "(Active)" : "(Draft)"} - {test.totalQuestions} active prompts
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {selectedTest ? (
        <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
          <form onSubmit={savePromptSets} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Sets for {selectedTest.title}
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addSet}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  + New Set
                </button>
                <button
                  type="button"
                  onClick={duplicateCurrentSet}
                  disabled={!selectedSet}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                >
                  Duplicate Set
                </button>
                <button
                  type="button"
                  onClick={removeCurrentSet}
                  disabled={!selectedSet}
                  className="rounded-lg border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-700 disabled:opacity-60"
                >
                  Delete Set
                </button>
                <button
                  type="button"
                  onClick={exportSetsJson}
                  disabled={sets.length === 0}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={() => importFileRef.current?.click()}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  Import JSON
                </button>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={onImportFile}
                  className="hidden"
                />
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                {success}
              </div>
            ) : null}

            {loadingSets ? (
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {sets.map((set) => {
                    const isSelected = selectedSetId === set.id;
                    const isActiveSet = activeSetId === set.id;
                    return (
                      <button
                        key={set.id}
                        type="button"
                        onClick={() => setSelectedSetId(set.id)}
                        className={[
                          "rounded-xl border p-3 text-left",
                          isSelected
                            ? "border-brand-purple bg-brand-purple/5"
                            : "border-slate-200 bg-white",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{set.name}</p>
                          <span
                            className={[
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              isActiveSet
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-600",
                            ].join(" ")}
                          >
                            {isActiveSet ? "Live" : "Draft"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{set.prompts.length} prompts</p>
                      </button>
                    );
                  })}
                </div>

                {selectedSet ? (
                  <div className="space-y-4 rounded-xl border border-slate-200 p-3">
                    <div className="grid gap-3 md:grid-cols-[1fr_200px]">
                      <Field label="Set Name">
                        <input
                          value={selectedSet.name}
                          onChange={(e) => {
                            const nextName = e.target.value;
                            patchCurrentSet((set) => ({
                              ...set,
                              name: nextName,
                              id: set.id,
                            }));
                          }}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                      </Field>
                      <Field label="Active in Speaking">
                        <button
                          type="button"
                          onClick={() => setActiveSetId(selectedSet.id)}
                          className={[
                            "h-10 w-full rounded-lg border text-sm font-semibold",
                            activeSetId === selectedSet.id
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-slate-300 bg-white text-slate-700",
                          ].join(" ")}
                        >
                          {activeSetId === selectedSet.id ? "Live Set" : "Set as Live"}
                        </button>
                      </Field>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => addPrompt("PART_1")}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                      >
                        + Part 1
                      </button>
                      <button
                        type="button"
                        onClick={() => addPrompt("PART_2_PREP")}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                      >
                        + Part 2 Prep
                      </button>
                      <button
                        type="button"
                        onClick={() => addPrompt("PART_2")}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                      >
                        + Part 2
                      </button>
                      <button
                        type="button"
                        onClick={() => addPrompt("PART_3")}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                      >
                        + Part 3
                      </button>
                    </div>

                    <p className="text-xs text-slate-500">
                      Drag and drop prompt cards to reorder. You can also use up/down arrows.
                    </p>

                    <div className="space-y-3">
                      {selectedSet.prompts.map((row, idx) => (
                        <article
                          key={`${selectedSet.id}-${idx}`}
                          draggable
                          onDragStart={() => setDragFromIndex(idx)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (dragFromIndex === null) return;
                            movePrompt(dragFromIndex, idx);
                            setDragFromIndex(null);
                          }}
                          className="rounded-xl border border-slate-200 p-3"
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Prompt {idx + 1}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => movePrompt(idx, Math.max(0, idx - 1))}
                                disabled={idx === 0}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                              >
                                Up
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  movePrompt(
                                    idx,
                                    Math.min(selectedSet.prompts.length - 1, idx + 1),
                                  )
                                }
                                disabled={idx === selectedSet.prompts.length - 1}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                              >
                                Down
                              </button>
                              <button
                                type="button"
                                onClick={() => removePrompt(idx)}
                                className="rounded-md border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700"
                              >
                                Remove
                              </button>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-4">
                            <Field label="Part">
                              <select
                                value={row.part}
                                onChange={(e) =>
                                  updatePrompt(idx, "part", e.target.value as SpeakingPart)
                                }
                                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                              >
                                <option value="PART_1">PART_1</option>
                                <option value="PART_2_PREP">PART_2_PREP</option>
                                <option value="PART_2">PART_2</option>
                                <option value="PART_3">PART_3</option>
                              </select>
                            </Field>
                            <Field label="Prep (s)">
                              <input
                                type="number"
                                min={0}
                                value={row.prepSeconds}
                                onChange={(e) =>
                                  updatePrompt(idx, "prepSeconds", Number(e.target.value) || 0)
                                }
                                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                              />
                            </Field>
                            <Field label="Target (s)">
                              <input
                                type="number"
                                min={10}
                                value={row.targetAnswerSeconds}
                                onChange={(e) =>
                                  updatePrompt(
                                    idx,
                                    "targetAnswerSeconds",
                                    Number(e.target.value) || 45,
                                  )
                                }
                                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                              />
                            </Field>
                            <Field label="Hard Limit (s)">
                              <input
                                type="number"
                                min={15}
                                value={row.hardLimitSeconds}
                                onChange={(e) =>
                                  updatePrompt(
                                    idx,
                                    "hardLimitSeconds",
                                    Number(e.target.value) || 80,
                                  )
                                }
                                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                              />
                            </Field>
                          </div>

                          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px]">
                            <Field label="Prompt Text">
                              <textarea
                                value={row.prompt}
                                onChange={(e) => updatePrompt(idx, "prompt", e.target.value)}
                                rows={3}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              />
                            </Field>
                            <Field label="Silence Prompt (s)">
                              <input
                                type="number"
                                min={5}
                                value={row.silencePromptSeconds}
                                onChange={(e) =>
                                  updatePrompt(
                                    idx,
                                    "silencePromptSeconds",
                                    Number(e.target.value) || 11,
                                  )
                                }
                                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                              />
                            </Field>
                          </div>
                        </article>
                      ))}

                      {selectedSet.prompts.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                          This set is empty. Add prompts with the buttons above.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || loadingSets}
                className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
              >
                {saving ? "Saving..." : "Save All Sets"}
              </button>
            </div>
          </form>
        </section>
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
