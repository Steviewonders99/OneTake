"use client";

interface AiInsightLineProps {
  text: string;
  type: 'info' | 'positive' | 'warning' | 'alert';
}

const DOT_COLOR = {
  info: '#3b82f6',
  positive: '#22c55e',
  warning: '#f97316',
  alert: '#ef4444',
};

export function AiInsightLine({ text, type }: AiInsightLineProps) {
  return (
    <div className="mt-2 pt-2 border-t border-[#f5f5f5] flex items-start gap-1.5">
      <div
        className="w-[5px] h-[5px] rounded-full mt-[5px] shrink-0"
        style={{ backgroundColor: DOT_COLOR[type] }}
      />
      <span className="text-[11px] text-[#525252] leading-relaxed">{text}</span>
    </div>
  );
}
