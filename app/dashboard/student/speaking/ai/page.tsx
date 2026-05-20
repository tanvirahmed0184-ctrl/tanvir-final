"use client";

import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";
import AIInterviewer from "@/components/speaking/ai-interviewer/ai-interviewer";

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

      <div className="rounded-3xl border border-dash-border bg-dash-surface p-4">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-dash-accent-light px-3 py-1 text-xs font-semibold uppercase tracking-wide text-dash-accent">
          <Bot size={14} />
          Dedicated experience
        </div>
        <AIInterviewer />
      </div>
    </div>
  );
}
