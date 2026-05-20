type YesNoNgProps = {
  questionId: string;
  questionText: string;
  value?: string;
  onChange: (value: "YES" | "NO" | "NOT_GIVEN") => void;
  disabled?: boolean;
  className?: string;
};

const OPTIONS: Array<{ label: string; value: "YES" | "NO" | "NOT_GIVEN" }> = [
  { label: "Yes", value: "YES" },
  { label: "No", value: "NO" },
  { label: "Not Given", value: "NOT_GIVEN" },
];

export default function YesNoNg({
  questionId,
  questionText,
  value,
  onChange,
  disabled,
  className,
}: YesNoNgProps) {
  return (
    <div
      className={[
        "rounded-[1.35rem] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.55)]",
        className || "",
      ].join(" ")}
    >
      <p className="text-base font-semibold leading-7 text-slate-950">
        {questionText}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={[
                "flex cursor-pointer items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition-all",
                checked
                  ? "border-brand-teal/50 bg-teal-50/80 text-teal-800 shadow-inner"
                  : "border-slate-200 bg-white text-slate-700 hover:border-brand-teal/30 hover:bg-slate-50",
                disabled ? "cursor-not-allowed opacity-70" : "",
              ].join(" ")}
            >
              <input
                type="radio"
                name={`yng-${questionId}`}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                disabled={disabled}
                className="h-4 w-4 border-slate-300 text-brand-teal focus:ring-brand-teal"
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
