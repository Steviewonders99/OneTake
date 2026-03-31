"use client";

import { useState, useMemo } from "react";
import { Search, Globe, Filter } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import type { IntakeRequest, Status } from "@/lib/types";

const FILTER_TABS: { label: string; value: Status | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Generating", value: "generating" },
  { label: "Review", value: "review" },
  { label: "Approved", value: "approved" },
  { label: "Sent", value: "sent" },
];

function ProgressBar({ status }: { status: Status }) {
  if (status !== "generating") return null;
  return (
    <div className="mt-2 h-1 w-full rounded-full bg-[#eff6ff] overflow-hidden">
      <div
        className="h-full rounded-full bg-[#2563eb]"
        style={{
          width: "60%",
          animation: "pulse-badge 2s ease-in-out infinite",
        }}
      />
    </div>
  );
}

interface CampaignCardProps {
  request: IntakeRequest;
  selected: boolean;
  onSelect: (id: string) => void;
}

function CampaignCard({ request, selected, onSelect }: CampaignCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(request.id)}
      className={[
        "w-full text-left p-4 rounded-xl border transition-all duration-150 cursor-pointer",
        selected
          ? "border-[#2563eb] bg-[#eff6ff] shadow-sm"
          : "border-[#e5e5e5] bg-white hover:border-[#d4d4d4] hover:shadow-sm",
      ].join(" ")}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-[#1a1a1a] leading-tight truncate flex-1 min-w-0">
          {request.title}
        </p>
        <StatusBadge status={request.status} />
      </div>

      {/* Languages */}
      {request.target_languages.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mb-1">
          <Globe size={11} className="text-[#737373] shrink-0" />
          {request.target_languages.slice(0, 3).map((lang) => (
            <span key={lang} className="tag-pill">
              {lang}
            </span>
          ))}
          {request.target_languages.length > 3 && (
            <span className="tag-pill">+{request.target_languages.length - 3}</span>
          )}
        </div>
      )}

      {/* Progress bar for generating status */}
      <ProgressBar status={request.status} />
    </button>
  );
}

interface CampaignListProps {
  requests: IntakeRequest[];
  loading?: boolean;
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export default function CampaignList({
  requests,
  loading = false,
  selectedId,
  onSelect,
}: CampaignListProps) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<Status | "all">("all");

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: requests.length };
    for (const r of requests) {
      map[r.status] = (map[r.status] ?? 0) + 1;
    }
    return map;
  }, [requests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      const matchesSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.task_type.toLowerCase().includes(q);
      const matchesFilter =
        activeFilter === "all" || r.status === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [requests, search, activeFilter]);

  const totalCountries = useMemo(() => {
    const regions = new Set<string>();
    for (const r of requests) {
      for (const region of r.target_regions) {
        regions.add(region);
      }
    }
    return regions.size;
  }, [requests]);

  return (
    <div className="flex flex-col h-full bg-white border-r border-[#e5e5e5]">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-[#e5e5e5]">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-[#737373]" />
          <h2 className="text-sm font-semibold text-[#1a1a1a]">Campaigns</h2>
          <span className="ml-auto badge badge-draft">{requests.length}</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373] pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-8 py-2 text-sm"
          />
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 px-4 py-3 overflow-x-auto border-b border-[#e5e5e5] shrink-0">
        {FILTER_TABS.map((tab) => {
          const count = counts[tab.value] ?? 0;
          const active = activeFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveFilter(tab.value)}
              className={[
                "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer border",
                active
                  ? "bg-[#32373c] text-white border-[#32373c]"
                  : "bg-white text-[#737373] border-[#e5e5e5] hover:border-[#d4d4d4] hover:text-[#1a1a1a]",
              ].join(" ")}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={[
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                    active ? "bg-white/20 text-white" : "bg-[#f5f5f5] text-[#737373]",
                  ].join(" ")}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Campaign list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search size={24} className="text-[#e5e5e5] mb-3" />
            <p className="text-sm text-[#737373]">
              {search ? "No campaigns match your search" : "No campaigns yet"}
            </p>
          </div>
        ) : (
          filtered.map((request) => (
            <CampaignCard
              key={request.id}
              request={request}
              selected={request.id === selectedId}
              onSelect={onSelect ?? (() => {})}
            />
          ))
        )}
      </div>

      {/* Stats bar */}
      <div className="px-4 py-3 border-t border-[#e5e5e5] bg-[#fafafa] shrink-0">
        <div className="flex items-center justify-between text-xs text-[#737373]">
          <span>
            <span className="font-semibold text-[#1a1a1a]">{requests.length}</span>{" "}
            campaign{requests.length !== 1 ? "s" : ""}
          </span>
          {totalCountries > 0 && (
            <span className="flex items-center gap-1">
              <Globe size={11} />
              <span className="font-semibold text-[#1a1a1a]">{totalCountries}</span>{" "}
              {totalCountries !== 1 ? "countries" : "country"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
