type ShortAnswerProps = {
  questionId: string;
  questionText: string;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  wordLimitHint?: string;
  className?: string;
};

export default function ShortAnswer({
  questionId,
  questionText,
  value,
  onChange,
  disabled,
  placeholder,
  wordLimitHint,
  className,
}: ShortAnswerProps) {
  return (
    <div
      className={[
        "rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm",
        className || "",
      ].join(" ")}
    >
      <label
        htmlFor={`short-answer-${questionId}`}
        className="text-sm font-semibold text-slate-900"
      >
        {questionText}
      </label>

      {wordLimitHint ? (
        <p className="mt-1 text-xs text-slate-500">{wordLimitHint}</p>
      ) : null}

      <input
        id={`short-answer-${questionId}`}
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder || "Type your short answer"}
        className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 disabled:cursor-not-allowed disabled:opacity-70"
      />
    </div>
  );
}
