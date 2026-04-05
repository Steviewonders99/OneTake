'use client';

import { useState, useEffect, useCallback } from 'react';
import FilterTabs from '@/components/FilterTabs';

interface ComputeJobRow {
  id: string;
  request_id: string;
  job_type: string;
  status: string;
  stage_target: number | null;
  asset_id: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  request_title: string | null;
}

const statusTabs = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'complete', label: 'Complete' },
  { value: 'failed', label: 'Failed' },
];

const jobStatusColors: Record<string, string> = {
  pending: 'badge-draft',
  processing: 'badge-generating',
  complete: 'badge-approved',
  failed: 'badge-rejected',
};

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '--';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export default function PipelinePage() {
  const [jobs, setJobs] = useState<ComputeJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchJobs = useCallback(async () => {
    try {
      const url = statusFilter === 'all'
        ? '/api/admin/jobs'
        : `/api/admin/jobs?status=${statusFilter}`;
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 403) throw new Error('You do not have admin access.');
        throw new Error('Failed to load jobs');
      }
      setJobs(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchJobs();
  }, [fetchJobs]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const hasProcessing = jobs.some((j) => j.status === 'processing');
  const hasPending = jobs.some((j) => j.status === 'pending');
  const nothingActive = !hasProcessing && !hasPending;

  const tabsWithCounts = statusTabs.map((tab) => ({
    ...tab,
    count: tab.value === 'all'
      ? jobs.length
      : jobs.filter((j) => j.status === tab.value).length,
  }));

  return (
    <div className="px-6 md:px-10 lg:px-12 xl:px-16 py-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Worker Monitor</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Compute job pipeline status (auto-refreshes every 10s)
          </p>
        </div>
        {/* Worker status indicator */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              hasProcessing
                ? 'bg-[#2563eb] animate-pulse'
                : nothingActive
                  ? 'bg-[#ca8a04]'
                  : 'bg-[#16a34a]'
            }`}
          />
          <span className="text-sm font-medium text-[var(--foreground)]">
            {hasProcessing
              ? 'Worker Running'
              : nothingActive
                ? 'Worker Idle (jobs waiting)'
                : 'All Clear'}
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-6">
        <FilterTabs tabs={tabsWithCounts} value={statusFilter} onChange={setStatusFilter} />
      </div>

      {/* Error */}
      {error && (
        <div className="card p-5 mb-6 border-[var(--oneforma-error)]">
          <p className="text-sm text-[var(--oneforma-error)]">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-4 flex gap-4">
              <div className="skeleton flex-1 h-5" />
              <div className="skeleton w-20 h-5" />
              <div className="skeleton w-16 h-5" />
            </div>
          ))}
        </div>
      )}

      {/* Jobs table */}
      {!loading && !error && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">Request</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">Job Type</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">Started</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">Completed</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">Duration</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">Error</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[var(--muted-foreground)]">
                      No compute jobs found.
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3 px-4 font-medium text-[var(--foreground)] max-w-[200px] truncate">
                        {job.request_title ?? job.request_id.slice(0, 8)}
                      </td>
                      <td className="py-3 px-4 text-[var(--muted-foreground)]">
                        <span className="tag-pill">{job.job_type}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`badge ${jobStatusColors[job.status] ?? 'badge-draft'}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[var(--muted-foreground)] text-xs">
                        {job.started_at
                          ? new Date(job.started_at).toLocaleString()
                          : '--'}
                      </td>
                      <td className="py-3 px-4 text-[var(--muted-foreground)] text-xs">
                        {job.completed_at
                          ? new Date(job.completed_at).toLocaleString()
                          : '--'}
                      </td>
                      <td className="py-3 px-4 text-[var(--muted-foreground)] font-mono text-xs">
                        {formatDuration(job.started_at, job.completed_at)}
                      </td>
                      <td className="py-3 px-4 max-w-[200px]">
                        {job.error_message ? (
                          <span
                            className="text-xs text-[var(--oneforma-error)] truncate block"
                            title={job.error_message}
                          >
                            {job.error_message}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--muted-foreground)]">--</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
