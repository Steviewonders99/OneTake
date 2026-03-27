"use client";

interface FilterTab {
  value: string;
  label: string;
  count?: number;
}

interface FilterTabsProps {
  tabs: FilterTab[];
  value: string;
  onChange: (value: string) => void;
}

export default function FilterTabs({ tabs, value, onChange }: FilterTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`
            px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer
            ${
              value === tab.value
                ? "bg-[var(--oneforma-charcoal)] text-white"
                : "bg-white border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"
            }
          `}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`ml-1.5 text-xs ${
                value === tab.value ? "text-white/70" : "text-[var(--muted-foreground)]"
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
