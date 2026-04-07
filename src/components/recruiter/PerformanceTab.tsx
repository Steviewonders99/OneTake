"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Copy, ExternalLink, Trophy, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import type {
  TrackedLinkWithAsset,
  TrackedLinksSummary,
  TrackedLinksResponse,
} from "@/lib/types";

interface PerformanceTabProps {
  requestId: string;
}

const CHANNEL_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  reddit: "Reddit",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function PerformanceTab({ requestId }: PerformanceTabProps) {
  const [data, setData] = useState<TrackedLinksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/tracked-links?request_id=${requestId}`);
      if (res.ok) {
        const json = (await res.json()) as TrackedLinksResponse;
        setData(json);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const filteredLinks = useMemo(() => {
    if (!data) return [];
    if (channelFilter === "all") return data.links;
    return data.links.filter((l) => l.utm_source === channelFilter);
  }, [data, channelFilter]);

  const channels = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.links.map((l) => l.utm_source))].sort();
  }, [data]);

  if (loading) {
    return (
      <div className="px-4 md:px-6 py-12 max-w-[1100px] mx-auto text-center text-sm text-[var(--muted-foreground)]">
        Loading tracked links…
      </div>
    );
  }

  if (!data || data.links.length === 0) {
    return (
      <div className="px-4 md:px-6 py-16 max-w-[1100px] mx-auto text-center">
        <BarChart3 size={40} className="mx-auto text-[var(--muted-foreground)] mb-4" />
        <h2 className="text-base font-semibold text-[var(--foreground)] mb-2">No tracked links yet</h2>
        <p className="text-sm text-[var(--muted-foreground)] max-w-sm mx-auto">
          Go to the Creatives tab, click a creative, and hit Copy Link. Your click counts will start showing up here.
        </p>
      </div>
    );
  }

  const { summary } = data;
  const topLinkId = filteredLinks[0]?.id;

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Short link copied!");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1100px] mx-auto">
      <StatsStrip summary={summary} />

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Your tracked links</h2>
        <span className="text-xs text-[var(--muted-foreground)]">
          {filteredLinks.length} of {data.links.length}
        </span>
        <div className="flex-1" />
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-md border border-[var(--border)] bg-white cursor-pointer"
        >
          <option value="all">All channels</option>
          {channels.map((ch) => (
            <option key={ch} value={ch}>
              {CHANNEL_LABEL[ch] ?? ch}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        {filteredLinks.map((link, i) => (
          <LinkRow
            key={link.id}
            link={link}
            isTop={link.id === topLinkId && link.click_count > 0}
            showBorder={i > 0}
            onCopy={copyLink}
          />
        ))}
      </div>

      <p className="text-[10px] text-[var(--muted-foreground)] text-center mt-4">
        Updates every 30 seconds · Click counts include all redirects since creation
      </p>
    </div>
  );
}

function StatsStrip({ summary }: { summary: TrackedLinksSummary }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div
        className="rounded-xl p-4 border border-[var(--border)]"
        style={{ background: "linear-gradient(135deg, #f0f9ff 0%, #faf5ff 100%)" }}
      >
        <div className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold mb-1">
          Total Clicks
        </div>
        <div className="text-3xl font-extrabold text-[#0693e3]">{summary.total_clicks}</div>
      </div>
      <div className="rounded-xl p-4 border border-[var(--border)] bg-white">
        <div className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold mb-1">
          Your Links
        </div>
        <div className="text-3xl font-extrabold text-[var(--foreground)]">{summary.total_links}</div>
      </div>
      <div className="rounded-xl p-4 border border-[var(--border)] bg-white">
        <div className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold mb-1">
          Best Channel
        </div>
        {summary.best_channel ? (
          <>
            <div className="text-base font-bold text-[var(--foreground)]">
              {CHANNEL_LABEL[summary.best_channel.name] ?? summary.best_channel.name}
            </div>
            <div className="text-[10px] text-[var(--muted-foreground)]">
              {summary.best_channel.clicks} clicks · {summary.best_channel.pct}%
            </div>
          </>
        ) : (
          <div className="text-xs text-[var(--muted-foreground)]">—</div>
        )}
      </div>
      <div className="rounded-xl p-4 border border-[var(--border)] bg-white">
        <div className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold mb-1">
          Top Platform
        </div>
        {summary.top_creative ? (
          <>
            <div className="text-base font-bold text-[var(--foreground)] truncate">
              {summary.top_creative.name}
            </div>
            <div className="text-[10px] text-[var(--muted-foreground)]">
              {summary.top_creative.clicks} clicks
            </div>
          </>
        ) : (
          <div className="text-xs text-[var(--muted-foreground)]">—</div>
        )}
      </div>
    </div>
  );
}

function LinkRow({
  link,
  isTop,
  showBorder,
  onCopy,
}: {
  link: TrackedLinkWithAsset;
  isTop: boolean;
  showBorder: boolean;
  onCopy: (url: string) => void;
}) {
  const channelLabel = CHANNEL_LABEL[link.utm_source] ?? link.utm_source;
  return (
    <div
      className={[
        "grid grid-cols-[40px_1fr_auto_auto_auto] gap-3 items-center px-4 py-3",
        showBorder ? "border-t border-[var(--border)]" : "",
        isTop ? "bg-yellow-50" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="w-10 h-10 bg-[var(--muted)] rounded-lg overflow-hidden relative shrink-0">
        {link.asset_thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={link.asset_thumbnail}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[9px] text-[var(--muted-foreground)]">
            —
          </div>
        )}
        {isTop && (
          <div className="absolute -top-1 -right-1" title="Top performer">
            <Trophy size={14} className="text-amber-500" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-mono font-semibold text-[var(--foreground)] truncate">
          {link.short_url.replace(/^https?:\/\//, "")}
        </div>
        <div className="text-[10px] text-[var(--muted-foreground)] truncate">
          {channelLabel} · {link.utm_content} · {link.utm_term} · {timeAgo(link.created_at)}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div
          className={`text-xl font-extrabold ${
            link.click_count === 0 ? "text-[var(--muted-foreground)]" : "text-green-600"
          }`}
        >
          {link.click_count}
        </div>
        <div className="text-[9px] text-[var(--muted-foreground)]">clicks</div>
      </div>
      <button
        onClick={() => onCopy(link.short_url)}
        className="p-2 rounded-md border border-[var(--border)] hover:bg-[var(--muted)] cursor-pointer"
        title="Copy short URL"
      >
        <Copy size={13} />
      </button>
      <a
        href={link.short_url}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 rounded-md border border-[var(--border)] hover:bg-[var(--muted)] cursor-pointer"
        title="Open in new tab"
      >
        <ExternalLink size={13} />
      </a>
    </div>
  );
}
