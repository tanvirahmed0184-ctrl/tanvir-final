"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

const SPECIALTIES = ["Speaking", "Writing", "Reading", "Listening", "Band Strategy"];

export default function InstructorApplicationPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    teachingExperience: "",
    ieltsExpertise: "",
    motivation: "",
    education: "",
  });
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/instructor-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, specialties }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Application failed");
      setMessage("Application submitted. Admin will review it before instructor access is enabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Application failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-display tracking-tight text-slate-950">
          Instructor application
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Tell us about your teaching background. Instructor access is enabled
          only after admin approval.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {[
          ["name", "Full name"],
          ["email", "Email"],
          ["phone", "Phone"],
          ["education", "Education / certifications"],
        ].map(([key, label]) => (
          <label key={key} className="block text-sm font-medium text-slate-700">
            {label}
            <input
              type={key === "email" ? "email" : "text"}
              required={key === "name" || key === "email"}
              value={form[key as keyof typeof form]}
              onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            />
          </label>
        ))}

        {[
          ["teachingExperience", "Teaching experience"],
          ["ieltsExpertise", "IELTS expertise"],
          ["motivation", "Why do you want to teach here?"],
        ].map(([key, label]) => (
          <label key={key} className="block text-sm font-medium text-slate-700">
            {label}
            <textarea
              required
              rows={3}
              value={form[key as keyof typeof form]}
              onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            />
          </label>
        ))}

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Specialties</p>
          <div className="flex flex-wrap gap-2">
            {SPECIALTIES.map((item) => {
              const active = specialties.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() =>
                    setSpecialties((prev) =>
                      active ? prev.filter((x) => x !== item) : [...prev, item],
                    )
                  }
                  className={[
                    "rounded-full border px-4 py-2 text-sm font-semibold",
                    active
                      ? "border-emerald-800 bg-emerald-900 text-white"
                      : "border-slate-200 bg-white text-slate-700",
                  ].join(" ")}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        {message ? <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
        {error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-70"
        >
          {submitting ? "Submitting..." : "Submit application"}
        </button>
      </form>
      <p className="text-center text-sm text-slate-600">
        Already approved? <Link href="/login" className="font-semibold text-emerald-800">Sign in</Link>
      </p>
    </div>
  );
}
