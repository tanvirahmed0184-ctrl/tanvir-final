"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ListeningTestEngine from "@/components/test-engine/listening-test-engine";

function ListeningTestPageInner() {
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("attemptId") || "";
  const attemptMode = searchParams.get("attemptMode") || "";
  const durationMins = Number(searchParams.get("durationMins") || 30);
  const selectedPartsCsv = searchParams.get("selectedParts") || "";
  const timeLimit = searchParams.get("timeLimit") || "";

  if (!attemptId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Missing attempt ID. Please start a listening test from the exam
          library.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-350 px-4 py-6">
      <ListeningTestEngine
        attemptId={attemptId}
        attemptMode={attemptMode}
        durationMins={Number.isFinite(durationMins) ? durationMins : 30}
        selectedPartsCsv={selectedPartsCsv}
        timeLimit={timeLimit}
      />
    </div>
  );
}

export default function ListeningTestPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            Loading listening test...
          </div>
        </div>
      }
    >
      <ListeningTestPageInner />
    </Suspense>
  );
}
