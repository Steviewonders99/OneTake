"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Palette,
  Image as ImageIcon,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Search,
  Clock,
} from "lucide-react";
import type { IntakeRequest } from "@/lib/types";

// ── Status helpers ─────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  draft: "badge-draft",
  generating: "badge-generating",
  review: "badge-review",
  approved: "badge-approved",
  sent: "badge-sent",
  rejected: "badge-urgent",
};

function statusBadge(status: string) {
  return STATUS_STYLE[status] ?? "badge-draft";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Component ──────────────────────────────────────────────────

export default function DesignerCampaignList() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<IntakeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/intake");
        if (!res.ok) throw new Error("Failed to load campaigns");
        const data: IntakeRequest[] = await res.json();
        // Only show campaigns that have progressed past draft
        setCampaigns(data.filter((c) => c.status !== "draft"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = campaigns.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.task_type.toLowerCase().includes(search.toLowerCase())
  );

  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 size={28} className="text-[var(--muted-foreground)] animate-spin mb-3" />
        <p className="text-sm text-[var(--muted-foreground)]">Loading campaigns...</p>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AlertCircle size={28} className="text-[var(--muted-foreground)] mb-3" />
        <p className="text-sm text-[var(--foreground)] font-medium mb-1">Unable to load</p>
        <p className="text-sm text-[var(--muted-foreground)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-12 xl:px-16 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">My Campaigns</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Review and refine generated assets for each campaign
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Palette size={16} />
          <span>{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
        />
        <input
          type="text"
          placeholder="Search campaigns..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm rounded-[10px] border border-[var(--border)] bg-white text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--oneforma-charcoal)]/20"
        />
      </div>

      {/* Campaign grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((campaign) => (
            <button
              key={campaign.id}
              onClick={() => router.push(`/designer/${campaign.id}`)}
              className="card p-5 text-left hover:shadow-md transition-shadow cursor-pointer group"
            >
              {/* Top row: status + urgency */}
              <div className="flex items-center justify-between mb-3">
                <span className={`badge ${statusBadge(campaign.status)}`}>
                  {campaign.status}
                </span>
                {campaign.urgency === "urgent" && (
                  <span className="badge badge-urgent">Urgent</span>
                )}
              </div>

              {/* Title */}
              <h3 className="text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--oneforma-charcoal)] transition-colors mb-1 line-clamp-2">
                {campaign.title}
              </h3>

              {/* Meta */}
              <p className="text-xs text-[var(--muted-foreground)] mb-4">
                {campaign.task_type.replace(/_/g, " ")}
                {campaign.target_regions.length > 0 &&
                  ` \u00b7 ${campaign.target_regions.slice(0, 2).join(", ")}`}
              </p>

              {/* Footer stats */}
              <div className="flex items-center gap-4 pt-3 border-t border-[var(--border)]">
                <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                  <ImageIcon size={14} />
                  <span>
                    {campaign.target_languages.length} language{campaign.target_languages.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                  <Clock size={14} />
                  <span>{formatDate(campaign.created_at)}</span>
                </div>
                {campaign.status === "approved" && (
                  <div className="flex items-center gap-1 text-xs text-green-600 ml-auto">
                    <CheckCircle2 size={14} />
                    <span>Approved</span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Palette size={36} className="mx-auto text-[var(--muted-foreground)] mb-3 opacity-40" />
          <p className="text-sm text-[var(--muted-foreground)]">
            {search ? "No campaigns match your search" : "No campaigns assigned yet"}
          </p>
        </div>
      )}
    </div>
  );
}
