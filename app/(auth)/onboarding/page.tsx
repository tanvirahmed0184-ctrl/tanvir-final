"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Step = 1 | 2 | 3;

const REASONS = ["Work", "Study", "Migration", "Other"] as const;

function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Unable to save right now. Please try again.";
}

async function patchProfile(payload: Record<string, unknown>) {
  const res = await fetch("/api/user/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error || "Failed to update profile.");
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [targetBand, setTargetBand] = useState<number>(6.5);
  const [studyProfession, setStudyProfession] = useState("");
  const [examReason, setExamReason] =
    useState<(typeof REASONS)[number]>("Study");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const progress = useMemo(() => (step / 3) * 100, [step]);

  async function handleNext() {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (step === 1) {
        await patchProfile({ targetBand });
        setStep(2);
      } else if (step === 2) {
        await patchProfile({ studyProfession });
        setStep(3);
      } else {
        await patchProfile({ examReason, onboardingCompleted: true });
        router.replace("/dashboard/student/overview");
      }
    } catch (error) {
      setErrorMessage(normalizeError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">
          Set Up Your Plan
        </h1>
        <p className="text-sm text-slate-600">Step {step}/3</p>
      </header>

      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-brand-purple transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {step === 1 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-slate-900">
            What is your target band score?
          </h2>
          <div className="space-y-3">
            <input
              type="range"
              min={4}
              max={9}
              step={0.5}
              value={targetBand}
              onChange={(e) => setTargetBand(Number(e.target.value))}
              className="w-full accent-brand-purple"
            />
            <p className="text-sm text-slate-700">
              Target Band:{" "}
              <span className="font-semibold">{targetBand.toFixed(1)}</span>
            </p>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-slate-900">
            What is your profession?
          </h2>
          <input
            type="text"
            value={studyProfession}
            onChange={(e) => setStudyProfession(e.target.value)}
            placeholder="e.g., Software Engineer"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
          />
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-slate-900">
            Why are you taking IELTS?
          </h2>
          <select
            value={examReason}
            onChange={(e) =>
              setExamReason(e.target.value as (typeof REASONS)[number])
            }
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
          >
            {REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
        </section>
      ) : null}

      {errorMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleNext}
        disabled={isSubmitting || (step === 2 && !studyProfession.trim())}
        className="w-full rounded-xl bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-purple-dark disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting
          ? "Saving..."
          : step === 3
            ? "Finish Onboarding"
            : "Continue"}
      </button>
    </div>
  );
}
