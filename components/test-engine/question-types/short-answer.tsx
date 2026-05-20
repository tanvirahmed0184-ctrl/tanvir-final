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
        "rounded-[1.35rem] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.55)]",
        className || "",
      ].join(" ")}
    >
      <label
        htmlFor={`short-answer-${questionId}`}
        className="text-base font-semibold leading-7 text-slate-950"
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
        className="mt-3 w-full rounded-2xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:bg-white focus:ring-2 focus:ring-brand-teal/20 disabled:cursor-not-allowed disabled:opacity-70"
      />
    </div>
  );
}
