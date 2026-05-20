"use client";

import Link from "next/link";
import { ArrowRight, Bot, UserRoundSearch } from "lucide-react";

export default function StudentSpeakingPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="workspace-section-title">Speaking exam modes</p>
        <h1 className="mt-4 text-3xl font-semibold text-dash-text md:text-4xl">
          Speaking Practice Hub
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-dash-text-muted md:text-base">
          Choose a dedicated speaking experience: immersive AI examiner flow or
          human instructor feedback with booking support.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="group relative overflow-hidden rounded-3xl border border-dash-border bg-dash-surface p-6">
          <div className="absolute right-0 top-0 h-36 w-36 rounded-bl-[5rem] bg-dash-accent-light" />
          <p className="relative inline-flex items-center gap-2 rounded-full bg-dash-accent-light px-3 py-1 text-xs font-semibold uppercase tracking-wide text-dash-accent">
            <Bot size={14} />
            AI Examiner
          </p>
          <h2 className="relative mt-5 text-2xl font-semibold text-dash-text">
            Immersive AI Speaking Test
          </h2>
          <p className="relative mt-3 text-sm leading-6 text-dash-text-muted">
            Enter a dedicated exam room with microphone visuals, examiner
            prompts, transcript capture, and instant IELTS-style feedback.
          </p>
          <Link
            href="/dashboard/student/speaking/ai"
            className="relative mt-6 inline-flex items-center gap-2 rounded-2xl bg-dash-accent px-5 py-3 text-sm font-semibold text-white"
          >
            Open AI Examiner
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </article>

        <article className="group relative overflow-hidden rounded-3xl border border-dash-border bg-dash-surface p-6">
          <div className="absolute right-0 top-0 h-36 w-36 rounded-bl-[5rem] bg-dash-accent-light" />
          <p className="relative inline-flex items-center gap-2 rounded-full bg-dash-accent-light px-3 py-1 text-xs font-semibold uppercase tracking-wide text-dash-accent">
            <UserRoundSearch size={14} />
            Human Examiner
          </p>
          <h2 className="relative mt-5 text-2xl font-semibold text-dash-text">
            Instructor-led Speaking Review
          </h2>
          <p className="relative mt-3 text-sm leading-6 text-dash-text-muted">
            Reserve a speaking slot with an IELTS instructor and receive
            targeted rubric-based evaluation.
          </p>
          <Link
            href="/dashboard/student/speaking/human"
            className="relative mt-6 inline-flex items-center gap-2 rounded-2xl bg-dash-accent px-5 py-3 text-sm font-semibold text-white"
          >
            Open Human Examiner
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </article>
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
