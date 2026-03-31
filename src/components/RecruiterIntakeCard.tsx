"use client";

import Link from "next/link";
import { Layers } from "lucide-react";
import { getRecruiterStatus } from "@/lib/format";
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

interface RecruiterIntakeCardProps {
  request: IntakeRequest;
  assetCounts?: { images: number; creatives: number; videos: number };
  thumbnails?: string[];
}

export default function RecruiterIntakeCard({
  request,
  assetCounts,
  thumbnails,
}: RecruiterIntakeCardProps) {
  const status = getRecruiterStatus(request.status);
  const isReady = request.status === "approved" || request.status === "sent";
  const totalAssets = assetCounts
    ? assetCounts.images + assetCounts.creatives + assetCounts.videos
    : 0;

  return (
    <Link
      href={`/intake/${request.id}`}
      className="block bg-white border border-[var(--border)] rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-all duration-150"
      style={{ borderLeft: `3px solid ${status.borderColor}` }}
    >
      <div className="p-5">
        <div className="mb-2">
          <h3 className="text-[14px] font-semibold text-[var(--foreground)] leading-snug">
            {request.title}
          </h3>
          <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
            {request.task_type.replace(/_/g, " ")}
            {request.target_regions?.length > 0 &&
              ` · ${request.target_regions.join(", ")}`}
            {request.target_languages?.length > 0 &&
              ` · ${request.target_languages.slice(0, 3).join(", ")}${
                request.target_languages.length > 3
                  ? ` +${request.target_languages.length - 3}`
                  : ""
              }`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span
            className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ backgroundColor: status.bgColor, color: status.color }}
          >
            {status.label}
          </span>
          {isReady && totalAssets > 0 && (
            <span className="text-[11px] text-[var(--muted-foreground)]">
              {[
                assetCounts!.creatives > 0 && `${assetCounts!.creatives} creatives`,
                assetCounts!.images > 0 && `${assetCounts!.images} images`,
                assetCounts!.videos > 0 && `${assetCounts!.videos} videos`,
              ].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>

        <div className="flex items-end justify-between gap-3">
          <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed flex-1">
            {status.description}
          </p>

          {isReady && thumbnails && thumbnails.length > 0 && (
            <div className="flex gap-1 shrink-0">
              {thumbnails.slice(0, 3).map((url, i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--muted)] border border-[var(--border)]"
                >
                  <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
              {totalAssets > 3 && (
                <div className="w-10 h-10 rounded-lg bg-[var(--muted)] border border-[var(--border)] flex items-center justify-center">
                  <span className="text-[10px] text-[var(--muted-foreground)] font-medium">
                    +{totalAssets - 3}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
          <span className="text-[10px] text-[var(--muted-foreground)]">
            {timeAgo(request.created_at)}
          </span>
          {isReady && (
            <span className="text-[10px] font-medium" style={{ color: status.color }}>
              View package →
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
