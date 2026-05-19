"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ModuleInput = "READING" | "LISTENING" | "WRITING";
type VariantInput = "ACADEMIC" | "GENERAL";
type DifficultyInput = "EASY" | "MEDIUM" | "HARD";
type KindInput = "PRACTICE" | "MOCK" | "FINAL";
type ListeningAudioMode = "single_full_audio" | "sequential_section_audio";
const DEFAULT_SECTION_TRANSITION_MESSAGE =
  "Now, starting another section, be prepared.";

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
  module: ModuleInput | "SPEAKING";
  sectionPart: number;
  media: PassageMedia[];
};

type BankQuestion = {
  id: string;
  questionText: string;
  type: string;
  options: Array<{
    id: string;
    label: string;
    text: string;
  }>;
};

type WritingPrompt = {
  id: string;
  title: string;
  taskType: "TASK_1_ACADEMIC" | "TASK_1_GENERAL" | "TASK_2";
  promptText: string;
  imageUrl?: string | null;
  difficulty: DifficultyInput;
};

type PartState = {
  part: number;
  passageId: string;
  selectedQuestionIds: string[];
};

function expectedParts(module: ModuleInput): number {
  if (module === "READING") return 3;
  if (module === "LISTENING") return 4;
  return 2;
}

function partLimit(module: ModuleInput): number {
  if (module === "READING") return 14;
  if (module === "LISTENING") return 10;
  return 1;
}

function isReadingPartValid(count: number): boolean {
  return count >= 13 && count <= 14;
}

