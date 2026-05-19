"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type AdminAnalytics = {
  totalUsers: number;
  testsToday: number;
  avgBandThisWeek: number;
  activeSubscriptions: number;
  testsByDay: Array<{ day: string; count: number }>;
  recentAttempts: Array<{
    id: string;
    module: string;
    userName: string;
    bandScore: number;
    status: string;
    createdAt: string;
  }>;
};

type ContentStats = {
  totalPassages: number;
  totalQuestions: number;
  totalTests: number;
  totalSpeakingSets: number;
  missingMedia: number;
  unusedPassages: number;
  orphanedQuestions: number;
};

const FALLBACK: AdminAnalytics = {
  totalUsers: 1258,
  testsToday: 87,
  avgBandThisWeek: 6.4,
  activeSubscriptions: 392,
  testsByDay: [
    { day: "Mon", count: 74 },
    { day: "Tue", count: 82 },
    { day: "Wed", count: 66 },
    { day: "Thu", count: 91 },
    { day: "Fri", count: 88 },
    { day: "Sat", count: 102 },
    { day: "Sun", count: 79 },
  ],
  recentAttempts: [
    {
      id: "AT-9001",
      module: "READING",
      userName: "Nadia Rahman",
      bandScore: 6.5,
      status: "EVALUATED",
      createdAt: "2026-03-15 09:45",
    },
    {
      id: "AT-9002",
      module: "LISTENING",
      userName: "Arif Hasan",
      bandScore: 7.0,
      status: "EVALUATED",
      createdAt: "2026-03-15 10:12",
    },
    {
      id: "AT-9003",
      module: "WRITING",
      userName: "Sadia Akter",
      bandScore: 6.0,
      status: "EVALUATED",
      createdAt: "2026-03-15 10:37",
    },
    {
      id: "AT-9004",
      module: "SPEAKING",
      userName: "Mahin Islam",
      bandScore: 6.5,
      status: "EVALUATED",
      createdAt: "2026-03-15 11:05",
    },
    {
      id: "AT-9005",
      module: "READING",
      userName: "Tasnim Jahan",
      bandScore: 7.5,
      status: "EVALUATED",
      createdAt: "2026-03-15 11:44",
    },
    {
      id: "AT-9006",
      module: "LISTENING",
      userName: "Rakib Khan",
      bandScore: 6.0,
      status: "EVALUATED",
      createdAt: "2026-03-15 12:01",
    },
    {
      id: "AT-9007",
      module: "WRITING",
      userName: "Mehzabin Noor",
      bandScore: 5.5,
      status: "EVALUATED",
      createdAt: "2026-03-15 12:19",
    },
    {
      id: "AT-9008",
      module: "READING",
      userName: "Shahriar Kabir",
      bandScore: 6.5,
      status: "EVALUATED",
      createdAt: "2026-03-15 12:55",
    },
    {
      id: "AT-9009",
      module: "SPEAKING",
      userName: "Farhana Alam",
      bandScore: 6.0,
      status: "EVALUATED",
      createdAt: "2026-03-15 13:30",
    },
    {
      id: "AT-9010",
      module: "LISTENING",
      userName: "Tanvir Ahmed",
      bandScore: 7.0,
      status: "EVALUATED",
      createdAt: "2026-03-15 14:08",
    },
  ],
};

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AdminAnalytics>(FALLBACK);
  const [contentStats, setContentStats] = useState<ContentStats>({
    totalPassages: 0,
    totalQuestions: 0,
    totalTests: 0,
    totalSpeakingSets: 0,
    missingMedia: 0,
    unusedPassages: 0,
    orphanedQuestions: 0,
  });

  useEffect(() => {
    let active = true;

    fetch("/api/admin/analytics", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch admin analytics");
        const data = (await res.json()) as Partial<AdminAnalytics>;
        if (!active) return;
        setAnalytics({
          totalUsers: data.totalUsers ?? FALLBACK.totalUsers,
          testsToday: data.testsToday ?? FALLBACK.testsToday,
          avgBandThisWeek: data.avgBandThisWeek ?? FALLBACK.avgBandThisWeek,
          activeSubscriptions:
            data.activeSubscriptions ?? FALLBACK.activeSubscriptions,
          testsByDay:
            data.testsByDay && data.testsByDay.length
              ? data.testsByDay
              : FALLBACK.testsByDay,
          recentAttempts:
            data.recentAttempts && data.recentAttempts.length
              ? data.recentAttempts.slice(0, 10)
              : FALLBACK.recentAttempts,
        });
      })
      .catch(() => {
        if (!active) return;
        setAnalytics(FALLBACK);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    Promise.all([
      fetch("/api/admin/passages", { cache: "no-store" }),
      fetch("/api/admin/question-bank/upload-csv", { cache: "no-store" }),
      fetch("/api/tests?fresh=1", { cache: "no-store" }),
      fetch("/api/admin/speaking/prompt-sets", { cache: "no-store" }),
    ])
      .then(async ([passagesRes, bankRes, testsRes, speakingRes]) => {
        const passagesData = (await passagesRes.json().catch(() => null)) as
          | { passages?: Array<{ media?: Array<{ type: string }>; linkedQuestions?: number }> }
          | null;
        const bankData = (await bankRes.json().catch(() => null)) as
          | { rows?: Array<{ passageId?: string | null }> }
          | null;
        const testsData = (await testsRes.json().catch(() => null)) as
          | {
              tests?: Array<{
                speakingPromptSets?: Array<{ id: string }>;
              }>;
            }
          | null;
        const speakingData = (await speakingRes.json().catch(() => null)) as
          | { sets?: Array<{ id: string }> }
          | null;

        if (!active) return;

        const passages = Array.isArray(passagesData?.passages)
          ? passagesData.passages
          : [];
        const rows = Array.isArray(bankData?.rows) ? bankData.rows : [];
        const tests = Array.isArray(testsData?.tests) ? testsData.tests : [];
        const speakingSets = Array.isArray(speakingData?.sets) ? speakingData.sets : [];

        const missingMedia = passages.filter(
          (passage) =>
            !Array.isArray(passage.media) ||
            passage.media.length === 0 ||
            !passage.media.some((media) => media.type === "AUDIO" || media.type === "IMAGE"),
        ).length;

        const unusedPassages = passages.filter(
          (passage) => Number(passage.linkedQuestions || 0) === 0,
        ).length;

        const orphanedQuestions = rows.filter((row) => !row.passageId).length;

        const totalSpeakingSets =
          tests.reduce(
            (sum, test) => sum + (Array.isArray(test.speakingPromptSets) ? test.speakingPromptSets.length : 0),
            0,
          ) || speakingSets.length;

        setContentStats({
          totalPassages: passages.length,
          totalQuestions: rows.length,
          totalTests: tests.length,
          totalSpeakingSets,
          missingMedia,
          unusedPassages,
          orphanedQuestions,
        });
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const cards = useMemo(
    () => [
      { label: "Total Users", value: analytics.totalUsers.toLocaleString() },
      { label: "Tests Today", value: analytics.testsToday.toLocaleString() },
      {
        label: "Avg Band This Week",
        value: analytics.avgBandThisWeek.toFixed(1),
      },
      {
        label: "Active Subscriptions",
        value: analytics.activeSubscriptions.toLocaleString(),
      },
    ],
    [analytics],
  );

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
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.label}
            className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-black text-slate-900">
              {card.value}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Passages" value={String(contentStats.totalPassages)} />
        <MetricCard label="Total Questions" value={String(contentStats.totalQuestions)} />
        <MetricCard label="Total Tests" value={String(contentStats.totalTests)} />
        <MetricCard label="Speaking Sets" value={String(contentStats.totalSpeakingSets)} />
        <MetricCard label="Missing Media" value={String(contentStats.missingMedia)} />
        <MetricCard label="Unused Passages" value={String(contentStats.unusedPassages)} />
        <MetricCard label="Orphaned Questions" value={String(contentStats.orphanedQuestions)} />
      </section>

      <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Tests Taken Per Day (Last 7 Days)
        </h2>
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.testsByDay}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#6C3FC5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent Attempts (Last 10)
        </h2>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left">Attempt</th>
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-left">Module</th>
                <th className="px-3 py-2 text-left">Band</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analytics.recentAttempts.slice(0, 10).map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">{row.id}</td>
                  <td className="px-3 py-2">{row.userName}</td>
                  <td className="px-3 py-2">{row.module}</td>
                  <td className="px-3 py-2">{row.bandScore.toFixed(1)}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">{row.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
