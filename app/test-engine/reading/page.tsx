"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ReadingTestEngine from "@/components/test-engine/reading-test-engine";

function ReadingTestPageInner() {
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("attemptId") || "";

  if (!attemptId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Missing attempt ID. Please start a test from the exam library.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-350 px-4 py-6">
      <ReadingTestEngine attemptId={attemptId} />
    </div>
  );
}

export default function ReadingTestPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            Loading reading test...
          </div>
        </div>
      }
    >
      <ReadingTestPageInner />
    </Suspense>
  );
}
