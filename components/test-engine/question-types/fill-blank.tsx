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
      className="mx-1 inline-flex min-w-40 rounded-lg border border-brand-purple/30 px-2 py-1 text-sm outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 disabled:cursor-not-allowed disabled:opacity-70"
    />
  );

  return (
    <div
      className={[
        "rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm",
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
