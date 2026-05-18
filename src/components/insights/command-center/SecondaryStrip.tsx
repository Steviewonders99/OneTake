'use client';

import { BRAND } from './types';
import { formatEur } from './utils';

interface SecondaryStripProps {
  projectCount: number;
  channelCount: number;
  countryCount: number;
  totalSpend: number;
  unclassifiedCount: number;
}

export function SecondaryStrip(props: SecondaryStripProps) {
  const items = [
    { num: String(props.projectCount), label: 'Active Projects' },
    { num: String(props.channelCount), label: 'Channels Live' },
    { num: String(props.countryCount), label: 'Countries' },
    { num: formatEur(props.totalSpend), label: 'Total Ad Spend' },
    { num: String(props.unclassifiedCount), label: 'Unclassified Sources', color: props.unclassifiedCount > 0 ? BRAND.amber : undefined },
  ];

  return (
    <div className="grid grid-cols-5 gap-2.5 mb-6">
      {items.map((item) => (
        <div key={item.label} className="bg-white rounded-xl px-4 py-3.5 text-center border border-black/[0.08]"
             style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="text-[22px] font-extrabold tracking-tight" style={{ color: item.color ?? BRAND.text }}>{item.num}</div>
          <div className="text-[8px] uppercase tracking-[0.1em] mt-0.5" style={{ color: BRAND.text3 }}>{item.label}</div>
        </div>
      ))}
    </div>
  );
}
