"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Clock3, ListChecks, TriangleAlert } from "lucide-react";

type Module = "READING" | "LISTENING" | "WRITING";

type InstructionBlock = {
  duration: string;
  bullets: string[];
  startPath: string;
};

const INSTRUCTIONS: Record<Module, InstructionBlock> = {
  READING: {
    duration: "60 minutes",
    bullets: [
      "You have 3 reading passages and 40 questions.",
      "Transfer your answers directly; no extra transfer time is given.",
      "Read instructions for each question type carefully.",
      "Manage time evenly across all three passages.",
      "Spelling and grammar matter in short-answer questions.",
    ],
    startPath: "/test-engine/reading",
  },
  LISTENING: {
    duration: "Approx. 30 minutes audio + 2 minutes final review",
    bullets: [
      "There are 4 sections and 40 questions in total.",
      "Questions stay visible while audio plays; answer as you listen.",
      "The test is audio-driven; no fixed 10-minute section timers.",
      "Seeking and fast-forward are disabled during the exam flow.",
      "After audio ends, a 2-minute review timer appears before submission.",
      "Use headphones in a quiet place for best practice quality.",
    ],
    startPath: "/test-engine/listening",
  },
  WRITING: {
    duration: "60 minutes",
    bullets: [
      "Task 1 recommended time: 20 minutes.",
      "Task 2 recommended time: 40 minutes and carries more weight.",
      "Task 1 minimum 150 words; Task 2 minimum 250 words.",
      "Focus on coherence, lexical resource, and grammar range.",
      "Plan briefly before writing and reserve time to review.",
    ],
    startPath: "/test-engine/writing",
  },
};

function detectModule(seed: string | null): Module {
  const s = (seed || "").toLowerCase();
  if (s.includes("listening")) return "LISTENING";
  if (s.includes("writing")) return "WRITING";
  return "READING";
}

export default function ExamInstructionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ attemptId: string }>();

  const attemptId = params?.attemptId || "";
  const moduleHint = searchParams.get("module");
  const attemptMode = searchParams.get("attemptMode") || "";
  const durationMins = searchParams.get("durationMins") || "";
  const selectedParts = searchParams.get("selectedParts") || "";
  const timeLimit = searchParams.get("timeLimit") || "";
  const task1PromptId = searchParams.get("task1PromptId") || "";
  const task2PromptId = searchParams.get("task2PromptId") || "";
  const task1ImageUrl = searchParams.get("task1ImageUrl") || "";
  const task2ImageUrl = searchParams.get("task2ImageUrl") || "";
  const writingDurationMins = searchParams.get("writingDurationMins") || "";
  const task1AttemptId = searchParams.get("task1AttemptId") || "";
  const task2AttemptId = searchParams.get("task2AttemptId") || "";
  const writingTestAttemptId = searchParams.get("writingTestAttemptId") || "";

  const [moduleType, setModuleType] = useState<Module>(
    detectModule(moduleHint || attemptId),
  );
  const error = attemptId ? null : "Attempt ID missing.";

  const current = useMemo(() => INSTRUCTIONS[moduleType], [moduleType]);

  function startTest() {
    const params = new URLSearchParams();
    params.set("attemptId", attemptId);
    if (attemptMode) {
      params.set("attemptMode", attemptMode);
    }
    if (durationMins) {
      params.set("durationMins", durationMins);
    }
    if (selectedParts) {
      params.set("selectedParts", selectedParts);
    }
    if (timeLimit) {
      params.set("timeLimit", timeLimit);
    }
    if (moduleType === "WRITING" && task1PromptId) {
      params.set("task1PromptId", task1PromptId);
    }
    if (moduleType === "WRITING" && task2PromptId) {
      params.set("task2PromptId", task2PromptId);
    }
    if (moduleType === "WRITING" && task1ImageUrl) {
      params.set("task1ImageUrl", task1ImageUrl);
    }
    if (moduleType === "WRITING" && task2ImageUrl) {
      params.set("task2ImageUrl", task2ImageUrl);
    }
    if (moduleType === "WRITING" && writingDurationMins) {
      params.set("writingDurationMins", writingDurationMins);
    }
    if (moduleType === "WRITING" && task1AttemptId) {
      params.set("task1AttemptId", task1AttemptId);
    }
    if (moduleType === "WRITING" && task2AttemptId) {
      params.set("task2AttemptId", task2AttemptId);
    }
    if (moduleType === "WRITING" && writingTestAttemptId) {
      params.set("writingTestAttemptId", writingTestAttemptId);
    }
    const url = `${current.startPath}?${params.toString()}`;
    router.push(url);
  }

  return (
    <div className="min-h-screen bg-[#f7f5ee] px-4 py-8">
      <div className="mx-auto max-w-5xl">
      <div className="relative overflow-hidden rounded-[2.25rem] bg-white p-8 shadow-[0_30px_90px_-60px_rgba(15,23,42,0.7)]">
        <div className="absolute right-0 top-0 h-56 w-56 rounded-bl-[8rem] bg-emerald-100" />
        <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
          IELTS Test Instructions
        </p>
        <h1 className="relative mt-3 text-4xl font-display tracking-tight text-slate-950 md:text-5xl">
          Read Carefully Before You Start
        </h1>
        <p className="relative mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Follow the instructions below for the selected module and begin when
          you are ready.
        </p>
      </div>

      <div className="mt-6 rounded-[2rem] bg-white/80 p-6 shadow-[0_24px_75px_-58px_rgba(15,23,42,0.75)]">
        <div className="flex flex-wrap gap-2">
          {(["READING", "LISTENING", "WRITING"] as Module[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setModuleType(item)}
              className={[
                "rounded-full border px-4 py-2 text-sm font-semibold transition",
                moduleType === item
                  ? "border-emerald-800 bg-emerald-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200",
              ].join(" ")}
            >
              {item[0] + item.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[1.5rem] bg-slate-50 p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Clock3 size={16} className="text-brand-purple" />
              Duration: {current.duration}
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-slate-50 p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ListChecks size={16} className="text-brand-teal" />
              Attempt ID: {attemptId || "N/A"}
            </p>
          </div>
        </div>

        <ul className="mt-5 space-y-2">
          {current.bullets.map((line) => (
            <li
              key={line}
              className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
            >
              {line}
            </li>
          ))}
        </ul>

        {error ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="inline-flex items-start gap-2">
              <TriangleAlert size={16} className="mt-0.5" />
              {error}
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={startTest}
            disabled={!attemptId}
            className="inline-flex items-center justify-center rounded-2xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            Start Test
          </button>
          <Link
            href="/exam-library/reading"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
          >
            Back to Library
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}
