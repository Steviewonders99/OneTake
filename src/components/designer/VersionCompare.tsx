"use client";

import { useState, useRef, useCallback } from "react";
import { ImageIcon } from "lucide-react";

interface VersionCompareProps {
  originalUrl: string;
  refinedUrl: string;
  originalLabel?: string;
  refinedLabel?: string;
  fileName?: string;
}

export default function VersionCompare({
  originalUrl,
  refinedUrl,
  originalLabel = "AI Generated",
  refinedLabel = "Designer Refined",
  fileName,
}: VersionCompareProps) {
  const [sliderPos, setSliderPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPos(pct);
    },
    []
  );

  function handlePointerDown(e: React.PointerEvent) {
    setDragging(true);
    handleMove(e.clientX);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    handleMove(e.clientX);
  }

  function handlePointerUp() {
    setDragging(false);
  }

  return (
    <div className="space-y-2">
      {fileName && (
        <p className="text-xs text-[var(--muted-foreground)] font-medium">{fileName}</p>
      )}
      <div
        ref={containerRef}
        className="relative w-full aspect-square rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)] cursor-col-resize select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Refined (full background) */}
        {refinedUrl ? (
          <img
            src={refinedUrl}
            alt={refinedLabel}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 bg-[var(--muted)] flex items-center justify-center">
            <ImageIcon size={32} className="text-[var(--muted-foreground)] opacity-30" />
          </div>
        )}

        {/* Original (clipped to left portion) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
          {originalUrl ? (
            <img
              src={originalUrl}
              alt={originalLabel}
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 bg-[var(--muted)] flex items-center justify-center">
              <ImageIcon size={32} className="text-[var(--muted-foreground)] opacity-30" />
            </div>
          )}
        </div>

        {/* Slider line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md z-10"
          style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
        >
          {/* Handle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg border-2 border-[var(--border)] flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 2L1 6L3 10" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 2L11 6L9 10" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Labels */}
        <div className="absolute bottom-3 left-3 z-10">
          <span className="text-[12px] font-semibold text-white bg-black/60 px-2 py-0.5 rounded-full">
            {originalLabel}
          </span>
        </div>
        <div className="absolute bottom-3 right-3 z-10">
          <span className="text-[12px] font-semibold text-white bg-black/60 px-2 py-0.5 rounded-full">
            {refinedLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
