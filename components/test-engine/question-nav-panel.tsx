import { useState } from "react";
import { Flag, Grid3X3, X } from "lucide-react";

type QuestionNavItem = {
  id: string;
  number: number;
  visited: boolean;
  answered: boolean;
  markedForReview?: boolean;
};

type QuestionNavPanelProps = {
  items: QuestionNavItem[];
  activeQuestionId?: string;
  onJump: (questionId: string) => void;
  onToggleReview: (questionId: string) => void;
  className?: string;
};

function dotClass(item: QuestionNavItem, isActive: boolean): string {
  if (item.answered) {
    return [
      "bg-emerald-500 text-white border-emerald-600",
      isActive ? "ring-2 ring-emerald-300" : "",
    ].join(" ");
  }

  if (item.visited) {
    return [
      "bg-amber-400 text-slate-900 border-amber-500",
      isActive ? "ring-2 ring-amber-300" : "",
    ].join(" ");
  }

  return [
    "bg-slate-200 text-slate-700 border-slate-300",
    isActive ? "ring-2 ring-slate-300" : "",
  ].join(" ");
}

export default function QuestionNavPanel({
  items,
  activeQuestionId,
  onJump,
  onToggleReview,
  className,
}: QuestionNavPanelProps) {
  const [collapsed, setCollapsed] = useState(true);
  const answeredCount = items.filter((item) => item.answered).length;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed right-4 top-1/2 z-50 inline-flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-800 shadow-2xl shadow-slate-900/15 backdrop-blur transition hover:scale-105 hover:border-brand-teal/30 hover:text-brand-teal-dark"
        aria-label="Open answer navigator"
      >
        <Grid3X3 size={18} />
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-teal px-1 text-[10px] font-bold text-white">
          {answeredCount}
        </span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-slate-950/10 backdrop-blur-[1px]"
        onClick={() => setCollapsed(true)}
        aria-label="Close answer navigator backdrop"
      />
      <aside
        className={[
          "fixed right-4 top-24 z-50 max-h-[calc(100vh-7rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-[1.5rem] border border-slate-200/80 bg-white/95 p-4 shadow-2xl shadow-slate-900/15 backdrop-blur-xl transition-all",
          className || "",
        ].join(" ")}
      >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">
            Answer Map
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {answeredCount}/{items.length} answered
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-brand-teal/30 hover:text-brand-teal-dark"
          aria-label="Collapse answer navigator"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
        {items.map((item) => {
          const active = item.id === activeQuestionId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onJump(item.id)}
              className={[
                "h-9 w-9 rounded-full border text-xs font-bold transition",
                dotClass(item, active),
              ].join(" ")}
              aria-label={`Jump to question ${item.number}`}
            >
              {item.number}
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-2 text-xs text-slate-600">
        <div className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-slate-300" />{" "}
          Not visited
        </div>
        <div className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-amber-400" />{" "}
          Visited, not answered
        </div>
        <div className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />{" "}
          Answered
        </div>
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Mark for Review
        </p>
        <div className="max-h-44 space-y-1 overflow-auto pr-1">
          {items.map((item) => (
            <button
              key={`${item.id}-review`}
              type="button"
              onClick={() => onToggleReview(item.id)}
              className={[
                "flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs transition",
                item.markedForReview
                  ? "border-brand-purple/35 bg-brand-purple/10 text-brand-purple"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              <span>Question {item.number}</span>
              <Flag size={13} />
            </button>
          ))}
        </div>
      </div>
    </aside>
    </>
  );
}
