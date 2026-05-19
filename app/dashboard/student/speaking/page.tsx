"use client";

import Link from "next/link";
import { Mic, UserRoundSearch } from "lucide-react";
import AIInterviewer from "@/components/speaking/ai-interviewer/ai-interviewer";

export default function StudentSpeakingPage() {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-brand-purple via-brand-purple-dark to-brand-teal p-5 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Speaking Practice Hub</h1>
        <p className="mt-2 text-sm text-white/85">
          Train with AI or book an instructor-led speaking session.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-brand-purple/20 bg-white p-5 shadow-sm">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-purple/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-purple">
            <Mic size={14} />
            AI Speaking Test
          </p>
          <h2 className="mt-3 text-lg font-bold text-slate-900">
            Practice with AI Examiner
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Simulate all speaking parts with examiner-style prompts and instant
            feedback.
          </p>
          <a
            href="#ai-speaking"
            className="mt-4 inline-flex rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white"
          >
            Start AI Speaking
          </a>
        </article>

        <article className="rounded-2xl border border-brand-teal/20 bg-white p-5 shadow-sm">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-teal/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">
            <UserRoundSearch size={14} />
            Book Instructor
          </p>
          <h2 className="mt-3 text-lg font-bold text-slate-900">
            Get Human Feedback
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Reserve a speaking slot with an IELTS instructor and receive
            targeted rubric-based evaluation.
          </p>
          <Link
            href="/dashboard/student/book"
            className="mt-4 inline-flex rounded-xl bg-brand-teal px-4 py-2 text-sm font-semibold text-white"
          >
            Book Instructor
          </Link>
        </article>
      </section>

      <section id="ai-speaking">
        <AIInterviewer />
      </section>

      <section className="rounded-2xl border border-brand-purple/15 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">
          Open a Previous AI Speaking Result
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          If you already have an attempt ID, open the saved transcript and full
          feedback dashboard directly.
        </p>
        <Link
          href="/dashboard/student/progress"
          className="mt-4 inline-flex rounded-xl border border-brand-purple/25 px-4 py-2 text-sm font-semibold text-brand-purple"
        >
          Find Attempt IDs in Progress
        </Link>
      </section>
    </div>
  );
}
