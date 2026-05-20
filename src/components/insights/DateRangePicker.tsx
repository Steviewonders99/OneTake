'use client';

import { useState, useRef, useEffect } from 'react';
import { CalendarDays, ArrowLeftRight } from 'lucide-react';
import { BRAND } from './command-center/types';
import type { DateRangePreset, DateRangeValue } from './command-center/types';

interface Props {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  showCompare?: boolean;
}

const PRESETS: { label: string; value: DateRangePreset }[] = [
  { label: '7d', value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: 'All', value: 'all' },
];

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // Mon=0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
}

function presetToRange(preset: DateRangePreset): { start: string; end: string } {
  const end = formatDate(new Date());
  if (preset === 'all') return { start: '2025-01-01', end };
  // Snap start to beginning of the week N days ago so we always get complete weeks
  // 7d = this week + last week (2 weeks), 14d = ~2-3 weeks, 30d = ~4-5 weeks, 90d = ~13 weeks
  const raw = new Date();
  raw.setDate(raw.getDate() - preset);
  const snapped = startOfWeek(raw);
  return { start: formatDate(snapped), end };
}

function getPreviousPeriod(start: string, end: string): { start: string; end: string } {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const days = Math.round((e.getTime() - s.getTime()) / 86400000);
  const prevEnd = new Date(s.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - days * 86400000);
  return { start: formatDate(prevStart), end: formatDate(prevEnd) };
}

function formatLabel(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(s)} – ${fmt(e)}`;
}

export function DateRangePicker({ value, onChange, showCompare = true }: Props) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(value.start);
  const [customEnd, setCustomEnd] = useState(value.end);
  const [comparing, setComparing] = useState(!!value.compare);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePreset = (preset: DateRangePreset) => {
    const range = presetToRange(preset);
    const compare = comparing ? getPreviousPeriod(range.start, range.end) : null;
    onChange({ ...range, preset, compare });
    setCustomStart(range.start);
    setCustomEnd(range.end);
    setOpen(false);
  };

  const handleCustomApply = () => {
    if (customStart && customEnd && customStart <= customEnd) {
      const compare = comparing ? getPreviousPeriod(customStart, customEnd) : null;
      onChange({ start: customStart, end: customEnd, preset: undefined, compare });
      setOpen(false);
    }
  };

  const toggleCompare = () => {
    const next = !comparing;
    setComparing(next);
    const compare = next ? getPreviousPeriod(value.start, value.end) : null;
    onChange({ ...value, compare });
  };

  return (
    <div ref={ref} className="relative">
      {/* Preset pills + custom trigger */}
      <div className="flex items-center gap-0">
        <div className="flex gap-0.5 bg-[#F6F7FB] rounded-lg p-[3px]">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => handlePreset(p.value)}
              className={`px-3.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                value.preset === p.value ? 'bg-[#111827] text-white' : 'text-[#9CA3AF] hover:text-[#4B5563]'
              }`}>
              {p.label}
            </button>
          ))}
          <button onClick={() => setOpen(!open)}
            className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
              !value.preset ? 'bg-[#111827] text-white' : 'text-[#9CA3AF] hover:text-[#4B5563]'
            }`}>
            {!value.preset ? formatLabel(value.start, value.end) : <CalendarDays size={14} />}
          </button>
        </div>

        {/* Compare toggle */}
        {showCompare && (
          <button onClick={toggleCompare}
            className={`ml-2 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all border ${
              comparing
                ? 'bg-[#F5F3FF] text-[#7C3AED] border-[#7C3AED]/20'
                : 'bg-transparent text-[#9CA3AF] border-transparent hover:text-[#4B5563]'
            }`}>
            <ArrowLeftRight size={12} className="inline mr-1" />{comparing ? 'Comparing' : 'Compare'}
          </button>
        )}
      </div>

      {/* Custom date dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl border border-black/10 shadow-lg p-4 min-w-[300px]"
             style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
          <div className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: BRAND.text3 }}>
            Custom Range
          </div>
          <div className="flex gap-2 items-center mb-3">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="flex-1 px-2.5 py-2 border rounded-lg text-[12px] bg-white"
              style={{ color: BRAND.text, borderColor: BRAND.border }} />
            <span className="text-[11px]" style={{ color: BRAND.text3 }}>to</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="flex-1 px-2.5 py-2 border rounded-lg text-[12px] bg-white"
              style={{ color: BRAND.text, borderColor: BRAND.border }} />
          </div>
          <button onClick={handleCustomApply}
            className="w-full py-2 rounded-lg text-[12px] font-semibold text-white transition-all"
            style={{ background: BRAND.gradDeep }}>
            Apply Range
          </button>

          {comparing && (
            <div className="mt-3 pt-3 border-t border-black/5">
              <div className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-1" style={{ color: BRAND.text3 }}>
                Comparing to
              </div>
              <div className="text-[12px] font-medium" style={{ color: BRAND.purple }}>
                {value.compare ? formatLabel(value.compare.start, value.compare.end) : '—'}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: BRAND.text3 }}>
                Previous period (auto-calculated)
              </div>
            </div>
          )}

          {/* Quick presets in dropdown */}
          <div className="mt-3 pt-3 border-t border-black/5 flex gap-1.5 flex-wrap">
            {[
              { label: 'Last 7 days', days: 7 },
              { label: 'Last 30 days', days: 30 },
              { label: 'Last quarter', days: 90 },
              { label: 'This month', days: 0 },
              { label: 'Last month', days: -1 },
            ].map(q => (
              <button key={q.label}
                onClick={() => {
                  let s: string, e: string;
                  if (q.days === 0) {
                    const now = new Date();
                    s = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
                    e = formatDate(now);
                  } else if (q.days === -1) {
                    const now = new Date();
                    s = formatDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
                    e = formatDate(new Date(now.getFullYear(), now.getMonth(), 0));
                  } else {
                    s = daysAgo(q.days);
                    e = formatDate(new Date());
                  }
                  setCustomStart(s);
                  setCustomEnd(e);
                }}
                className="px-2.5 py-1 rounded-md text-[10px] font-medium bg-[#F6F7FB] hover:bg-[#EDE9FE] transition-all"
                style={{ color: BRAND.text2 }}>
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Helper: create a default DateRangeValue from a preset */
export function defaultDateRange(preset: DateRangePreset = 30): DateRangeValue {
  return { ...presetToRange(preset), preset };
}
