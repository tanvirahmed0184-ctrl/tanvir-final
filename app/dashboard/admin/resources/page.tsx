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
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-brand-purple via-brand-purple-dark to-brand-teal p-5 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Test Manager</h1>
        <p className="mt-2 text-sm text-white/85">
          Create, edit, and manage IELTS tests and question workflows.
        </p>
      </section>

      <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            All Tests
          </h2>
          <button
            type="button"
            onClick={() => setOpenCreate(true)}
            className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white"
          >
            Create Test
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 h-48 animate-pulse rounded-xl bg-slate-200" />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
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
              <tbody className="divide-y divide-slate-100">
                {sortedTests.map((test) => (
                  <tr key={test.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-900">{test.title}</p>
                      <p className="text-xs text-slate-500">
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
                            : "bg-slate-200 text-slate-700",
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
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
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
                          className="rounded-lg bg-brand-teal px-2 py-1 text-xs font-semibold text-white"
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
          <div className="w-full max-w-lg rounded-2xl border border-brand-purple/20 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Create Test</h3>
            <form onSubmit={createTest} className="mt-4 space-y-3">
              <Field label="Title">
                <input
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </Field>

                <Field label="Practice Test">
                  <select
                    value={String(form.isPractice)}
                    onChange={(e) =>
                      updateForm("isPractice", e.target.value === "true")
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpenCreate(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyId === "create"}
                  className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
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
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
