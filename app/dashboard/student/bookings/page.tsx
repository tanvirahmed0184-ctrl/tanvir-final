"use client";

import { useEffect, useMemo, useState } from "react";

type BookingStatus = "UPCOMING" | "COMPLETED" | "CANCELLED";

type BookingRow = {
  id: string;
  status: BookingStatus;
  meetLink: string | null;
  notes: string | null;
  instructor: {
    id: string;
    name: string;
    email: string;
  };
  slot: {
    id: string;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  createdAt: string;
};

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

export default function StudentBookingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | BookingStatus>(
    "ALL",
  );

  useEffect(() => {
    let active = true;

    fetch("/api/booking/my", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as {
          bookings?: BookingRow[];
          error?: string;
        } | null;

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load bookings");
        }

        if (!active) return;
        setBookings(Array.isArray(data?.bookings) ? data!.bookings : []);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Failed to load bookings",
        );
        setBookings([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(
    () => ({
      total: bookings.length,
      upcoming: bookings.filter((b) => b.status === "UPCOMING").length,
      completed: bookings.filter((b) => b.status === "COMPLETED").length,
      cancelled: bookings.filter((b) => b.status === "CANCELLED").length,
    }),
    [bookings],
  );

  const filtered = useMemo(() => {
    const rows =
      statusFilter === "ALL"
        ? bookings
        : bookings.filter((b) => b.status === statusFilter);
    return [...rows].sort(
      (a, b) => +new Date(a.slot.startTime) - +new Date(b.slot.startTime),
    );
  }, [bookings, statusFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-text">My Bookings</h1>
        <p className="mt-1 text-sm text-dash-text-muted">
          Track your scheduled instructor sessions, meeting links, and feedback
          notes.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Upcoming" value={stats.upcoming} />
        <StatCard label="Completed" value={stats.completed} />
        <StatCard label="Cancelled" value={stats.cancelled} />
      </section>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(["ALL", "UPCOMING", "COMPLETED", "CANCELLED"] as const).map(
              (status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={[
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    statusFilter === status
                      ? "bg-dash-accent text-white"
                      : "bg-dash-bg text-dash-text-muted hover:bg-dash-border",
                  ].join(" ")}
                >
                  {status}
                </button>
              ),
            )}
          </div>
        </div>

        {loading ? (
          <div className="mt-4 h-56 animate-pulse rounded-xl bg-dash-border/50" />
        ) : error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : filtered.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-dash-border text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-dash-text-muted">Booking</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-dash-text-muted">Instructor</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-dash-text-muted">Schedule</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-dash-text-muted">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-dash-text-muted">Meet</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-dash-text-muted">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-dash-bg transition-colors">
                    <td className="px-3 py-2">
                      <p className="font-medium text-dash-text">{b.id}</p>
                      <p className="text-xs text-dash-text-muted">
                        Created{" "}
                        {new Date(b.createdAt).toISOString().slice(0, 10)}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-dash-text">
                        {b.instructor.name}
                      </p>
                      <p className="text-xs text-dash-text-muted">
                        {b.instructor.email}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <p>{formatDateTime(b.slot.startTime, b.slot.timezone)}</p>
                      <p className="text-xs text-dash-text-muted">
                        Ends {formatDateTime(b.slot.endTime, b.slot.timezone)}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={[
                          "rounded-full px-2 py-1 text-xs font-semibold",
                          b.status === "UPCOMING"
                            ? "bg-emerald-100 text-emerald-700"
                            : b.status === "COMPLETED"
                              ? "bg-sky-100 text-sky-700"
                              : "bg-rose-100 text-rose-700",
                        ].join(" ")}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {b.meetLink ? (
                        <a
                          href={b.meetLink}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-dash-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-dash-accent-muted"
                        >
                          Join
                        </a>
                      ) : (
                        <span className="text-xs text-dash-text-muted">
                          Not available
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-dash-text-muted">
                      {b.notes?.trim() || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dash-border bg-dash-bg p-4 text-sm text-dash-text-muted">
            No bookings found for this filter.
          </div>
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
