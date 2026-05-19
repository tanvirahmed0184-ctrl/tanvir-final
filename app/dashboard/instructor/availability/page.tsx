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
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-brand-purple via-brand-purple-dark to-brand-teal p-5 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Availability Manager</h1>
        <p className="mt-2 text-sm text-white/85">
          Set your upcoming speaking session slots for students to book.
        </p>
      </section>

      <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Add New Slot
        </h2>

        <form onSubmit={createSlot} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Start Time
            </span>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
              required
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              End Time
            </span>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
              required
            />
          </label>

          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Timezone
            </span>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
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
              className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              {submitting ? "Saving..." : "Create Availability Slot"}
            </button>
          </div>
        </form>

        {error ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Upcoming Open Slots
        </h2>

        {loading ? (
          <div className="mt-3 h-40 animate-pulse rounded-xl bg-slate-200" />
        ) : upcoming.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Start</th>
                  <th className="px-3 py-2 text-left">End</th>
                  <th className="px-3 py-2 text-left">Timezone</th>
                  <th className="px-3 py-2 text-left">Instructor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {upcoming.map((slot) => (
                  <tr key={slot.id}>
                    <td className="px-3 py-2">
                      {formatSlot(slot.startTime, timezone)}
                    </td>
                    <td className="px-3 py-2">
                      {formatSlot(slot.endTime, timezone)}
                    </td>
                    <td className="px-3 py-2">{slot.timezone}</td>
                    <td className="px-3 py-2">
                      {slot.instructor?.name || slot.instructor?.email || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No open slots yet.</p>
        )}
      </section>
    </div>
  );
}
