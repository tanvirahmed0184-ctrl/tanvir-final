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
        "rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm",
        className || "",
      ].join(" ")}
    >
      <p className="text-sm font-semibold text-slate-900">
        {instruction || "Match each item with the correct heading."}
      </p>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_220px] md:items-center"
          >
            <p className="text-sm text-slate-800">
              <span className="mr-1 font-semibold text-brand-purple">
                {item.label}.
              </span>
              {item.text}
            </p>

            <select
              id={`matching-${questionId}-${item.id}`}
              value={value[item.id] || ""}
              onChange={(e) => updateItem(item.id, e.target.value)}
              disabled={disabled}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 disabled:cursor-not-allowed disabled:opacity-70"
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
