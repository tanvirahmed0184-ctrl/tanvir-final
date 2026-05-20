"use client";

import { useMemo } from "react";
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

type TrendPoint = {
  date: string;
  reading: number;
  listening: number;
  writing: number;
  speaking: number;
};

type SkillPoint = {
  skill: string;
  band: number;
};

type AttemptRow = {
  id: string;
  module: string;
  score: number;
  date: string;
  status: string;
};

const FALLBACK_TREND: TrendPoint[] = [
  { date: "Week 1", reading: 5.5, listening: 6.0, writing: 5.0, speaking: 5.5 },
  { date: "Week 2", reading: 6.0, listening: 6.5, writing: 5.5, speaking: 5.8 },
  { date: "Week 3", reading: 6.0, listening: 6.5, writing: 6.0, speaking: 6.0 },
  { date: "Week 4", reading: 6.5, listening: 7.0, writing: 6.0, speaking: 6.5 },
];

const FALLBACK_ATTEMPTS: AttemptRow[] = [
  {
    id: "A-1001",
    module: "READING",
    score: 6.5,
    date: "2026-03-01",
    status: "EVALUATED",
  },
  {
    id: "A-1002",
    module: "LISTENING",
    score: 7.0,
    date: "2026-03-04",
    status: "EVALUATED",
  },
  {
    id: "A-1003",
    module: "WRITING",
    score: 6.0,
    date: "2026-03-07",
    status: "EVALUATED",
  },
  {
    id: "A-1004",
    module: "READING",
    score: 6.5,
    date: "2026-03-10",
    status: "EVALUATED",
  },
  {
    id: "A-1005",
    module: "SPEAKING",
    score: 6.0,
    date: "2026-03-13",
    status: "EVALUATED",
  },
];

const FALLBACK_WEAKNESSES = [
  {
    title: "True/False/Not Given",
    value: "42% incorrect",
    action: "Practice inference questions",
  },
  {
    title: "Task 2 Coherence",
    value: "Band 5.5",
    action: "Use paragraph logic templates",
  },
  {
    title: "Listening Section 4",
    value: "38% incorrect",
    action: "Focus on note completion",
  },
];

export default function StudentOverviewPage() {
  const { user, loading: authLoading } = useAuth();

  const loading = authLoading;

  const name = useMemo(() => {
    if (!user) return "Student";
    return typeof user.name === "string" && user.name.trim() ? user.name : "Student";
  }, [user]);

  const { currentBand, targetBand } = useMemo(() => {
    if (!user) return { currentBand: null as number | null, targetBand: null as number | null };
    const profile =
      user.profile && typeof user.profile === "object"
        ? (user.profile as Record<string, unknown>)
        : null;
    return {
      currentBand: typeof profile?.currentBand === "number" ? profile.currentBand : null,
      targetBand: typeof profile?.targetBand === "number" ? profile.targetBand : null,
    };
  }, [user]);

  const readiness = useMemo(() => {
    const current = currentBand ?? 0;
    const target = targetBand ?? 7;
    if (target <= 0) return 0;
    return Math.min(100, Math.round((current / target) * 100));
  }, [currentBand, targetBand]);

  const radarData: SkillPoint[] = useMemo(() => {
    const latest = FALLBACK_TREND[FALLBACK_TREND.length - 1];
    return [
      { skill: "Reading", band: latest.reading },
      { skill: "Listening", band: latest.listening },
      { skill: "Writing", band: latest.writing },
      { skill: "Speaking", band: latest.speaking },
    ];
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-dash-border/50"
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl bg-dash-border/50" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-dash-text">
          Welcome back, {name}
        </h1>
        <p className="mt-1 text-sm text-dash-text-muted">
          Here is your latest IELTS readiness snapshot.
        </p>
      </div>

      {/* KPI Cards */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Current Band"
          value={(currentBand ?? 0).toFixed(1)}
          note="Latest measured score"
        />
        <MetricCard
          title="Target Band"
          value={(targetBand ?? 7).toFixed(1)}
          note="Your profile target"
        />
        <MetricCard
          title="Readiness"
          value={`${readiness}%`}
          note="Progress toward target"
        />
        <MetricCard
          title="Tests Taken"
          value={`${FALLBACK_ATTEMPTS.length}`}
          note="Across all modules"
        />
      </section>

      {/* Charts */}
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] bg-white/70 p-5 shadow-[0_22px_70px_-50px_rgba(27,46,38,0.5)]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted mb-4">
            Band Score Trend
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={FALLBACK_TREND}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#8fa89c" />
                <YAxis domain={[4, 9]} tick={{ fontSize: 12 }} stroke="#8fa89c" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="reading"
                  stroke="#2d7a5f"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="listening"
                  stroke="#0EA5A0"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="writing"
                  stroke="#6C3FC5"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="speaking"
                  stroke="#d97706"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white/70 p-5 shadow-[0_22px_70px_-50px_rgba(27,46,38,0.5)]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted mb-4">
            Skill Balance
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e8eeeb" />
                <PolarAngleAxis dataKey="skill" tick={{ fontSize: 12 }} />
                <Radar
                  name="Band"
                  dataKey="band"
                  stroke="#2d7a5f"
                  fill="#2d7a5f"
                  fillOpacity={0.15}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Recent Tests */}
      <section className="rounded-[2rem] bg-white/70 p-5 shadow-[0_22px_70px_-50px_rgba(27,46,38,0.5)]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted mb-4">
          Recent Tests
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-dash-border">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-dash-text-muted">Attempt</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-dash-text-muted">Module</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-dash-text-muted">Band</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-dash-text-muted">Date</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-dash-text-muted">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dash-border">
              {FALLBACK_ATTEMPTS.slice(0, 5).map((row) => (
                <tr key={row.id} className="hover:bg-dash-bg transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs text-dash-text">{row.id}</td>
                  <td className="px-3 py-2.5 text-dash-text">{row.module}</td>
                  <td className="px-3 py-2.5 font-semibold text-dash-text">{row.score.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-dash-text-muted">{row.date}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Weaknesses */}
      <section className="grid gap-4 lg:grid-cols-3">
        {FALLBACK_WEAKNESSES.map((item) => (
          <article
            key={item.title}
            className="rounded-xl border border-amber-200/60 bg-amber-50/40 p-4"
          >
            <h3 className="text-sm font-semibold text-amber-900">
              {item.title}
            </h3>
            <p className="mt-1 text-xs font-semibold text-amber-700">
              {item.value}
            </p>
            <p className="mt-2 text-[13px] text-amber-800">{item.action}</p>
          </article>
        ))}
      </section>

      {/* Recommended Actions */}
      <section className="rounded-[2rem] bg-dash-accent-light/45 p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-accent mb-3">
          Recommended Actions
        </h2>
        <ul className="space-y-2 text-sm text-dash-text">
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-dash-accent shrink-0" />
            Complete one full reading simulation this week.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-dash-accent shrink-0" />
            Do two writing Task 2 evaluations with AI feedback.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-dash-accent shrink-0" />
            Practice listening Section 4 drills for 20 minutes daily.
          </li>
        </ul>
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <article className="rounded-[1.5rem] bg-white/60 p-5 shadow-[0_20px_50px_-44px_rgba(27,46,38,0.55)]">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-dash-text-muted">
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold text-dash-text">{value}</p>
      <p className="mt-0.5 text-xs text-dash-text-light">{note}</p>
    </article>
  );
}
