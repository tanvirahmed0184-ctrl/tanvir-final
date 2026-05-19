"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WritingTestEngine from "@/components/test-engine/writing-test-engine";

function WritingTestPageInner() {
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("attemptId") || "";
  const task1PromptId = searchParams.get("task1PromptId") || "";
  const task2PromptId = searchParams.get("task2PromptId") || "";
  const task1ImageUrl = searchParams.get("task1ImageUrl") || "";
  const task2ImageUrl = searchParams.get("task2ImageUrl") || "";
  const writingDurationMins = Number(
    searchParams.get("writingDurationMins") || 60,
  );
  const task1AttemptId = searchParams.get("task1AttemptId") || "";
  const task2AttemptId = searchParams.get("task2AttemptId") || "";
  const writingTestAttemptId = searchParams.get("writingTestAttemptId") || "";

  if (!attemptId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Missing attempt ID. Please start a writing test from the exam library.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-350 px-4 py-6">
      <WritingTestEngine
        attemptId={attemptId}
        task1PromptId={task1PromptId}
        task2PromptId={task2PromptId}
        task1ImageUrl={task1ImageUrl}
        task2ImageUrl={task2ImageUrl}
        writingDurationMins={
          Number.isFinite(writingDurationMins) ? writingDurationMins : 60
        }
        task1AttemptId={task1AttemptId}
        task2AttemptId={task2AttemptId}
        writingTestAttemptId={writingTestAttemptId}
      />
    </div>
  );
}

export default function WritingTestPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            Loading writing test...
          </div>
        </div>
      }
    >
      <WritingTestPageInner />
    </Suspense>
  );
}
