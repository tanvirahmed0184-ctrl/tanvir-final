"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Library,
  Mic2,
  Radio,
  ShieldCheck,
} from "lucide-react";

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
        <p className="workspace-section-title">Speaking operations</p>
        <h1 className="mt-4 text-3xl font-semibold text-dash-text md:text-4xl">
          Speaking Studio
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-dash-text-muted md:text-base">
          A dedicated control room for speaking prompt-set lifecycle, live-set
          governance, test shell alignment, analytics, and safe publishing.
        </p>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <article className="rounded-3xl border border-dash-border bg-dash-surface p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="workspace-section-title">Control panel</p>
              <h2 className="mt-3 text-xl font-semibold text-dash-text">
                Prompt sets, live routing, and publishing confidence
              </h2>
              <p className="mt-2 text-sm leading-6 text-dash-text-muted">
                Keep one active speaking experience per test while still
                allowing safe drafting, duplication, JSON movement, and
                analytics review.
              </p>
            </div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-dash-accent-light text-dash-accent">
              <Mic2 size={20} />
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Speaking Tests" value={String(speakingCoverage.totalTests)} />
            <Metric label="Live Tests" value={String(speakingCoverage.liveTests)} />
            <Metric label="Named Sets" value={String(speakingCoverage.totalSets)} />
            <Metric label="Live Set Linked" value={String(speakingCoverage.liveSets)} />
          </div>
        </article>

        <article className="rounded-3xl border border-dash-border bg-dash-surface p-5">
          <p className="workspace-section-title">Lifecycle</p>
          <div className="mt-5 space-y-3">
            {[
              { title: "Draft set", icon: Library },
              { title: "Assign to test", icon: ShieldCheck },
              { title: "Set live", icon: Radio },
              { title: "Watch usage", icon: Activity },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex items-center gap-3 rounded-2xl border border-dash-border/80 bg-white/65 px-3 py-3"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-dash-accent-light text-dash-accent">
                    <Icon size={16} />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-dash-accent">
                      0{index + 1}
                    </p>
                    <p className="text-sm font-semibold text-dash-text">
                      {item.title}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-dash-border bg-dash-surface p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Link
            href="/dashboard/admin/speaking-prompts"
            className="group flex items-center justify-between rounded-2xl bg-dash-accent px-4 py-3 text-sm font-semibold text-white"
          >
            <span className="inline-flex items-center gap-2">
              <Library size={16} />
              Prompt Set Manager
            </span>
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/dashboard/admin/resources"
            className="group flex items-center justify-between rounded-2xl border border-dash-border px-4 py-3 text-sm font-semibold text-dash-text"
          >
            <span className="inline-flex items-center gap-2">
              <Mic2 size={16} />
              Test Manager
            </span>
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/dashboard/admin/analytics"
            className="group flex items-center justify-between rounded-2xl border border-dash-border px-4 py-3 text-sm font-semibold text-dash-text"
          >
            <span className="inline-flex items-center gap-2">
              <BarChart3 size={16} />
              Analytics
            </span>
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
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
    <article className="rounded-2xl border border-dash-border/80 bg-white/65 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-dash-text-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-dash-text">{value}</p>
    </article>
  );
}
