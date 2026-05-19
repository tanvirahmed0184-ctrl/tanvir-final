"use client";

import { useEffect, useMemo, useState } from "react";

type EvalModule = "SPEAKING" | "WRITING";

type EvaluationItem = {
  id: string;
  attemptId: string;
  studentName: string;
  studentEmail: string;
  module: EvalModule;
  overallBand: number;
  createdAt: string;
  strengths: string[];
  weaknesses: string[];
  summary: string;
  status: "READY" | "REVIEWED";
};

const FALLBACK_EVALUATIONS: EvaluationItem[] = [
  {
    id: "EV-9001",
    attemptId: "WA-2001",
    studentName: "Nadia Rahman",
    studentEmail: "nadia.rahman@example.com",
    module: "WRITING",
    overallBand: 6.5,
    createdAt: "2026-03-15T08:40:00.000Z",
    strengths: ["Clear paragraphing", "Strong task response focus"],
    weaknesses: ["Limited lexical range", "Grammar slips in complex sentences"],
    summary:
      "Good structure and relevance to prompt. Improve variety in vocabulary and sentence control to push toward band 7.",
    status: "READY",
  },
  {
    id: "EV-9002",
    attemptId: "SP-4102",
    studentName: "Arif Hasan",
    studentEmail: "arif.hasan@example.com",
    module: "SPEAKING",
    overallBand: 6.0,
    createdAt: "2026-03-15T09:05:00.000Z",
    strengths: ["Natural fluency in familiar topics", "Good interaction"],
    weaknesses: ["Frequent repetition", "Pronunciation clarity drops at speed"],
    summary:
      "Communication is generally effective. Work on lexical flexibility and clearer final consonants for higher scores.",
    status: "READY",
  },
  {
    id: "EV-9003",
    attemptId: "WA-2002",
    studentName: "Sadia Akter",
    studentEmail: "sadia.akter@example.com",
    module: "WRITING",
    overallBand: 7.0,
    createdAt: "2026-03-14T15:12:00.000Z",
    strengths: ["Accurate grammar", "Strong cohesion devices"],
    weaknesses: ["Some overlong sentences"],
    summary:
      "Band 7-level control overall. Tighten sentence length and precision in examples to stabilize consistency.",
    status: "REVIEWED",
  },
  {
    id: "EV-9004",
    attemptId: "SP-4103",
    studentName: "Mahin Islam",
    studentEmail: "mahin.islam@example.com",
    module: "SPEAKING",
    overallBand: 5.5,
    createdAt: "2026-03-14T16:02:00.000Z",
    strengths: ["Attempts extended answers"],
    weaknesses: [
      "Frequent pauses",
      "Basic vocabulary",
      "Grammar inconsistency",
    ],
    summary:
      "Needs stronger idea development and grammar accuracy. Daily fluency drills and collocation practice recommended.",
    status: "READY",
  },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InstructorEvaluationsPage() {
  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState<EvaluationItem[]>([]);
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState<"ALL" | EvalModule>("ALL");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "READY" | "REVIEWED"
  >("ALL");

  useEffect(() => {
    let active = true;

    fetch("/api/instructor/evaluations", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load evaluations");
        const data = (await res.json()) as { evaluations?: EvaluationItem[] };
        if (!active) return;
        setEvaluations(
          Array.isArray(data.evaluations)
            ? data.evaluations
            : FALLBACK_EVALUATIONS,
        );
      })
      .catch(() => {
        if (!active) return;
        setEvaluations(FALLBACK_EVALUATIONS);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();

    return evaluations
      .filter((e) =>
        moduleFilter === "ALL" ? true : e.module === moduleFilter,
      )
      .filter((e) =>
        statusFilter === "ALL" ? true : e.status === statusFilter,
      )
      .filter((e) => {
        if (!term) return true;
        return (
          e.studentName.toLowerCase().includes(term) ||
          e.studentEmail.toLowerCase().includes(term) ||
          e.attemptId.toLowerCase().includes(term) ||
          e.id.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [evaluations, query, moduleFilter, statusFilter]);

  const stats = useMemo(
    () => ({
      total: evaluations.length,
      writing: evaluations.filter((e) => e.module === "WRITING").length,
      speaking: evaluations.filter((e) => e.module === "SPEAKING").length,
      avgBand:
        evaluations.length > 0
          ? evaluations.reduce((sum, e) => sum + e.overallBand, 0) /
            evaluations.length
          : 0,
    }),
    [evaluations],
  );

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-brand-purple via-brand-purple-dark to-brand-teal p-5 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Evaluation Review</h1>
        <p className="mt-2 text-sm text-white/85">
          Monitor speaking and writing assessments with strengths, weaknesses,
          and summaries.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Total Evaluations"
          value={stats.total.toLocaleString()}
        />
        <MetricCard label="Writing" value={stats.writing.toLocaleString()} />
        <MetricCard label="Speaking" value={stats.speaking.toLocaleString()} />
        <MetricCard label="Average Band" value={stats.avgBand.toFixed(1)} />
      </section>

      <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-60 flex-1 text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by learner, email, attempt ID, or eval ID"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Module
            </span>
            <select
              value={moduleFilter}
              onChange={(e) =>
                setModuleFilter(e.target.value as "ALL" | EvalModule)
              }
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="ALL">All</option>
              <option value="WRITING">Writing</option>
              <option value="SPEAKING">Speaking</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "ALL" | "READY" | "REVIEWED")
              }
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="ALL">All</option>
              <option value="READY">Ready</option>
              <option value="REVIEWED">Reviewed</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div className="mt-4 h-56 animate-pulse rounded-xl bg-slate-200" />
        ) : filtered.length ? (
          <div className="mt-4 grid gap-3">
            {filtered.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">
                      {item.id} - {item.attemptId}
                    </p>
                    <h2 className="mt-1 text-base font-bold text-slate-900">
                      {item.studentName}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {item.studentEmail}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-500">
                      {formatDate(item.createdAt)}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {item.module} - Band {item.overallBand.toFixed(1)}
                    </p>
                    <span
                      className={[
                        "mt-1 inline-block rounded-full px-2 py-1 text-xs font-semibold",
                        item.status === "READY"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700",
                      ].join(" ")}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>

                <p className="mt-3 text-sm text-slate-700">{item.summary}</p>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Strengths
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-emerald-800">
                      {item.strengths.map((s, i) => (
                        <li key={`${item.id}-s-${i}`}>- {s}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg bg-rose-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                      Weaknesses
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-rose-800">
                      {item.weaknesses.map((w, i) => (
                        <li key={`${item.id}-w-${i}`}>- {w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            No evaluations found for current filters.
          </p>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    </article>
  );
}
