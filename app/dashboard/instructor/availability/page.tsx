"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Slot = {
  id: string;
  startTime: string;
  endTime: string;
  timezone: string;
  isBooked?: boolean;
  instructor?: {
    id: string;
    name: string | null;
    email: string;
  };
};

const TIMEZONES = [
  "UTC",
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "America/New_York",
];

function formatSlot(iso: string, timezone: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InstructorAvailabilityPage() {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timezone, setTimezone] = useState("Asia/Dhaka");

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/booking/slots", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load slots");
        const data = (await res.json()) as { slots?: Slot[] };
        if (!active) return;
        setSlots(Array.isArray(data.slots) ? data.slots : []);
      })
      .catch(() => {
        if (!active) return;
        setSlots([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const upcoming = useMemo(
    () =>
      [...slots].sort(
        (a, b) => +new Date(a.startTime) - +new Date(b.startTime),
      ),
    [slots],
  );

  async function createSlot(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!startTime || !endTime) {
      setError("Please select both start and end time.");
      return;
    }

    const startIso = new Date(startTime).toISOString();
    const endIso = new Date(endTime).toISOString();

    if (new Date(endIso) <= new Date(startIso)) {
      setError("End time must be later than start time.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/booking/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: startIso,
          endTime: endIso,
          timezone,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        slot?: Slot;
        error?: string;
      } | null;

      if (!res.ok || !data?.slot) {
        throw new Error(data?.error || "Failed to create slot");
      }

      setSlots((prev) => [data.slot!, ...prev]);
      setStartTime("");
      setEndTime("");
      setMessage("Availability slot created successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create slot");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-text">Availability Manager</h1>
        <p className="mt-1 text-sm text-dash-text-muted">
          Set your upcoming speaking session slots for students to book.
        </p>
      </div>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted mb-4">
          Add New Slot
        </h2>

        <form onSubmit={createSlot} className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-dash-text">
              Start Time
            </span>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm outline-none transition-colors focus:border-dash-accent focus:ring-2 focus:ring-dash-accent/10"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-dash-text">
              End Time
            </span>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm outline-none transition-colors focus:border-dash-accent focus:ring-2 focus:ring-dash-accent/10"
              required
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-[13px] font-medium text-dash-text">
              Timezone
            </span>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm outline-none transition-colors focus:border-dash-accent focus:ring-2 focus:ring-dash-accent/10"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-dash-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-dash-accent-muted disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Create Availability Slot"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted mb-4">
          Upcoming Open Slots
        </h2>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-dash-border/50" />
            ))}
          </div>
        ) : upcoming.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-dash-border">
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-dash-text-muted">Start</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-dash-text-muted">End</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-dash-text-muted">Timezone</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-dash-text-muted">Instructor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border">
                {upcoming.map((slot) => (
                  <tr key={slot.id} className="hover:bg-dash-bg transition-colors">
                    <td className="px-3 py-2.5 text-dash-text">
                      {formatSlot(slot.startTime, timezone)}
                    </td>
                    <td className="px-3 py-2.5 text-dash-text">
                      {formatSlot(slot.endTime, timezone)}
                    </td>
                    <td className="px-3 py-2.5 text-dash-text-muted font-mono text-xs">{slot.timezone}</td>
                    <td className="px-3 py-2.5 text-dash-text">
                      {slot.instructor?.name || slot.instructor?.email || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-dash-text-muted py-4 text-center">
            No open slots yet. Create one above to start.
          </p>
        )}
      </section>
    </div>
  );
}
