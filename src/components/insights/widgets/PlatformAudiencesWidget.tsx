"use client";

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Unplug } from 'lucide-react';

interface PlatformStatus {
  platform: string;
  connected: boolean;
  has_data: boolean;
  row_count: number;
  last_sync: string | null;
}

interface StatusResponse {
  platforms: PlatformStatus[];
}

const PLATFORM_LABELS: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta (Facebook/IG)',
  linkedin_ads: 'LinkedIn Ads',
  tiktok_ads: 'TikTok Ads',
};

const PLATFORM_COLORS: Record<string, string> = {
  google_ads: '#4285F4',
  meta_ads: '#1877F2',
  linkedin_ads: '#0A66C2',
  tiktok_ads: '#000000',
};

export default function PlatformAudiencesWidget({ config: _config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/audienceiq/platforms/status')
      .then(r => r.json())
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">
        Failed to load platform status
      </div>
    );
  }

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const connectedCount = data.platforms.filter(p => p.connected).length;

  if (connectedCount === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <Unplug className="w-8 h-8 text-[var(--muted-foreground)]" />
        <p className="text-xs font-semibold text-[var(--foreground)]">No Platforms Connected</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">
          Configure ad platform credentials to see audience data
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {data.platforms.map(p => {
          const label = PLATFORM_LABELS[p.platform] ?? p.platform;
          const color = PLATFORM_COLORS[p.platform] ?? '#737373';

          return (
            <div
              key={p.platform}
              className="rounded-xl border border-[var(--border)] p-3 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs font-semibold text-[var(--foreground)] truncate">
                  {label}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {p.connected ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                    <span className="text-[10px] text-green-600 font-medium">Connected</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
                    <span className="text-[10px] text-[var(--muted-foreground)]">Not configured</span>
                  </>
                )}
              </div>

              {p.has_data && (
                <div className="text-[10px] text-[var(--muted-foreground)] space-y-0.5">
                  <div>{p.row_count.toLocaleString()} rows</div>
                  {p.last_sync && (
                    <div>
                      Synced {new Date(p.last_sync).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
