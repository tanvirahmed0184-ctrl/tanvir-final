import type { ReactNode } from "react";

type FillBlankProps = {
  questionId: string;
  questionText: string;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

function renderInlineSentence(text: string, inputNode: ReactNode) {
  if (!text.includes("___")) {
    return (
      <p className="text-sm leading-7 text-slate-800">
        {text} {inputNode}
      </p>
    );
  }

  const parts = text.split("___");
  return (
    <p className="text-sm leading-7 text-slate-800">
      {parts[0]}
      {inputNode}
      {parts.slice(1).join("___")}
    </p>
  );
}

export default function FillBlank({
  questionId,
  questionText,
  value,
  onChange,
  disabled,
  className,
}: FillBlankProps) {
  const input = (
    <input
      id={`fill-blank-${questionId}`}
      type="text"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="Type your answer"
      className="mx-1 inline-flex min-w-40 rounded-xl border border-brand-teal/30 bg-teal-50/50 px-3 py-1.5 text-sm font-medium outline-none transition focus:border-brand-teal focus:bg-white focus:ring-2 focus:ring-brand-teal/20 disabled:cursor-not-allowed disabled:opacity-70"
    />
  );

  return (
    <div
      className={[
        "rounded-[1.35rem] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.55)]",
        className || "",
      ].join(" ")}
    >
      <label
        htmlFor={`fill-blank-${questionId}`}
        className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        Fill in the blank
      </label>
      {renderInlineSentence(questionText, input)}
    </div>
  );
}
