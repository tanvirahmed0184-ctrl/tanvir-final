"use client";

import Link from "next/link";
import { ArrowLeft, Bot, Mic, ShieldCheck } from "lucide-react";

export default function AISpeakingExamPage() {
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
        <p className="workspace-section-title">AI examiner room</p>
        <h1 className="mt-4 text-3xl font-semibold text-dash-text md:text-4xl">
          AI Speaking Examiner
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-dash-text-muted md:text-base">
          Start a dedicated AI speaking test with examiner prompts, microphone
          capture, transcription, and IELTS-style evaluation.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <article className="rounded-3xl border border-dash-border bg-dash-surface p-6">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-dash-accent-light text-dash-accent">
            <Mic size={22} />
          </span>
          <h2 className="mt-5 text-2xl font-semibold text-dash-text">
            Before you enter the AI exam room
          </h2>
          <p className="mt-3 text-sm leading-6 text-dash-text-muted">
            Allow microphone access, use headphones if possible, and speak in a
            quiet environment. Once the exam starts, leaving can finalize the
            attempt.
          </p>
          <Link
            href="/dashboard/student/speaking/ai/exam"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-dash-accent px-5 py-3 text-sm font-semibold text-white"
          >
            <Bot size={16} />
            Start AI Examiner
          </Link>
        </article>

        <article className="rounded-3xl border border-dash-border bg-dash-surface p-6">
          <p className="workspace-section-title">Speaking instructions</p>
          <div className="mt-5 grid gap-3">
            {[
              "The AI examiner will read each prompt aloud.",
              "Answer naturally and avoid reading prepared scripts.",
              "Your audio, transcript, timing, pauses, and response quality are used for feedback.",
              "If you attempt to leave during the exam, you will be warned first.",
            ].map((line, index) => (
              <div
                key={line}
                className="flex gap-3 rounded-2xl bg-white/65 p-4"
              >
                <ShieldCheck size={17} className="mt-0.5 text-dash-accent" />
                <p className="text-sm leading-6 text-dash-text">
                  <span className="font-semibold">0{index + 1}.</span> {line}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
