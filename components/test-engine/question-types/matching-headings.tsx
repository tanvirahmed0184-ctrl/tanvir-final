type MatchingItem = {
  id: string;
  label: string;
  text: string;
};

type HeadingOption = {
  value: string;
  label: string;
};

type MatchingHeadingsProps = {
  questionId: string;
  instruction?: string;
  items: MatchingItem[];
  options: HeadingOption[];
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  disabled?: boolean;
  className?: string;
};

export default function MatchingHeadings({
  questionId,
  instruction,
  items,
  options,
  value,
  onChange,
  disabled,
  className,
}: MatchingHeadingsProps) {
  function updateItem(itemId: string, nextValue: string) {
    onChange({
      ...value,
      [itemId]: nextValue,
    });
  }

  return (
    <div
      className={[
        "rounded-[1.35rem] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.55)]",
        className || "",
      ].join(" ")}
    >
      <p className="text-base font-semibold leading-7 text-slate-950">
        {instruction || "Match each item with the correct heading."}
      </p>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 md:grid-cols-[1fr_220px] md:items-center"
          >
            <p className="text-sm text-slate-800">
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-800">
                {item.label}.
              </span>
              {item.text}
            </p>

            <select
              id={`matching-${questionId}-${item.id}`}
              value={value[item.id] || ""}
              onChange={(e) => updateItem(item.id, e.target.value)}
              disabled={disabled}
              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <option value="">Select heading</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
