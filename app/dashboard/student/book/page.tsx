"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Video } from "lucide-react";

type Slot = {
  id: string;
  startTime: string;
  endTime: string;
  timezone: string;
};

type Instructor = {
  id: string;
  name: string | null;
  email: string;
  nextAvailableSlot: Slot | null;
};

const TIMEZONES = [
  "UTC",
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "America/New_York",
];

function formatSlot(
  startIso: string,
  endIso: string,
  timezone: string,
): string {
  const start = new Date(startIso);
  const end = new Date(endIso);

  return `${start.toLocaleString("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })} - ${end.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function StudentBookPage() {
  const [timezone, setTimezone] = useState("Asia/Dhaka");
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bookingId, setBookingId] = useState<string | null>(null);
  const [meetLink, setMeetLink] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [busySlotId, setBusySlotId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/booking/instructors", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch instructors");
        const data = (await res.json()) as { instructors?: Instructor[] };
        if (!active) return;
        setInstructors(Array.isArray(data.instructors) ? data.instructors : []);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Unable to load instructors",
        );
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const available = useMemo(
    () => instructors.filter((i) => i.nextAvailableSlot),
    [instructors],
  );

  async function bookSlot(slotId: string) {
    setBusySlotId(slotId);
    setBookingError(null);
    setBookingId(null);
    setMeetLink(null);

    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId }),
      });

      const data = (await res.json().catch(() => null)) as {
        bookingId?: string;
        meetLink?: string | null;
        error?: string;
      } | null;

      if (!res.ok || !data?.bookingId) {
        throw new Error(data?.error || "Booking failed");
      }

      setBookingId(data.bookingId);
      setMeetLink(data.meetLink || null);

      setInstructors((prev) =>
        prev.filter(
          (instructor) => instructor.nextAvailableSlot?.id !== slotId,
        ),
      );
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setBusySlotId(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-brand-purple via-brand-purple-dark to-brand-teal p-5 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Book an IELTS Instructor</h1>
        <p className="mt-2 text-sm text-white/85">
          Choose an available expert session and receive targeted speaking
          feedback.
        </p>
      </section>

      <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Timezone
        </label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="mt-2 w-full max-w-xs rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </section>

      {bookingError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {bookingError}
        </div>
      ) : null}

      {bookingId ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="inline-flex items-center gap-2 font-semibold">
            <CalendarCheck2 size={16} />
            Booking confirmed ({bookingId})
          </p>
          {meetLink ? (
            <p className="mt-2 inline-flex items-center gap-2">
              <Video size={16} />
              Meet link:{" "}
              <a
                href={meetLink}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {meetLink}
              </a>
            </p>
          ) : (
            <p className="mt-2">
              Meet link will be shared before your session.
            </p>
          )}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl bg-slate-200"
            />
          ))}
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <section className="grid gap-4 md:grid-cols-2">
          {available.length ? (
            available.map((instructor) => {
              const slot = instructor.nextAvailableSlot!;
              const disabled = busySlotId === slot.id;

              return (
                <article
                  key={instructor.id}
                  className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm"
                >
                  <h2 className="text-lg font-semibold text-slate-900">
                    {instructor.name || instructor.email}
                  </h2>
                  <p className="text-xs text-slate-500">{instructor.email}</p>

                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {formatSlot(slot.startTime, slot.endTime, timezone)}
                  </p>

                  <button
                    type="button"
                    onClick={() => bookSlot(slot.id)}
                    disabled={disabled}
                    className="mt-4 inline-flex rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {disabled ? "Booking..." : "Book"}
                  </button>
                </article>
              );
            })
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 md:col-span-2">
              No open instructor slots right now. Check again shortly.
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