export default function AdminQuestionMapPage() {
  const hasLoadedInitialData = useRef(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [module, setModule] = useState<ModuleInput>("READING");
  const [variant, setVariant] = useState<VariantInput>("ACADEMIC");
  const [difficulty, setDifficulty] = useState<DifficultyInput>("MEDIUM");
  const [kind, setKind] = useState<KindInput>("PRACTICE");
  const [durationMins, setDurationMins] = useState(60);
  const [listeningAudioMode, setListeningAudioMode] =
    useState<ListeningAudioMode>("sequential_section_audio");
  const [listeningSectionPauseSeconds, setListeningSectionPauseSeconds] =
    useState(10);
  const [listeningSectionTransitionMessage, setListeningSectionTransitionMessage] =
    useState(DEFAULT_SECTION_TRANSITION_MESSAGE);

  const [passages, setPassages] = useState<PassageRow[]>([]);
  const [questionCache, setQuestionCache] = useState<
    Record<string, BankQuestion[]>
  >({});
  const [parts, setParts] = useState<PartState[]>([
    { part: 1, passageId: "", selectedQuestionIds: [] },
    { part: 2, passageId: "", selectedQuestionIds: [] },
    { part: 3, passageId: "", selectedQuestionIds: [] },
  ]);

  const [prompts, setPrompts] = useState<WritingPrompt[]>([]);
  const [task1PromptId, setTask1PromptId] = useState("");
  const [task2PromptId, setTask2PromptId] = useState("");
  const [task1ImageUrl, setTask1ImageUrl] = useState("");
  const [task2ImageUrl, setTask2ImageUrl] = useState("");

  const filteredPassages = useMemo(
    () =>
      passages.filter((p) => {
        if (p.module !== module) return false;
        if (module === "LISTENING") {
          return p.media.some((m) => m.type === "AUDIO");
        }
        return true;
      }),
    [passages, module],
  );

  const task1Prompts = useMemo(
    () => prompts.filter((p) => p.taskType !== "TASK_2"),
    [prompts],
  );
  const task2Prompts = useMemo(
    () => prompts.filter((p) => p.taskType === "TASK_2"),
    [prompts],
  );
  const selectedTask1Prompt = useMemo(
    () => task1Prompts.find((p) => p.id === task1PromptId) || null,
    [task1Prompts, task1PromptId],
  );
  const selectedTask2Prompt = useMemo(
    () => task2Prompts.find((p) => p.id === task2PromptId) || null,
    [task2Prompts, task2PromptId],
  );

  const totalSelected = useMemo(
    () => parts.reduce((sum, p) => sum + p.selectedQuestionIds.length, 0),
    [parts],
  );

  useEffect(() => {
    setDurationMins(module === "LISTENING" ? 30 : 60);
    const count = expectedParts(module);
    setParts(
      Array.from({ length: count }).map((_, i) => ({
        part: i + 1,
        passageId: "",
        selectedQuestionIds: [],
      })),
    );
  }, [module]);

  useEffect(() => {
    if (hasLoadedInitialData.current) return;
    hasLoadedInitialData.current = true;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [passageRes, promptRes] = await Promise.all([
          fetch("/api/admin/passages?lite=1", { cache: "no-store" }),
          fetch("/api/writing/prompts", { cache: "no-store" }),
        ]);

        const passageData = (await passageRes.json().catch(() => null)) as {
          passages?: PassageRow[];
          error?: string;
        } | null;
        if (!passageRes.ok) {
          throw new Error(passageData?.error || "Failed to load passages");
        }
        setPassages(
          Array.isArray(passageData?.passages) ? passageData!.passages! : [],
        );

        const promptData = (await promptRes.json().catch(() => null)) as {
          prompts?: WritingPrompt[];
          error?: string;
        } | null;
        if (!promptRes.ok) {
          throw new Error(
            promptData?.error || "Failed to load writing prompts",
          );
        }
        setPrompts(
          Array.isArray(promptData?.prompts) ? promptData!.prompts! : [],
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function ensureQuestionsLoaded(passageId: string) {
    if (!passageId || questionCache[passageId]) return;
    const res = await fetch(`/api/admin/questions/by-passage/${passageId}`, {
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as {
      questions?: BankQuestion[];
      error?: string;
    } | null;

    if (!res.ok) {
      throw new Error(data?.error || "Failed to load linked questions");
    }

    setQuestionCache((prev) => ({
      ...prev,
      [passageId]: Array.isArray(data?.questions) ? data!.questions! : [],
    }));
  }

  async function onSelectPassage(part: number, passageId: string) {
    setError(null);
    setMessage(null);
    try {
      if (passageId) {
        await ensureQuestionsLoaded(passageId);
      }
      setParts((prev) =>
        prev.map((p) =>
          p.part === part ? { ...p, passageId, selectedQuestionIds: [] } : p,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load questions");
    }
  }

  function toggleQuestion(part: number, questionId: string) {
    const max = partLimit(module);
    setParts((prev) =>
      prev.map((p) => {
        if (p.part !== part) return p;
        const selected = p.selectedQuestionIds.includes(questionId);
        if (selected) {
          return {
            ...p,
            selectedQuestionIds: p.selectedQuestionIds.filter(
              (id) => id !== questionId,
            ),
          };
        }
        if (p.selectedQuestionIds.length >= max) {
          return p;
        }
        return {
          ...p,
          selectedQuestionIds: [...p.selectedQuestionIds, questionId],
        };
      }),
    );
  }

  const compliance = useMemo(() => {
    if (module === "WRITING") {
      const writingValid = Boolean(task1PromptId && task2PromptId);
      return {
        pass: writingValid,
        lines: [
          {
            label: "Task 1 + Task 2 selected",
            ok: writingValid,
          },
        ],
      };
    }

    if (module === "READING") {
      const partsValid = parts.every((p) =>
        isReadingPartValid(p.selectedQuestionIds.length),
      );
      const sourcesValid = parts.every((p) => Boolean(p.passageId));
      return {
        pass:
          partsValid &&
          totalSelected === 40 &&
          sourcesValid &&
          parts.length === 3,
        lines: [
          {
            label: "3 passages selected",
            ok: parts.length === 3 && sourcesValid,
          },
          { label: "13-14 questions each passage", ok: partsValid },
          { label: "Total 40 questions", ok: totalSelected === 40 },
        ],
      };
    }

    const partsValid = parts.every((p) => p.selectedQuestionIds.length === 10);
    const sourcesValid = parts.every((p) => Boolean(p.passageId));
    return {
      pass:
        partsValid &&
        totalSelected === 40 &&
        sourcesValid &&
        parts.length === 4,
      lines: [
        {
          label: "4 listening sections selected",
          ok: parts.length === 4 && sourcesValid,
        },
        { label: "10 questions each section", ok: partsValid },
        { label: "Total 40 questions", ok: totalSelected === 40 },
      ],
    };
  }, [module, parts, task1PromptId, task2PromptId, totalSelected]);

  async function createTest() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload =
        module === "WRITING"
          ? {
              title,
              description,
              module,
              variant,
              difficulty,
              kind,
              durationMins,
              writing: {
                task1PromptId,
                task2PromptId,
                task1ImageUrl,
                task2ImageUrl,
              },
            }
          : {
              title,
              description,
              module,
              variant,
              difficulty,
              kind,
              durationMins,
              sections: parts.map((p) => ({
                part: p.part,
                passageId: p.passageId,
                questionIds: p.selectedQuestionIds,
              })),
              listeningAudioMode:
                module === "LISTENING" ? listeningAudioMode : undefined,
              listeningSectionPauseSeconds:
                module === "LISTENING" ? listeningSectionPauseSeconds : undefined,
              listeningSectionTransitionMessage:
                module === "LISTENING"
                  ? listeningSectionTransitionMessage
                  : undefined,
            };

      const res = await fetch("/api/admin/question-map/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => null)) as {
        testId?: string;
        error?: string;
        detail?: string;
      } | null;
      if (!res.ok || !data?.testId) {
        const detail = typeof data?.detail === "string" ? data.detail : "";
        const parts = [data?.error || "Failed to create test", detail].filter(
          Boolean,
        );
        throw new Error(parts.join("\n"));
      }

      setMessage(`Test created successfully. New test id: ${data.testId}`);
      setStep(1);
      setTitle("");
      setDescription("");
      setTask1PromptId("");
      setTask2PromptId("");
      setTask1ImageUrl("");
      setTask2ImageUrl("");
      setParts((prev) =>
        prev.map((p) => ({ ...p, passageId: "", selectedQuestionIds: [] })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create test failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-brand-purple via-brand-purple-dark to-brand-teal p-5 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Question Map Builder</h1>
        <p className="mt-2 text-sm text-white/85">
          Build tests from linked question bank items with IELTS rule checks.
        </p>
      </section>

      <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStep(n)}
              className={[
                "rounded-xl px-4 py-2 text-sm font-semibold",
                step === n
                  ? "bg-brand-purple text-white"
                  : "bg-slate-100 text-slate-700",
              ].join(" ")}
            >
              Step {n}
            </button>
          ))}
        </div>
      </section>

      {step === 1 ? (
        <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Step 1 - Test Setup
          </h2>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Test Name">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Module">
              <select
                value={module}
                onChange={(e) => setModule(e.target.value as ModuleInput)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="READING">READING</option>
                <option value="LISTENING">LISTENING</option>
                <option value="WRITING">WRITING</option>
              </select>
            </Field>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Test Type">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as KindInput)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="PRACTICE">PRACTICE</option>
                <option value="MOCK">MOCK</option>
                <option value="FINAL">FINAL</option>
              </select>
            </Field>

            <Field label="Variant">
              <select
                value={variant}
                onChange={(e) => setVariant(e.target.value as VariantInput)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="ACADEMIC">ACADEMIC</option>
                <option value="GENERAL">GENERAL</option>
              </select>
            </Field>

            <Field label="Difficulty">
              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value as DifficultyInput)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="EASY">EASY</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
              </select>
            </Field>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Duration (minutes)">
              <input
                type="number"
                min={10}
                max={240}
                value={durationMins}
                onChange={(e) =>
                  setDurationMins(Math.max(10, Number(e.target.value) || 60))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Description (optional)">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          {module === "LISTENING" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Listening Audio Structure">
                <select
                  value={listeningAudioMode}
                  onChange={(e) =>
                    setListeningAudioMode(e.target.value as ListeningAudioMode)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="sequential_section_audio">
                    Sequential section audio (S1 -&gt; S4)
                  </option>
                  <option value="single_full_audio">
                    Single full-test audio (~30 min)
                  </option>
                </select>
              </Field>
              <Field label="Pause Between Sections (seconds)">
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={listeningSectionPauseSeconds}
                  onChange={(e) =>
                    setListeningSectionPauseSeconds(
                      Math.max(0, Math.min(120, Number(e.target.value) || 0)),
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Section Transition Voice Message">
                <input
                  value={listeningSectionTransitionMessage}
                  onChange={(e) => setListeningSectionTransitionMessage(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder={DEFAULT_SECTION_TRANSITION_MESSAGE}
                />
              </Field>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!title.trim()}
            className="mt-4 rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Continue to Step 2
          </button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Step 2 - Mapping
          </h2>

          {loading ? (
            <div className="mt-3 h-40 animate-pulse rounded-xl bg-slate-200" />
          ) : module === "WRITING" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <article className="space-y-3 rounded-xl border border-slate-200 p-3">
                <Field label="Task 1 Prompt">
                  <select
                    value={task1PromptId}
                    onChange={(e) => setTask1PromptId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select Task 1</option>
                    {task1Prompts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </Field>

                {selectedTask1Prompt ? (
                  <div className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                    <p className="font-semibold">Prompt Preview</p>
                    <p className="mt-1 line-clamp-4">
                      {selectedTask1Prompt.promptText}
                    </p>
                  </div>
                ) : null}

                {task1ImageUrl || selectedTask1Prompt?.imageUrl ? (
                  <img
                    src={task1ImageUrl || selectedTask1Prompt?.imageUrl || ""}
                    alt="Task 1 visual"
                    className="max-h-44 w-full rounded-lg border border-slate-200 object-contain"
                  />
                ) : null}

                <Field label="Task 1 Image URL (optional)">
                  <input
                    value={task1ImageUrl}
                    onChange={(e) => setTask1ImageUrl(e.target.value)}
                    placeholder={selectedTask1Prompt?.imageUrl || "https://..."}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </Field>
              </article>

              <article className="space-y-3 rounded-xl border border-slate-200 p-3">
                <Field label="Task 2 Prompt">
                  <select
                    value={task2PromptId}
                    onChange={(e) => setTask2PromptId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select Task 2</option>
                    {task2Prompts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </Field>

                {selectedTask2Prompt ? (
                  <div className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                    <p className="font-semibold">Prompt Preview</p>
                    <p className="mt-1 line-clamp-4">
                      {selectedTask2Prompt.promptText}
                    </p>
                  </div>
                ) : null}

                {task2ImageUrl || selectedTask2Prompt?.imageUrl ? (
                  <img
                    src={task2ImageUrl || selectedTask2Prompt?.imageUrl || ""}
                    alt="Task 2 visual"
                    className="max-h-44 w-full rounded-lg border border-slate-200 object-contain"
                  />
                ) : null}

                <Field label="Task 2 Image URL (optional)">
                  <input
                    value={task2ImageUrl}
                    onChange={(e) => setTask2ImageUrl(e.target.value)}
                    placeholder={selectedTask2Prompt?.imageUrl || "https://..."}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </Field>
              </article>
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              {parts.map((p) => {
                const selectedPassage = filteredPassages.find(
                  (x) => x.id === p.passageId,
                );
                const linkedQuestions = p.passageId
                  ? questionCache[p.passageId] || []
                  : [];
                const max = partLimit(module);
                const count = p.selectedQuestionIds.length;
                const otherSelectedPassages = new Set(
                  parts
                    .filter((x) => x.part !== p.part)
                    .map((x) => x.passageId)
                    .filter(Boolean),
                );

                return (
                  <article
                    key={p.part}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {module === "READING"
                          ? `Passage ${p.part}`
                          : `Section ${p.part}`}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Selected: {count}/{max}
                      </p>
                    </div>

                    <div className="mt-2">
                      <select
                        value={p.passageId}
                        onChange={(e) =>
                          void onSelectPassage(p.part, e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">Select linked source</option>
                        {filteredPassages
                          .filter(
                            (passage) =>
                              passage.id === p.passageId ||
                              !otherSelectedPassages.has(passage.id),
                          )
                          .map((passage) => (
                            <option key={passage.id} value={passage.id}>
                              {passage.title} (Part {passage.sectionPart})
                            </option>
                          ))}
                      </select>
                    </div>

                    {selectedPassage ? (
                      <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                        <p>
                          {selectedPassage.content
                            ? `${selectedPassage.content.slice(0, 140)}...`
                            : "No text content (media-only source)."}
                        </p>
                        <p className="mt-1">
                          Media:{" "}
                          {selectedPassage.media.length
                            ? selectedPassage.media
                                .map((m) => m.type)
                                .join(", ")
                            : "None"}
                        </p>
                      </div>
                    ) : null}

                    {linkedQuestions.length ? (
                      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
                        {linkedQuestions.map((q) => {
                          const checked = p.selectedQuestionIds.includes(q.id);
                          const disableNew = !checked && count >= max;
                          return (
                            <label
                              key={q.id}
                              className="block rounded-lg border border-slate-100 p-2 text-sm"
                            >
                              <div className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={disableNew}
                                  onChange={() => toggleQuestion(p.part, q.id)}
                                  className="mt-1"
                                />
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">
                                    {q.type}
                                  </p>
                                  <p className="text-slate-700">
                                    {q.questionText}
                                  </p>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    ) : p.passageId ? (
                      <p className="mt-3 text-sm text-slate-500">
                        No linked questions found for this source.
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white"
            >
              Continue to Review
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Step 3 - Review & Create
          </h2>

          <div className="mt-3 rounded-xl border border-slate-200 p-3 text-sm">
            <p>
              <span className="font-semibold">Name:</span> {title || "-"}
            </p>
            <p>
              <span className="font-semibold">Module:</span> {module}
            </p>
            <p>
              <span className="font-semibold">Type:</span> {kind}
            </p>
            <p>
              <span className="font-semibold">Variant:</span> {variant}
            </p>
            <p>
              <span className="font-semibold">Difficulty:</span> {difficulty}
            </p>
            {module === "LISTENING" ? (
              <>
                <p>
                  <span className="font-semibold">Audio structure:</span>{" "}
                  {listeningAudioMode === "single_full_audio"
                    ? "Single full-test audio"
                    : "Sequential section audio"}
                </p>
                <p>
                  <span className="font-semibold">Section pause:</span>{" "}
                  {listeningSectionPauseSeconds}s
                </p>
                <p>
                  <span className="font-semibold">Transition message:</span>{" "}
                  {listeningSectionTransitionMessage}
                </p>
              </>
            ) : null}
            {module !== "WRITING" ? (
              <p>
                <span className="font-semibold">Total selected questions:</span>{" "}
                {totalSelected}
              </p>
            ) : null}
          </div>

          <div className="mt-3 space-y-2">
            {compliance.lines.map((line) => (
              <p
                key={line.label}
                className={[
                  "rounded-lg px-3 py-2 text-sm",
                  line.ok
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700",
                ].join(" ")}
              >
                {line.ok ? "✓" : "✗"} {line.label}
              </p>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Back
            </button>
            <button
              type="button"
              onClick={createTest}
              disabled={saving || !compliance.pass || !title.trim()}
              className="rounded-xl bg-brand-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create Test"}
            </button>
          </div>
        </section>
      ) : null}

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
