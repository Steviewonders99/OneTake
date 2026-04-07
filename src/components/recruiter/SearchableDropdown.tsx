"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
}

interface SearchableDropdownProps {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export default function SearchableDropdown({
  label,
  value,
  options,
  onChange,
  searchable = false,
  placeholder = "Select…",
  disabled = false,
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = searchable && query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()) || o.value.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Reset query when closing
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function handleSelect(opt: DropdownOption) {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={ref} className="relative">
      <div className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold mb-1">
        {label}
      </div>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={[
          "w-full text-xs px-2 py-1.5 rounded-md border border-[var(--border)] bg-white flex items-center justify-between gap-1 cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed",
          open && "border-[#9B51E0] ring-1 ring-[#9B51E0]/20",
        ].filter(Boolean).join(" ")}
      >
        <span className={selected ? "text-[var(--foreground)] truncate" : "text-[var(--muted-foreground)] truncate"}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={12} className="text-[var(--muted-foreground)] shrink-0" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-[var(--border)] rounded-md shadow-lg z-30 overflow-hidden">
          {searchable && (
            <div className="p-1.5 border-b border-[var(--border)] flex items-center gap-1.5">
              <Search size={11} className="text-[var(--muted-foreground)] shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to search…"
                className="w-full text-xs bg-transparent outline-none"
                autoFocus
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[var(--muted-foreground)] text-center">No matches</div>
            ) : (
              filtered.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={[
                      "w-full text-left text-xs px-3 py-1.5 cursor-pointer flex items-center justify-between gap-2",
                      isSelected ? "bg-[#9B51E0]/10 text-[#9B51E0] font-semibold" : "hover:bg-[var(--muted)] text-[var(--foreground)]",
                    ].join(" ")}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check size={11} className="shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
