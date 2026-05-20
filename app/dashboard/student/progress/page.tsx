"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/contexts/auth-context";

type AttemptPoint = {
  id: string;
  date: string;
  module: "READING" | "LISTENING" | "WRITING" | "SPEAKING";
  band: number;
  status: string;
  source?: "test_attempt" | "booking" | "ai_speaking";
  reviewPath?: string;
};

type TrendPoint = {
  date: string;
  reading: number;
  listening: number;
  writing: number;
  speaking: number;
};

type WeaknessRow = {
  questionType: string;
  wrongPercent: number;
};

const MOCK_ATTEMPTS: AttemptPoint[] = [
  {
    id: "AT-401",
    date: "2026-02-18",
    module: "READING",
    band: 5.5,
    status: "EVALUATED",
    source: "test_attempt",
    reviewPath: "/dashboard/student/overview",
  },
  {
    id: "AT-428",
    date: "2026-02-22",
    module: "LISTENING",
    band: 6.0,
    status: "EVALUATED",
    source: "test_attempt",
    reviewPath: "/dashboard/student/overview",
  },
  {
    id: "AT-449",
    date: "2026-02-26",
    module: "WRITING",
    band: 5.5,
    status: "EVALUATED",
    source: "test_attempt",
    reviewPath: "/dashboard/student/overview",
  },
  {
    id: "AT-472",
    date: "2026-03-02",
    module: "SPEAKING",
    band: 6.0,
    status: "EVALUATED",
    source: "booking",
    reviewPath: "/dashboard/student/overview",
  },
  {
    id: "AT-503",
    date: "2026-03-08",
    module: "READING",
    band: 6.5,
    status: "EVALUATED",
    source: "test_attempt",
    reviewPath: "/dashboard/student/overview",
  },
  {
    id: "AT-514",
    date: "2026-03-12",
    module: "LISTENING",
    band: 7.0,
    status: "EVALUATED",
    source: "test_attempt",
    reviewPath: "/dashboard/student/overview",
  },
];

const MOCK_WEAKNESS: WeaknessRow[] = [
  { questionType: "TRUE_FALSE_NOT_GIVEN", wrongPercent: 42 },
  { questionType: "SUMMARY_COMPLETION", wrongPercent: 38 },
  { questionType: "MATCHING_HEADINGS", wrongPercent: 34 },
  { questionType: "SENTENCE_COMPLETION", wrongPercent: 29 },
];

function buildTrend(attempts: AttemptPoint[]): TrendPoint[] {
  const sorted = [...attempts].sort((a, b) => a.date.localeCompare(b.date));
  const map = new Map<string, TrendPoint>();

  for (const row of sorted) {
    const prev = map.get(row.date) || {
      date: row.date,
      reading: 0,
      listening: 0,
      writing: 0,
      speaking: 0,
    };

    if (row.module === "READING") prev.reading = row.band;
    if (row.module === "LISTENING") prev.listening = row.band;
    if (row.module === "WRITING") prev.writing = row.band;
    if (row.module === "SPEAKING") prev.speaking = row.band;

    map.set(row.date, prev);
  }

  return Array.from(map.values());
}

function latestBandByModule(attempts: AttemptPoint[]) {
  const copy = [...attempts].sort((a, b) => b.date.localeCompare(a.date));
  const out: Record<string, number> = {
    READING: 0,
    LISTENING: 0,
    WRITING: 0,
    SPEAKING: 0,
  };

  for (const moduleName of [
    "READING",
    "LISTENING",
    "WRITING",
    "SPEAKING",
  ] as const) {
    const hit = copy.find((x) => x.module === moduleName);
    out[moduleName] = hit?.band || 0;
  }

  return out;
}

