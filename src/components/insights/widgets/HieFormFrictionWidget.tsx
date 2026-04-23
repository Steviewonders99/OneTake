"use client";

import { useEffect, useState } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

interface DiagnosticObservation {
  type: string;
  confidence: string;
  message: string;
  recommended_action: string;
}

const TYPE_LABELS: Record<string, string> = {
  scroll_cliff: 'Scroll Cliff',
  cta_weakness: 'CTA Weakness',
  form_friction: 'Form Friction',
  platform_mismatch: 'Platform Mismatch',
  ignored_section: 'Ignored Section',
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-blue-50 text-blue-600 border-blue-200',
};

export default function HieFormFrictionWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<{ observations: DiagnosticObservation[] } | null>(null);
  const pageUrl = config.pageUrl as string;

  useEffect(() => {
    if (!pageUrl) return;
    fetch(`/api/hie/diagnostics?page_url=${encodeURIComponent(pageUrl)}`).then(r => r.json()).then(setData).catch(() => {});
  }, [pageUrl]);

  if (!pageUrl) return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">Configure a page URL in widget settings</div>;
  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (data.observations.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <CheckCircle className="w-8 h-8 text-green-500" />
        <p className="text-xs font-semibold text-[var(--foreground)]">No Issues Detected</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">All CRO diagnostics passed for this page</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto space-y-2">
      {data.observations.map((obs, i) => {
        const styles = CONFIDENCE_STYLES[obs.confidence] ?? CONFIDENCE_STYLES.low;
        const Icon = obs.confidence === 'high' ? AlertTriangle : AlertCircle;
        return (
          <div key={i} className={`flex gap-2.5 p-3 rounded-xl border ${styles}`}>
            <Icon className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold uppercase">{TYPE_LABELS[obs.type] ?? obs.type}</span>
                <span className="text-[9px] opacity-60">{obs.confidence} confidence</span>
              </div>
              <div className="text-[11px] font-medium">{obs.message}</div>
              <div className="text-[10px] opacity-75 mt-1">{obs.recommended_action}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
