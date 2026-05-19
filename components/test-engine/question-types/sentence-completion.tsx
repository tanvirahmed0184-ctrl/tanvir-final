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
      className="mx-1 inline-flex min-w-44 rounded-lg border border-brand-purple/30 px-2 py-1 text-sm outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 disabled:cursor-not-allowed disabled:opacity-70"
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
