"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const STAGES = [
  {
    title: "Create / Select Speaking Test",
    body: "Create a SPEAKING test shell from Test Manager first.",
  },
  {
    title: "Author Prompt Sets",
    body: "Use Speaking Prompts page to create named sets and reorder prompts.",
  },
  {
    title: "Set Live",
    body: "Mark one set as Live. Student speaking engine will use this set.",
  },
  {
    title: "Publish & Monitor",
    body: "Open analytics to monitor speaking attempt usage and quality.",
  },
];

type StageState = "DRAFT" | "READY" | "LIVE";

function stageStatus(index: number): StageState {
  if (index < 2) return "READY";
  if (index === 2) return "LIVE";
  return "DRAFT";
}

const STATUS_CLS: Record<StageState, string> = {
  DRAFT: "bg-dash-bg text-dash-text",
  READY: "bg-amber-100 text-amber-700",
  LIVE: "bg-emerald-100 text-emerald-700",
};

export default function SpeakingStudioPage() {
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<
    Array<{
      id: string;
      title: string;
      isActive: boolean;
      speakingPromptSets?: Array<{ id: string; name: string; promptCount?: number }>;
      activeSpeakingSetId?: string | null;
    }>
  >([]);

  useEffect(() => {
    let active = true;
    fetch("/api/tests?module=SPEAKING&fresh=1", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load speaking tests");
        const data = (await res.json()) as {
          tests?: Array<{
            id: string;
            title: string;
            isActive: boolean;
            speakingPromptSets?: Array<{ id: string; name: string; promptCount?: number }>;
            activeSpeakingSetId?: string | null;
          }>;
        };
        if (!active) return;
        setTests(Array.isArray(data.tests) ? data.tests : []);
      })
      .catch(() => {
        if (!active) return;
        setTests([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const cards = useMemo(
    () =>
      STAGES.map((stage, index) => ({
        ...stage,
        status: stageStatus(index),
      })),
    [],
  );

  const speakingCoverage = useMemo(() => {
    const totalTests = tests.length;
    const liveTests = tests.filter((test) => test.isActive).length;
    let totalSets = 0;
    let liveSets = 0;
    for (const test of tests) {
      const sets = Array.isArray(test.speakingPromptSets) ? test.speakingPromptSets : [];
      totalSets += sets.length;
      const activeId = test.activeSpeakingSetId || null;
      if (activeId && sets.some((set) => set.id === activeId)) {
        liveSets += 1;
      }
    }
    return { totalTests, liveTests, totalSets, liveSets };
  }, [tests]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-text">Speaking Studio</h1>
        <p className="mt-1 text-sm text-dash-text-muted">Dedicated studio for speaking set lifecycle, live-set control, and safer publishing.</p>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Speaking Tests" value={String(speakingCoverage.totalTests)} />
        <Metric label="Live Speaking Tests" value={String(speakingCoverage.liveTests)} />
        <Metric label="Named Sets" value={String(speakingCoverage.totalSets)} />
        <Metric label="Tests With Live Set" value={String(speakingCoverage.liveSets)} />
      </section>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/admin/speaking-prompts"
            className="rounded-lg bg-dash-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-dash-accent-muted disabled:opacity-60"
          >
            Open Prompt Set Manager
          </Link>
          <Link
            href="/dashboard/admin/resources"
            className="rounded-lg border border-dash-border px-4 py-2 text-sm font-semibold text-dash-text"
          >
            Open Test Manager
          </Link>
          <Link
            href="/dashboard/admin/analytics"
            className="rounded-lg border border-dash-border px-4 py-2 text-sm font-semibold text-dash-text"
          >
            Open Analytics
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {cards.map((card, idx) => (
          <article key={idx} className="rounded-xl border border-dash-border bg-dash-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-dash-text">{card.title}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${STATUS_CLS[card.status]}`}
              >
                {card.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-dash-text-muted">{card.body}</p>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
          Speaking Set Inspector
        </h2>

        {loading ? (
          <div className="mt-3 h-28 animate-pulse rounded-xl bg-dash-border/50" />
        ) : tests.length ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {tests.map((test) => {
              const sets = Array.isArray(test.speakingPromptSets) ? test.speakingPromptSets : [];
              return (
                <article key={test.id} className="rounded-xl border border-dash-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-dash-text">{test.title}</p>
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase",
                        test.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-dash-bg text-dash-text",
                      ].join(" ")}
                    >
                      {test.isActive ? "Live Test" : "Draft Test"}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-dash-text-muted">
                    Named sets: {sets.length}
                  </p>

                  <div className="mt-2 space-y-1">
                    {sets.length ? (
                      sets.map((set) => {
                        const isLiveSet = set.id === test.activeSpeakingSetId;
                        return (
                          <div
                            key={set.id}
                            className="flex items-center justify-between rounded-lg border border-dash-border px-2 py-1 text-xs"
                          >
                            <span className="text-dash-text">
                              {set.name}{" "}
                              {typeof set.promptCount === "number"
                                ? `(${set.promptCount})`
                                : ""}
                            </span>
                            <span
                              className={[
                                "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase",
                                isLiveSet
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-dash-bg text-dash-text-muted",
                              ].join(" ")}
                            >
                              {isLiveSet ? "Live Set" : "Draft"}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-dash-text-muted">No sets configured yet.</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-dash-text-muted">No speaking tests found.</p>
        )}
      </section>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
          Studio Notes
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-dash-text">
          <li>Keep one live set at a time for predictable student flow.</li>
          <li>Use duplicate set for safe versioning and iterative improvements.</li>
          <li>Import/export JSON to sync question sets between environments.</li>
          <li>Keep draft/ready/live/archived lifecycle for governance.</li>
        </ul>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-dash-border bg-dash-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-dash-text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-dash-text">{value}</p>
    </article>
  );
}
