'use client';

import { ReactNode, useState } from 'react';
import { Download, RefreshCw, MessageSquare, Check, Square, CheckSquare, ImageIcon } from 'lucide-react';
import ImageLoader from '@/components/ui/image-loading';

interface BadgeItem {
  label: string;
  color: string;
}

interface AssetCardProps {
  imageUrl: string;
  title: string;
  subtitle: string;
  badges: BadgeItem[];
  selected: boolean;
  onSelect: () => void;
  onDownload: () => void;
  onRetry: () => void;
  onRefine: () => void;
  customPreview?: ReactNode;
}

function badgeColorClasses(color: string): string {
  switch (color) {
    case 'green':
      return 'bg-green-50 text-green-700';
    case 'yellow':
      return 'bg-yellow-50 text-yellow-700';
    case 'red':
      return 'bg-red-50 text-red-700';
    case 'blue':
      return 'bg-blue-50 text-blue-700';
    default:
      return 'bg-[var(--muted)] text-[var(--muted-foreground)]';
  }
}

export default function AssetCard({
  imageUrl,
  title,
  subtitle,
  badges,
  selected,
  onSelect,
  onDownload,
  onRetry,
  onRefine,
  customPreview,
}: AssetCardProps) {
  // Filter out badges with empty labels
  const visibleBadges = badges.filter((b) => b.label);

  return (
    <div
      className="card group relative overflow-hidden cursor-pointer"
      style={{
        transition: 'transform 150ms ease, box-shadow 150ms ease',
        outline: selected ? '2px solid #3b82f6' : 'none',
        outlineOffset: selected ? '-2px' : '0',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Selected checkmark overlay */}
      {selected && (
        <div className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
          <Check size={14} className="text-white" />
        </div>
      )}

      {/* Image / Preview area */}
      <div className="relative bg-[var(--muted)] aspect-square flex items-center justify-center overflow-hidden rounded-t-xl">
        {customPreview ? (
          customPreview
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <ImageIcon size={32} className="text-[var(--muted-foreground)] opacity-30" />
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        {/* Title + score row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium text-[var(--foreground)] truncate">
            {title}
          </h3>
          {/* Show score badge right-aligned if present */}
          {visibleBadges.length > 0 && visibleBadges[visibleBadges.length - 1].label.includes('%') && (
            <span
              className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgeColorClasses(
                visibleBadges[visibleBadges.length - 1].color
              )}`}
            >
              {visibleBadges[visibleBadges.length - 1].label}
            </span>
          )}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-xs text-[var(--muted-foreground)] truncate">
            {subtitle}
          </p>
        )}

        {/* Badge row */}
        {visibleBadges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {visibleBadges.map((badge, i) => {
              // Skip score badge since it's shown in the title row
              if (badge.label.includes('%')) return null;
              return (
                <span
                  key={i}
                  className={`tag-pill ${badgeColorClasses(badge.color)}`}
                >
                  {badge.label}
                </span>
              );
            })}
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-1 pt-1 border-t border-[var(--border)]">
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className="p-1.5 rounded-lg hover:bg-[var(--muted)] cursor-pointer transition-colors"
            title={selected ? 'Deselect' : 'Select'}
          >
            {selected ? (
              <CheckSquare size={16} className="text-blue-500" />
            ) : (
              <Square size={16} className="text-[var(--muted-foreground)]" />
            )}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(); }}
            className="p-1.5 rounded-lg hover:bg-[var(--muted)] cursor-pointer transition-colors"
            title="Download"
          >
            <Download size={16} className="text-[var(--muted-foreground)]" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRetry(); }}
            className="p-1.5 rounded-lg hover:bg-[var(--muted)] cursor-pointer transition-colors"
            title="Retry"
          >
            <RefreshCw size={16} className="text-[var(--muted-foreground)]" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRefine(); }}
            className="p-1.5 rounded-lg hover:bg-[var(--muted)] cursor-pointer transition-colors"
            title="Refine"
          >
            <MessageSquare size={16} className="text-[var(--muted-foreground)]" />
          </button>
        </div>
      </div>
    </div>
  );
}
