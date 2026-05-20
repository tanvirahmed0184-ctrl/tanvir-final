"use client";

import Link from "next/link";
import { Mic, UserRoundSearch } from "lucide-react";
import AIInterviewer from "@/components/speaking/ai-interviewer/ai-interviewer";

export default function StudentSpeakingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-text">Speaking Practice Hub</h1>
        <p className="mt-1 text-sm text-dash-text-muted">
          Train with AI or book an instructor-led speaking session.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-dash-border bg-dash-surface p-5">
          <p className="inline-flex items-center gap-2 rounded-full bg-dash-accent-light px-3 py-1 text-xs font-semibold uppercase tracking-wide text-dash-accent">
            <Mic size={14} />
            AI Speaking Test
          </p>
          <h2 className="mt-3 text-lg font-bold text-dash-text">
            Practice with AI Examiner
          </h2>
          <p className="mt-2 text-sm text-dash-text-muted">
            Simulate all speaking parts with examiner-style prompts and instant
            feedback.
          </p>
          <a
            href="#ai-speaking"
            className="mt-4 inline-flex rounded-lg bg-dash-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-dash-accent-muted"
          >
            Start AI Speaking
          </a>
        </article>

        <article className="rounded-xl border border-dash-border bg-dash-surface p-5">
          <p className="inline-flex items-center gap-2 rounded-full bg-dash-accent-light px-3 py-1 text-xs font-semibold uppercase tracking-wide text-dash-accent">
            <UserRoundSearch size={14} />
            Book Instructor
          </p>
          <h2 className="mt-3 text-lg font-bold text-dash-text">
            Get Human Feedback
          </h2>
          <p className="mt-2 text-sm text-dash-text-muted">
            Reserve a speaking slot with an IELTS instructor and receive
            targeted rubric-based evaluation.
          </p>
          <Link
            href="/dashboard/student/book"
            className="mt-4 inline-flex rounded-lg bg-dash-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-dash-accent-muted"
          >
            Book Instructor
          </Link>
        </article>
      </section>

      <section id="ai-speaking">
        <AIInterviewer />
      </section>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <h2 className="text-base font-bold text-dash-text">
          Open a Previous AI Speaking Result
        </h2>
        <p className="mt-1 text-sm text-dash-text-muted">
          If you already have an attempt ID, open the saved transcript and full
          feedback dashboard directly.
        </p>
        <Link
          href="/dashboard/student/progress"
          className="mt-4 inline-flex rounded-lg border border-dash-border px-4 py-2 text-sm font-medium text-dash-accent transition-colors hover:bg-dash-bg"
        >
          Find Attempt IDs in Progress
        </Link>
      </section>
    </div>
  );
}
