"use client";

import { useEffect, useMemo, useState } from "react";

type SessionStatus = "UPCOMING" | "COMPLETED" | "CANCELLED";

type InstructorSession = {
  id: string;
  studentName: string;
  studentEmail: string;
  startTime: string;
  endTime: string;
  timezone: string;
  meetLink: string | null;
  status: SessionStatus;
  focusArea: string;
  notes?: string;
};

const FALLBACK_SESSIONS: InstructorSession[] = [
  {
    id: "BK-2101",
    studentName: "Nadia Rahman",
    studentEmail: "nadia.rahman@example.com",
    startTime: "2026-03-16T10:00:00.000Z",
    endTime: "2026-03-16T10:30:00.000Z",
    timezone: "Asia/Dhaka",
    meetLink: "https://meet.google.com/ielts-flow-a1b2c3d4",
    status: "UPCOMING",
    focusArea: "Part 2 fluency and coherence",
  },
  {
    id: "BK-2102",
    studentName: "Arif Hasan",
    studentEmail: "arif.hasan@example.com",
    startTime: "2026-03-16T11:00:00.000Z",
    endTime: "2026-03-16T11:30:00.000Z",
    timezone: "Asia/Dhaka",
    meetLink: null,
    status: "UPCOMING",
    focusArea: "Lexical resource improvement",
  },
  {
    id: "BK-2050",
    studentName: "Sadia Akter",
    studentEmail: "sadia.akter@example.com",
    startTime: "2026-03-12T09:00:00.000Z",
    endTime: "2026-03-12T09:30:00.000Z",
    timezone: "Asia/Dhaka",
    meetLink: "https://meet.google.com/ielts-flow-e5f6g7h8",
    status: "COMPLETED",
    focusArea: "Pronunciation and stress",
    notes: "Strong response structure. Work on linking devices.",
  },
  {
    id: "BK-2039",
    studentName: "Mahin Islam",
    studentEmail: "mahin.islam@example.com",
    startTime: "2026-03-10T14:00:00.000Z",
    endTime: "2026-03-10T14:30:00.000Z",
    timezone: "Asia/Dhaka",
    meetLink: null,
    status: "CANCELLED",
    focusArea: "General speaking mock",
  },
];

function formatDateTime(iso: string, timezone: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InstructorSessionsPage() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<InstructorSession[]>([]);
  const [filter, setFilter] = useState<"ALL" | SessionStatus>("ALL");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;

    fetch("/api/instructor/sessions", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load sessions");
        const data = (await res.json()) as { sessions?: InstructorSession[] };
        if (!active) return;
        setSessions(
          Array.isArray(data.sessions) ? data.sessions : FALLBACK_SESSIONS,
        );
      })
      .catch(() => {
        if (!active) return;
        setSessions(FALLBACK_SESSIONS);
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

    return sessions
      .filter((s) => (filter === "ALL" ? true : s.status === filter))
      .filter((s) => {
        if (!term) return true;
        return (
          s.studentName.toLowerCase().includes(term) ||
          s.studentEmail.toLowerCase().includes(term) ||
          s.id.toLowerCase().includes(term) ||
          s.focusArea.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime));
  }, [sessions, filter, query]);

  const counts = useMemo(
    () => ({
      total: sessions.length,
      upcoming: sessions.filter((s) => s.status === "UPCOMING").length,
      completed: sessions.filter((s) => s.status === "COMPLETED").length,
      cancelled: sessions.filter((s) => s.status === "CANCELLED").length,
    }),
    [sessions],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-text">Session Queue</h1>
        <p className="mt-1 text-sm text-dash-text-muted">
          Track booked speaking sessions, open meeting links, and review
          completed notes.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total Sessions" value={counts.total} />
        <StatCard label="Upcoming" value={counts.upcoming} />
        <StatCard label="Completed" value={counts.completed} />
        <StatCard label="Cancelled" value={counts.cancelled} />
      </section>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="block w-full max-w-md text-sm">
            <span className="mb-1 block text-[13px] font-medium text-dash-text">
              Search Sessions
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by student, email, booking ID, or focus area"
              className="w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm outline-none transition-colors focus:border-dash-accent focus:ring-2 focus:ring-dash-accent/10"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-[13px] font-medium text-dash-text">
              Status Filter
            </span>
            <select
              value={filter}
              onChange={(e) =>
                setFilter(e.target.value as "ALL" | SessionStatus)
              }
              className="rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm outline-none transition-colors focus:border-dash-accent focus:ring-2 focus:ring-dash-accent/10"
            >
              <option value="ALL">All</option>
              <option value="UPCOMING">Upcoming</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div className="mt-4 h-52 animate-pulse rounded-xl bg-dash-border/50" />
        ) : filtered.length ? (
          <div className="mt-4 grid gap-3">
            {filtered.map((session) => (
              <article
                key={session.id}
                className="rounded-xl border border-dash-border p-4 hover:bg-dash-bg transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-dash-accent">
                      {session.id}
                    </p>
                    <h2 className="mt-1 text-base font-bold text-dash-text">
                      {session.studentName}
                    </h2>
                    <p className="text-xs text-dash-text-muted">
                      {session.studentEmail}
                    </p>
                  </div>

                  <span
                    className={[
                      "rounded-full px-2 py-1 text-xs font-semibold",
                      session.status === "UPCOMING"
                        ? "bg-emerald-100 text-emerald-700"
                        : session.status === "COMPLETED"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-rose-100 text-rose-700",
                    ].join(" ")}
                  >
                    {session.status}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-dash-text sm:grid-cols-2">
                  <p>
                    <span className="font-semibold">Start:</span>{" "}
                    {formatDateTime(session.startTime, session.timezone)}
                  </p>
                  <p>
                    <span className="font-semibold">End:</span>{" "}
                    {formatDateTime(session.endTime, session.timezone)}
                  </p>
                  <p>
                    <span className="font-semibold">Timezone:</span>{" "}
                    {session.timezone}
                  </p>
                  <p>
                    <span className="font-semibold">Focus:</span>{" "}
                    {session.focusArea}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {session.meetLink ? (
                    <a
                      href={session.meetLink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-dash-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-dash-accent-muted"
                    >
                      Open Meet Link
                    </a>
                  ) : (
                    <span className="rounded-lg bg-dash-bg px-3 py-1.5 text-xs font-medium text-dash-text-muted">
                      Meet link unavailable
                    </span>
                  )}

                  {session.notes ? (
                    <span className="rounded-lg bg-dash-accent-light px-3 py-1.5 text-xs text-dash-accent">
                      Notes: {session.notes}
                    </span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-dash-text-muted">
            No sessions found for current filters.
          </p>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-xl border border-dash-border bg-dash-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted mb-4">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-dash-text">
        {value.toLocaleString()}
      </p>
    </article>
  );
}
