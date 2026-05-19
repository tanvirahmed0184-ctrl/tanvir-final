"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";

const TIMEZONES = [
  "UTC",
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "America/New_York",
];

function toDateInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function StudentSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("Student");
  const [email, setEmail] = useState("-");

  const [targetBand, setTargetBand] = useState("7");
  const [currentBand, setCurrentBand] = useState("");
  const [examDate, setExamDate] = useState("");
  const [studyProfession, setStudyProfession] = useState("");
  const [examReason, setExamReason] = useState("");
  const [timezone, setTimezone] = useState("Asia/Dhaka");

  const [plan, setPlan] = useState("free");
  const [planStatus, setPlanStatus] = useState("active");
  const [planExpires, setPlanExpires] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setError("Unable to load profile");
      setLoading(false);
      return;
    }

    const profile =
      user.profile && typeof user.profile === "object"
        ? (user.profile as Record<string, unknown>)
        : null;
    const subscription =
      user.subscription && typeof user.subscription === "object"
        ? (user.subscription as Record<string, unknown>)
        : null;

    setName(
      typeof user.name === "string" && user.name.trim() ? user.name : "Student",
    );
    setEmail(typeof user.email === "string" ? user.email : "-");

    setTargetBand(
      typeof profile?.targetBand === "number"
        ? String(profile.targetBand)
        : "7",
    );
    setCurrentBand(
      typeof profile?.currentBand === "number"
        ? String(profile.currentBand)
        : "",
    );
    setExamDate(
      toDateInput(
        typeof profile?.examDate === "string" ? profile.examDate : null,
      ),
    );
    setStudyProfession(
      typeof profile?.studyProfession === "string"
        ? profile.studyProfession
        : "",
    );
    setExamReason(
      typeof profile?.examReason === "string" ? profile.examReason : "",
    );
    setTimezone(
      typeof profile?.timezone === "string" ? profile.timezone : "Asia/Dhaka",
    );

    setPlan(
      typeof subscription?.plan === "string" ? subscription.plan : "free",
    );
    setPlanStatus(
      typeof subscription?.status === "string" ? subscription.status : "active",
    );
    setPlanExpires(
      typeof subscription?.expiresAt === "string"
        ? subscription.expiresAt
        : null,
    );
    setLoading(false);
  }, [authLoading, user]);

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetBand: targetBand === "" ? null : Number(targetBand),
          currentBand: currentBand === "" ? null : Number(currentBand),
          examDate: examDate || null,
          studyProfession: studyProfession || null,
          examReason: examReason || null,
          timezone,
          onboardingCompleted: true,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save settings");
      }

      setMessage("Settings saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-brand-purple via-brand-purple-dark to-brand-teal p-5 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="mt-2 text-sm text-white/85">
          Manage your IELTS targets, exam profile, and timezone preferences.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Account
          </p>
          <h2 className="mt-2 text-lg font-bold text-slate-900">{name}</h2>
          <p className="text-sm text-slate-600">{email}</p>
        </article>

        <article className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Plan
          </p>
          <p className="mt-2 text-lg font-bold text-slate-900">
            {plan.toUpperCase()}
          </p>
          <p className="text-sm text-slate-600">Status: {planStatus}</p>
          <p className="text-xs text-slate-500">
            {planExpires
              ? `Expires: ${new Date(planExpires).toISOString().slice(0, 10)}`
              : "No expiry set"}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
        <form onSubmit={saveSettings} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Target Band">
              <input
                type="number"
                min={0}
                max={9}
                step={0.5}
                value={targetBand}
                onChange={(e) => setTargetBand(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Current Band">
              <input
                type="number"
                min={0}
                max={9}
                step={0.5}
                value={currentBand}
                onChange={(e) => setCurrentBand(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Exam Date">
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Timezone">
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Study / Profession">
            <input
              value={studyProfession}
              onChange={(e) => setStudyProfession(e.target.value)}
              placeholder="e.g. Undergraduate student, Software Engineer"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Exam Reason">
            <textarea
              value={examReason}
              onChange={(e) => setExamReason(e.target.value)}
              rows={3}
              placeholder="e.g. Higher studies, immigration, professional registration"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
