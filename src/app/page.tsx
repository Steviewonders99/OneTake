"use client";

import { useState, useEffect } from "react";
import { Plus, Inbox } from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import IntakeCard from "@/components/IntakeCard";
import FilterTabs from "@/components/FilterTabs";
import CampaignList from "@/components/CampaignList";
import CampaignPreviewPanel from "@/components/CampaignPreviewPanel";
import type { IntakeRequest, Status, UserRole } from "@/lib/types";

const statusTabs: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "generating", label: "Generating" },
  { value: "review", label: "Review" },
  { value: "approved", label: "Approved" },
  { value: "sent", label: "Sent" },
];

function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex gap-3">
        <div className="skeleton w-24 h-5 rounded-full" />
        <div className="skeleton flex-1 h-5" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton w-16 h-5 rounded-full" />
        <div className="skeleton w-16 h-5 rounded-full" />
      </div>
      <div className="flex justify-between">
        <div className="skeleton w-32 h-4" />
        <div className="skeleton w-16 h-4" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [requests, setRequests] = useState<IntakeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [role, setRole] = useState<UserRole | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.role) setRole(data.role as UserRole); })
      .catch(() => {});

    // Auto-collapse sidebar on dashboard for more content space
    localStorage.setItem("nova-sidebar-collapsed", "true");
  }, []);

  useEffect(() => {
    async function loadRequests() {
      try {
        setLoading(true);
        const url =
          statusFilter === "all"
            ? "/api/intake"
            : `/api/intake?status=${statusFilter}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load requests");
        const data = await res.json();
        setRequests(data);

        // Auto-select the most recent generating or generated campaign
        if (!selectedId && data.length > 0) {
          const generating = data.find((r: IntakeRequest) => r.status === "generating");
          const review = data.find((r: IntakeRequest) => r.status === "review");
          const latest = generating || review || data[0];
          if (latest) setSelectedId(latest.id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    loadRequests();
  }, [statusFilter]);

  const tabsWithCounts = statusTabs.map((tab) => ({
    ...tab,
    count:
      tab.value === "all"
        ? requests.length
        : requests.filter((r) => r.status === tab.value).length,
  }));

  const filtered =
    statusFilter === "all"
      ? requests
      : requests.filter((r) => r.status === (statusFilter as Status));

  // Admin: two-panel Marketing Command Center
  if (role === "admin") {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-64px)]">
          {/* Left: campaign list */}
          <div className="w-[340px] flex-shrink-0">
            <CampaignList
              requests={requests}
              loading={loading}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
          {/* Right: preview panel */}
          <div className="flex-1 overflow-y-auto bg-white">
            {selectedId ? (
              <CampaignPreviewPanel requestId={selectedId} />
            ) : (
              <div className="flex items-center justify-center h-full text-[#737373] text-sm">
                Select a campaign to preview
              </div>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  // Recruiter / viewer / loading role: card grid
  return (
    <AppShell>
      <div className="px-6 md:px-10 lg:px-12 xl:px-16 py-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-[var(--foreground)]">Pipeline</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
              Manage recruitment intake requests
            </p>
          </div>
          <Link href="/intake/new" className="btn-primary cursor-pointer">
            <Plus size={16} />
            New Request
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="mb-6">
          <FilterTabs
            tabs={tabsWithCounts}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>

        {/* Error state */}
        {error && (
          <div className="text-center py-16">
            <p className="text-sm text-[var(--muted-foreground)] mb-4">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setStatusFilter(statusFilter);
              }}
              className="btn-secondary cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--muted)] flex items-center justify-center mb-4 border border-[var(--border)]">
              <Inbox size={28} className="text-[var(--muted-foreground)]" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              No requests yet
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-6 max-w-sm">
              Create your first intake request to start the AI-powered recruitment pipeline.
            </p>
            <Link href="/intake/new" className="btn-primary cursor-pointer">
              <Plus size={16} />
              Create First Request
            </Link>
          </div>
        )}

        {/* Grid */}
        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((request) => (
              <IntakeCard key={request.id} request={request} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
