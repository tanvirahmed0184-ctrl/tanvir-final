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
        "rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm",
        className || "",
      ].join(" ")}
    >
      <p className="text-sm font-semibold text-slate-900">{questionText}</p>

      <div className="mt-3 space-y-2">
        {options.map((option) => {
          const checked = value === option.label || value === option.text;

          return (
            <label
              key={option.id}
              className={[
                "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition",
                checked
                  ? "border-brand-purple bg-brand-purple/5"
                  : "border-slate-200 bg-white hover:border-brand-purple/30",
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
                className="mt-1 h-4 w-4 border-slate-300 text-brand-purple focus:ring-brand-purple"
              />
              <span className="text-sm text-slate-800">
                <strong className="mr-1">{option.label}.</strong>
                {option.text}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
