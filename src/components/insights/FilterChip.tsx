"use client";
import { X } from 'lucide-react';

interface FilterChipProps {
  label: string;
  onClear: () => void;
}

export function FilterChip({ label, onClear }: FilterChipProps) {
  return (
    <button
      onClick={onClear}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium text-[#525252] bg-[#f5f5f5] hover:bg-[#ebebeb] cursor-pointer transition-colors"
    >
      {label}
      <X className="w-2.5 h-2.5 text-[#a3a3a3]" />
    </button>
  );
}
