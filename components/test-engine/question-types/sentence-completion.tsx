import type { ReactNode } from "react";

type SentenceCompletionProps = {
  questionId: string;
  sentence: string;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  wordLimitHint?: string;
  className?: string;
};

function renderSentenceWithBlank(sentence: string, inputNode: ReactNode) {
  if (!sentence.includes("___")) {
    return (
      <p className="text-sm leading-7 text-slate-800">
        {sentence} {inputNode}
      </p>
    );
  }

  const [before, ...rest] = sentence.split("___");
  return (
    <p className="text-sm leading-7 text-slate-800">
      {before}
      {inputNode}
      {rest.join("___")}
    </p>
  );
}

export default function SentenceCompletion({
  questionId,
  sentence,
  value,
  onChange,
  disabled,
  wordLimitHint,
  className,
}: SentenceCompletionProps) {
  const input = (
    <input
      id={`sentence-completion-${questionId}`}
      type="text"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="Complete the sentence"
      className="mx-1 inline-flex min-w-44 rounded-xl border border-brand-teal/30 bg-teal-50/50 px-3 py-1.5 text-sm font-medium outline-none transition focus:border-brand-teal focus:bg-white focus:ring-2 focus:ring-brand-teal/20 disabled:cursor-not-allowed disabled:opacity-70"
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
        htmlFor={`sentence-completion-${questionId}`}
        className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        Sentence Completion
      </label>

      {wordLimitHint ? (
        <p className="mb-2 text-xs text-slate-500">{wordLimitHint}</p>
      ) : null}

      {renderSentenceWithBlank(sentence, input)}
    </div>
  );
}
