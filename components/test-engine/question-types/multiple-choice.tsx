type Option = {
  id: string;
  label: string;
  text: string;
};

type MultipleChoiceProps = {
  questionId: string;
  questionText: string;
  options: Option[];
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

export default function MultipleChoice({
  questionId,
  questionText,
  options,
  value,
  onChange,
  disabled,
  className,
}: MultipleChoiceProps) {
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

      <div className="mt-3 space-y-2">
        {options.map((option) => {
          const checked = value === option.label || value === option.text;

          return (
            <label
              key={option.id}
              className={[
                "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-all",
                checked
                  ? "border-brand-teal/50 bg-teal-50/80 shadow-inner"
                  : "border-slate-200 bg-white hover:border-brand-teal/30 hover:bg-slate-50",
                disabled ? "cursor-not-allowed opacity-70" : "",
              ].join(" ")}
            >
              <input
                type="radio"
                name={`mcq-${questionId}`}
                value={option.label}
                checked={checked}
                onChange={() => onChange(option.label)}
                disabled={disabled}
                className="mt-1 h-4 w-4 border-slate-300 text-brand-teal focus:ring-brand-teal"
              />
              <span className="text-sm leading-6 text-slate-800">
                <strong className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-700">
                  {option.label}
                </strong>
                {option.text}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
