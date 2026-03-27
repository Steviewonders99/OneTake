"use client";

import { useState, useEffect } from "react";
import { Plus, Inbox } from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import IntakeCard from "@/components/IntakeCard";
import FilterTabs from "@/components/FilterTabs";
import type { IntakeRequest, Status } from "@/lib/types";

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

  return (
    <AppShell>
      <div className="px-6 lg:px-8 py-6 max-w-[1400px] mx-auto">
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
