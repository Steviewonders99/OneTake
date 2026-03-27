"use client";

import Link from "next/link";
import { Users, Clock } from "lucide-react";
import { StatusBadge, UrgencyBadge, TaskTypeBadge } from "@/components/StatusBadge";
import type { IntakeRequest } from "@/lib/types";

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function IntakeCard({ request }: { request: IntakeRequest }) {
  return (
    <Link
      href={`/intake/${request.id}`}
      className="card block p-5 cursor-pointer hover:-translate-y-0.5 transition-all duration-150"
    >
      {/* Top: task type + title */}
      <div className="flex items-start gap-3 mb-3">
        <TaskTypeBadge taskType={request.task_type} />
        <h3 className="text-sm font-semibold text-[var(--foreground)] leading-tight flex-1 min-w-0 truncate">
          {request.title}
        </h3>
      </div>

      {/* Middle: badges */}
      <div className="flex items-center gap-2 mb-3">
        <UrgencyBadge urgency={request.urgency} />
        <StatusBadge status={request.status} />
      </div>

      {/* Bottom: languages, volume, date */}
      <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {request.target_languages.length > 0 && (
            <div className="flex gap-1 overflow-hidden">
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
          {request.volume_needed && (
            <span className="flex items-center gap-1 shrink-0">
              <Users size={11} />
              {request.volume_needed.toLocaleString()}
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 shrink-0 ml-2">
          <Clock size={11} />
          {timeAgo(request.created_at)}
        </span>
      </div>
    </Link>
  );
}
