type TrueFalseNgProps = {
  questionId: string;
  questionText: string;
  value?: string;
  onChange: (value: "TRUE" | "FALSE" | "NOT_GIVEN") => void;
  disabled?: boolean;
  className?: string;
};

const OPTIONS: Array<{ label: string; value: "TRUE" | "FALSE" | "NOT_GIVEN" }> =
  [
    { label: "True", value: "TRUE" },
    { label: "False", value: "FALSE" },
    { label: "Not Given", value: "NOT_GIVEN" },
  ];

export default function TrueFalseNg({
  questionId,
  questionText,
  value,
  onChange,
  disabled,
  className,
}: TrueFalseNgProps) {
  return (
    <div
      className={[
        "rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm",
        className || "",
      ].join(" ")}
    >
      <p className="text-sm font-semibold text-slate-900">{questionText}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={[
                "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition",
                checked
                  ? "border-brand-purple bg-brand-purple/5 text-brand-purple"
                  : "border-slate-200 bg-white text-slate-700 hover:border-brand-purple/30",
                disabled ? "cursor-not-allowed opacity-70" : "",
              ].join(" ")}
            >
              <input
                type="radio"
                name={`tfn-${questionId}`}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                disabled={disabled}
                className="h-4 w-4 border-slate-300 text-brand-purple focus:ring-brand-purple"
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
