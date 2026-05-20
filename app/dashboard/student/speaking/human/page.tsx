"use client";

import Link from "next/link";
import { ArrowLeft, CalendarCheck, UserRoundSearch } from "lucide-react";

export default function HumanSpeakingExamPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/student/speaking"
          className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-dash-border px-4 py-2 text-sm font-semibold text-dash-text"
        >
          <ArrowLeft size={15} />
          Speaking modes
        </Link>
        <p className="workspace-section-title">Human examiner flow</p>
        <h1 className="mt-4 text-3xl font-semibold text-dash-text md:text-4xl">
          Human Speaking Examiner
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-dash-text-muted md:text-base">
          Book a live instructor-led speaking session and keep the human
          feedback workflow separate from the AI examiner flow.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-3xl border border-dash-border bg-dash-surface p-6">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-dash-accent-light text-dash-accent">
            <UserRoundSearch size={22} />
          </span>
          <h2 className="mt-5 text-2xl font-semibold text-dash-text">
            Instructor evaluation
          </h2>
          <p className="mt-3 text-sm leading-6 text-dash-text-muted">
            Reserve a speaking slot, meet your instructor, and receive
            rubric-based advice for fluency, pronunciation, grammar, and
            lexical resource.
          </p>
          <Link
            href="/dashboard/student/book"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-dash-accent px-5 py-3 text-sm font-semibold text-white"
          >
            <CalendarCheck size={16} />
            Book Instructor
          </Link>
        </article>

        <article className="rounded-3xl border border-dash-border bg-dash-surface p-6">
          <p className="workspace-section-title">Session structure</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {["Choose instructor", "Book slot", "Review feedback"].map(
              (step, index) => (
                <div
                  key={step}
                  className="rounded-2xl border border-dash-border bg-white/65 p-4"
                >
                  <p className="text-xs font-bold text-dash-accent">
                    0{index + 1}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-dash-text">
                    {step}
                  </p>
                </div>
              ),
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