export default function StudentProgressPage() {
  const { loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<AttemptPoint[]>([]);

  useEffect(() => {
    if (authLoading) return;

    let active = true;

    fetch("/api/student/progress", { cache: "no-store" })
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          setAttempts([]);
          return;
        }
        const data = (await res.json().catch(() => null)) as {
          attempts?: AttemptPoint[];
        } | null;
        setAttempts(Array.isArray(data?.attempts) ? data.attempts : []);
      })
      .catch(() => {
        if (!active) return;
        setAttempts(MOCK_ATTEMPTS);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading]);

  const trendData = useMemo(() => buildTrend(attempts), [attempts]);

  const radarData = useMemo(() => {
    const latest = latestBandByModule(attempts);
    return [
      { skill: "Reading", value: latest.READING },
      { skill: "Listening", value: latest.LISTENING },
      { skill: "Writing", value: latest.WRITING },
      { skill: "Speaking", value: latest.SPEAKING },
    ];
  }, [attempts]);

  if (loading) {
    return (
      <div className="grid gap-4">
        <div className="h-72 animate-pulse rounded-xl bg-dash-border/50" />
        <div className="h-72 animate-pulse rounded-xl bg-dash-border/50" />
      </div>
    );
  }

  if (!attempts.length) {
    return (
      <div className="rounded-xl border border-dash-border bg-dash-surface p-8 text-center">
        <h1 className="text-2xl font-bold text-dash-text">
          No progress data yet
        </h1>
        <p className="mt-2 text-sm text-dash-text-muted">
          Complete a test to see your progress.
        </p>
        <Link
          href="/exam-library/reading"
          className="mt-5 inline-flex rounded-lg bg-dash-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-dash-accent-muted"
        >
          Start a Practice Test
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-dash-border bg-dash-surface p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted mb-4">
            Band Over Time
          </h2>
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <XAxis dataKey="date" />
                <YAxis domain={[4, 9]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="reading"
                  stroke="#6C3FC5"
                  strokeWidth={2.5}
                />
                <Line
                  type="monotone"
                  dataKey="listening"
                  stroke="#0EA5A0"
                  strokeWidth={2.5}
                />
                <Line
                  type="monotone"
                  dataKey="writing"
                  stroke="#06B6D4"
                  strokeWidth={2.5}
                />
                <Line
                  type="monotone"
                  dataKey="speaking"
                  stroke="#F59E0B"
                  strokeWidth={2.5}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-dash-border bg-dash-surface p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted mb-4">
            Current Skill Bands
          </h2>
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="skill" />
                <Radar
                  dataKey="value"
                  stroke="#6C3FC5"
                  fill="#6C3FC5"
                  fillOpacity={0.45}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted mb-4">
          Weakness by Question Type
        </h2>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-dash-border text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-dash-text-muted">Question Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-dash-text-muted">% Wrong</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-dash-text-muted">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dash-border">
              {MOCK_WEAKNESS.map((row) => (
                <tr key={row.questionType} className="hover:bg-dash-bg transition-colors">
                  <td className="px-3 py-2">{row.questionType}</td>
                  <td className="px-3 py-2">{row.wrongPercent}%</td>
                  <td className="px-3 py-2">
                    <span
                      className={[
                        "rounded-full px-2 py-1 text-xs font-semibold",
                        row.wrongPercent >= 40
                          ? "bg-rose-100 text-rose-700"
                          : row.wrongPercent >= 30
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700",
                      ].join(" ")}
                    >
                      {row.wrongPercent >= 40
                        ? "High"
                        : row.wrongPercent >= 30
                          ? "Medium"
                          : "Low"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted mb-4">
          Recent Attempts
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-dash-border text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-dash-text-muted">Attempt</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-dash-text-muted">Module</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-dash-text-muted">Band</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-dash-text-muted">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-dash-text-muted">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dash-border">
              {attempts.slice(0, 8).map((row) => (
                <tr key={row.id} className="hover:bg-dash-bg transition-colors">
                  <td className="px-3 py-2">{row.id}</td>
                  <td className="px-3 py-2">{row.module}</td>
                  <td className="px-3 py-2">{row.band.toFixed(1)}</td>
                  <td className="px-3 py-2">{row.date}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={row.reviewPath || "/dashboard/student/overview"}
                      className="font-medium text-dash-accent hover:underline"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-dash-border bg-dash-accent-light p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted mb-4">
          Recommended Next Test
        </h2>
        <p className="mt-2 text-sm text-dash-text">
          Based on your weakest pattern, start with a Reading test focused on
          TRUE/FALSE/NOT GIVEN and summary completion.
        </p>
        <Link
          href="/exam-library/reading"
          className="mt-4 inline-flex rounded-lg bg-dash-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-dash-accent-muted"
        >
          Start Recommended Test
        </Link>
      </section>
    </div>
  );
}
