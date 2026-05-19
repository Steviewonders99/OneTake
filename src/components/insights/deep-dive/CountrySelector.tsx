'use client';

import { BRAND } from '../command-center/types';

interface LocaleLink {
  language: string;
  platform_request_id: string | null;
  is_active: boolean;
}

interface CountrySelectorProps {
  locales: LocaleLink[];
  selectedLocale: string | null;
  onSelect: (locale: string | null) => void;
}

export function CountrySelector({ locales, selectedLocale, onSelect }: CountrySelectorProps) {
  const active = locales.filter(l => l.is_active);
  if (active.length === 0) return null;

  // Show first 8, then "+N more"
  const visible = active.slice(0, 8);
  const remaining = active.length - 8;

  return (
    <div className="flex gap-1.5 flex-wrap mb-4">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
          !selectedLocale
            ? 'bg-[#111827] text-white'
            : 'border border-[#E5E7EB] text-[#4B5563] hover:border-[#9CA3AF]'
        }`}
      >
        All ({active.length})
      </button>
      {visible.map(l => (
        <button
          key={l.language}
          onClick={() => onSelect(l.language === selectedLocale ? null : l.language)}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
            l.language === selectedLocale
              ? 'bg-[#7C3AED] text-white'
              : 'border border-[#E5E7EB] text-[#4B5563] hover:border-[#9CA3AF]'
          }`}
        >
          {l.language}
        </button>
      ))}
      {remaining > 0 && (
        <span className="px-3 py-1.5 text-[11px]" style={{ color: BRAND.text3 }}>
          +{remaining} more
        </span>
      )}
    </div>
  );
}
