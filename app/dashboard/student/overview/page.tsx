"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("Student");
  const [currentBand, setCurrentBand] = useState<number | null>(null);
  const [targetBand, setTargetBand] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (user) {
      setName(
        typeof user.name === "string" && user.name.trim()
          ? user.name
          : "Student",
      );

      const profile =
        user.profile && typeof user.profile === "object"
          ? (user.profile as Record<string, unknown>)
          : null;

      setCurrentBand(
        typeof profile?.currentBand === "number" ? profile.currentBand : null,
      );
      setTargetBand(
        typeof profile?.targetBand === "number" ? profile.targetBand : null,
      );
    }

    setLoading(false);
  }, [authLoading, user]);

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
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-slate-200"
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-brand-purple via-brand-purple-dark to-brand-teal p-5 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Welcome back, {name}</h1>
        <p className="mt-1 text-sm text-white/85">
          Here is your latest IELTS readiness snapshot.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card
          title="Current Band"
          value={(currentBand ?? 0).toFixed(1)}
          note="Latest measured score"
        />
        <Card
          title="Target Band"
          value={(targetBand ?? 7).toFixed(1)}
          note="Your profile target"
        />
        <Card
          title="Readiness"
          value={`${readiness}%`}
          note="Progress toward target"
        />
        <Card
          title="Tests Taken"
          value={`${FALLBACK_ATTEMPTS.length}`}
          note="Across all modules"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Band Score Trend
          </h2>
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={FALLBACK_TREND}>
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

        <div className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Skill Balance
          </h2>
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="skill" />
                <Radar
                  name="Band"
                  dataKey="band"
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

      <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent Tests
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left">Attempt</th>
                <th className="px-3 py-2 text-left">Module</th>
                <th className="px-3 py-2 text-left">Band</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {FALLBACK_ATTEMPTS.slice(0, 5).map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">{row.id}</td>
                  <td className="px-3 py-2">{row.module}</td>
                  <td className="px-3 py-2">{row.score.toFixed(1)}</td>
                  <td className="px-3 py-2">{row.date}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {FALLBACK_WEAKNESSES.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
          >
            <h3 className="text-sm font-semibold text-amber-900">
              {item.title}
            </h3>
            <p className="mt-1 text-xs font-semibold text-amber-700">
              {item.value}
            </p>
            <p className="mt-2 text-sm text-amber-800">{item.action}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-brand-teal/25 bg-brand-teal/5 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Recommended Actions
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>1. Complete one full reading simulation this week.</li>
          <li>2. Do two writing Task 2 evaluations with AI feedback.</li>
          <li>3. Practice listening Section 4 drills for 20 minutes daily.</li>
        </ul>
      </section>
    </div>
  );
}

function Card({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <article className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{note}</p>
    </article>
  );
}
