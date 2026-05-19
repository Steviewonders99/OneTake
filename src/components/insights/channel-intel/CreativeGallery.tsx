'use client';

import { useState } from 'react';
import { BRAND } from '../command-center/types';
import { formatEur } from '../command-center/utils';

interface Creative {
  creativeId: string;
  campaignName: string;
  region: string;
  imageUrl?: string;
  headline?: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number | null;
}

interface CreativeGalleryProps {
  creatives: Creative[];
}

export function CreativeGallery({ creatives }: CreativeGalleryProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  if (creatives.length === 0) return null;

  // Get unique regions with spend totals
  const regionMap = new Map<string, number>();
  creatives.forEach(c => {
    regionMap.set(c.region, (regionMap.get(c.region) ?? 0) + c.spend);
  });
  const regions = Array.from(regionMap.entries()).sort((a, b) => b[1] - a[1]);

  const filtered = selectedRegion ? creatives.filter(c => c.region === selectedRegion) : creatives;
  const sorted = [...filtered].sort((a, b) => (b.conversions || 0) - (a.conversions || 0));

  // Find top performer
  const topPerformer = sorted.find(c => c.cpa !== null && c.conversions > 0);

  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] overflow-hidden"
         style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="px-5 py-3.5 border-b border-black/[0.04] flex justify-between items-center">
        <h3 className="text-[13px] font-bold flex items-center gap-2" style={{ color: BRAND.text }}>
          <span className="w-5 h-5 rounded-[5px] inline-flex items-center justify-center text-[9px] font-extrabold text-white"
                style={{ background: BRAND.blue }}>C</span>
          Creative Gallery — Per Region
        </h3>
        <span className="text-[10px] uppercase tracking-[0.06em]" style={{ color: BRAND.text3 }}>
          Ad sets = regions · Meta Marketing API
        </span>
      </div>

      <div className="p-5">
        {/* Region tabs */}
        <div className="flex gap-1.5 flex-wrap mb-4">
          <button onClick={() => setSelectedRegion(null)}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
                    !selectedRegion ? 'bg-[#111827] text-white' : 'border border-[#E5E7EB] text-[#4B5563] hover:border-[#9CA3AF]'
                  }`}>
            All Regions
          </button>
          {regions.map(([region, spend]) => (
            <button key={region} onClick={() => setSelectedRegion(selectedRegion === region ? null : region)}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                      selectedRegion === region ? 'bg-[#7C3AED] text-white' : 'border border-[#E5E7EB] text-[#4B5563]'
                    }`}>
              {region} ({formatEur(spend)})
            </button>
          ))}
        </div>

        {/* Creative cards */}
        <div className="grid grid-cols-4 gap-2.5">
          {sorted.slice(0, 8).map((creative, i) => {
            const isTop = topPerformer && creative.creativeId === topPerformer.creativeId;
            return (
              <div key={creative.creativeId}
                   className="border rounded-[10px] overflow-hidden"
                   style={{ borderColor: isTop ? BRAND.blue : 'rgba(0,0,0,0.08)', background: isTop ? '#EFF6FF' : 'white' }}>
                <div className="h-[110px] flex items-center justify-center"
                     style={{ background: isTop
                       ? 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(124,58,237,0.12))'
                       : 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(37,99,235,0.06))' }}>
                  {creative.imageUrl ? (
                    <img src={creative.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-[70px] h-[70px] rounded-lg opacity-30"
                         style={{ background: `linear-gradient(135deg, ${BRAND.purple}, ${BRAND.blue})` }} />
                  )}
                </div>
                <div className="p-2.5">
                  <div className="text-[10px] font-semibold" style={{ color: isTop ? BRAND.blue : BRAND.text }}>
                    {isTop ? 'TOP PERFORMER' : `Creative #${i + 1}`}
                  </div>
                  <div className="text-[9px]" style={{ color: isTop ? BRAND.blue : BRAND.text3 }}>
                    {creative.campaignName.slice(0, 25)} · {creative.region}
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <div className="text-[16px] font-extrabold" style={{ color: BRAND.blue }}>
                      {creative.cpa ? formatEur(creative.cpa) : '—'}
                    </div>
                    <div className="text-[9px] self-end" style={{ color: BRAND.text3 }}>CPA</div>
                  </div>
                  <div className="flex gap-2 mt-1 text-[9px]" style={{ color: BRAND.text3 }}>
                    <span>{creative.impressions >= 1000 ? `${(creative.impressions / 1000).toFixed(1)}K` : creative.impressions} imp</span>
                    <span>{creative.clicks} clk</span>
                    <span style={{ fontWeight: 700, color: BRAND.purple }}>{creative.conversions} conv</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
