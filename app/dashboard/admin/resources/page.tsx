"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type TestRow = {
  id: string;
  title: string;
  module: "LISTENING" | "READING" | "WRITING" | "SPEAKING";
  variant: "ACADEMIC" | "GENERAL";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  durationMins: number;
  totalQuestions: number;
  isActive: boolean;
  isPractice: boolean;
  description?: string | null;
};

type CreatePayload = {
  title: string;
  module: TestRow["module"];
  variant: TestRow["variant"];
  difficulty: TestRow["difficulty"];
  durationMins: number;
  isPractice: boolean;
  description: string;
};

const FALLBACK_TESTS: TestRow[] = [
  {
    id: "demo-reading-1",
    title: "Reading Practice Set 1",
    module: "READING",
    variant: "ACADEMIC",
    difficulty: "MEDIUM",
    durationMins: 60,
    totalQuestions: 40,
    isActive: true,
    isPractice: true,
    description: "Core academic reading simulation",
  },
  {
    id: "demo-listening-1",
    title: "Listening Mock 1",
    module: "LISTENING",
    variant: "GENERAL",
    difficulty: "MEDIUM",
    durationMins: 35,
    totalQuestions: 40,
    isActive: true,
    isPractice: true,
    description: "Section-based listening drill",
  },
];

export default function AdminResourcesPage() {
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [openCreate, setOpenCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<CreatePayload>({
    title: "",
    module: "READING",
    variant: "ACADEMIC",
    difficulty: "MEDIUM",
    durationMins: 60,
    isPractice: true,
    description: "",
  });

  useEffect(() => {
    let active = true;

    fetch("/api/tests", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load tests");
        const data = (await res.json()) as { tests?: TestRow[] };
        if (!active) return;
        setTests(Array.isArray(data.tests) ? data.tests : FALLBACK_TESTS);
      })
      .catch(() => {
        if (!active) return;
        setTests(FALLBACK_TESTS);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const sortedTests = useMemo(
    () => [...tests].sort((a, b) => a.title.localeCompare(b.title)),
    [tests],
  );

  function updateForm<K extends keyof CreatePayload>(
    key: K,
    value: CreatePayload[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function createTest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusyId("create");

    try {
      const res = await fetch("/api/admin/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = (await res.json().catch(() => null)) as {
        test?: TestRow;
        error?: string;
      } | null;

      if (!res.ok || !data?.test) {
        throw new Error(data?.error || "Failed to create test");
      }

      setTests((prev) => [data.test!, ...prev]);
      setOpenCreate(false);
      setForm({
        title: "",
        module: "READING",
        variant: "ACADEMIC",
        difficulty: "MEDIUM",
        durationMins: 60,
        isPractice: true,
        description: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(test: TestRow) {
    setBusyId(test.id);
    setError(null);
    const next = !test.isActive;

    setTests((prev) =>
      prev.map((t) => (t.id === test.id ? { ...t, isActive: next } : t)),
    );

    try {
      const res = await fetch(`/api/admin/tests/${test.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });

      if (!res.ok) throw new Error("Failed to update test");
    } catch {
      setTests((prev) =>
        prev.map((t) =>
          t.id === test.id ? { ...t, isActive: test.isActive } : t,
        ),
      );
      setError("Unable to update active status right now.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTest(testId: string) {
    if (!confirm("Delete this test? This cannot be undone.")) return;

    setBusyId(testId);
    setError(null);

    const previous = tests;
    setTests((prev) => prev.filter((t) => t.id !== testId));

    try {
      const res = await fetch(`/api/admin/tests/${testId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
    } catch {
      setTests(previous);
      setError("Unable to delete test right now.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-text">Test Manager</h1>
        <p className="mt-1 text-sm text-dash-text-muted">Create, edit, and manage IELTS tests and question workflows.</p>
      </div>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
            All Tests
          </h2>
          <button
            type="button"
            onClick={() => setOpenCreate(true)}
            className="rounded-lg bg-dash-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-dash-accent-muted disabled:opacity-60"
          >
            Create Test
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 h-48 animate-pulse rounded-xl bg-dash-border/50" />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-dash-border text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Module</th>
                  <th className="px-3 py-2 text-left">Variant</th>
                  <th className="px-3 py-2 text-left">Questions</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border">
                {sortedTests.map((test) => (
                  <tr key={test.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-dash-text">{test.title}</p>
                      <p className="text-xs text-dash-text-muted">
                        {test.difficulty}
                      </p>
                    </td>
                    <td className="px-3 py-2">{test.module}</td>
                    <td className="px-3 py-2">{test.variant}</td>
                    <td className="px-3 py-2">{test.totalQuestions}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleActive(test)}
                        disabled={busyId === test.id}
                        className={[
                          "rounded-full px-2 py-1 text-xs font-semibold",
                          test.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-dash-border/50 text-dash-text",
                        ].join(" ")}
                      >
                        {test.isActive ? "Active" : "Draft"}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setOpenCreate(true)}
                          className="rounded-lg border border-dash-border px-2 py-1 text-xs font-semibold text-dash-text"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTest(test.id)}
                          className="rounded-lg border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700"
                        >
                          Delete
                        </button>
                        <Link
                          href={`/dashboard/admin/resources/${test.id}/questions`}
                          className="rounded-lg bg-dash-accent-muted px-2 py-1 text-xs font-semibold text-white"
                        >
                          Add Questions
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {openCreate ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-dash-border bg-dash-surface p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-dash-text">Create Test</h3>
            <form onSubmit={createTest} className="mt-4 space-y-3">
              <Field label="Title">
                <input
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  required
                  className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Module">
                  <select
                    value={form.module}
                    onChange={(e) =>
                      updateForm(
                        "module",
                        e.target.value as CreatePayload["module"],
                      )
                    }
                    className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
                  >
                    {(
                      ["READING", "LISTENING", "WRITING", "SPEAKING"] as const
                    ).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Variant">
                  <select
                    value={form.variant}
                    onChange={(e) =>
                      updateForm(
                        "variant",
                        e.target.value as CreatePayload["variant"],
                      )
                    }
                    className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
                  >
                    <option value="ACADEMIC">ACADEMIC</option>
                    <option value="GENERAL">GENERAL</option>
                  </select>
                </Field>

                <Field label="Difficulty">
                  <select
                    value={form.difficulty}
                    onChange={(e) =>
                      updateForm(
                        "difficulty",
                        e.target.value as CreatePayload["difficulty"],
                      )
                    }
                    className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
                  >
                    <option value="EASY">EASY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HARD">HARD</option>
                  </select>
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Duration (mins)">
                  <input
                    type="number"
                    min={1}
                    value={form.durationMins}
                    onChange={(e) =>
                      updateForm("durationMins", Number(e.target.value) || 60)
                    }
                    className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
                  />
                </Field>

                <Field label="Practice Test">
                  <select
                    value={String(form.isPractice)}
                    onChange={(e) =>
                      updateForm("isPractice", e.target.value === "true")
                    }
                    className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
                />
              </Field>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpenCreate(false)}
                  className="rounded-lg border border-dash-border px-4 py-2 text-sm font-semibold text-dash-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyId === "create"}
                  className="rounded-lg bg-dash-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-dash-accent-muted disabled:opacity-60"
                >
                  {busyId === "create" ? "Saving..." : "Save Test"}
                </button>
              </div>
            </form>
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
      <span className="mb-1 block text-[13px] font-medium text-dash-text">
        {label}
      </span>
      {children}
    </label>
  );
}
