"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Star } from "lucide-react";

interface EvaluationScoresProps {
  scores: Record<string, number>;
  overall?: number;
}

export default function EvaluationScores({ scores, overall }: EvaluationScoresProps) {
  const [expanded, setExpanded] = useState(false);
  const overallScore = overall ?? scores.overall ?? 0;
  const dimensions = Object.entries(scores).filter(([k]) => k !== "overall");

  return (
    <div className="space-y-3">
      {/* Overall score */}
      <div className="flex items-center gap-3 p-3 bg-[var(--muted)] rounded-[var(--radius-sm)]">
        <Star size={20} className="text-[#ca8a04]" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">Overall Score</p>
          <p className="text-xs text-[var(--muted-foreground)]">Composite quality rating</p>
        </div>
        <span className="text-2xl font-bold text-[var(--foreground)]">
          {(overallScore * 100).toFixed(0)}%
        </span>
      </div>

      {/* Expandable dimensions */}
      {dimensions.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? "Hide" : "Show"} {dimensions.length} dimensions
          </button>

          {expanded && (
            <div className="space-y-2.5">
              {dimensions.map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--foreground)] capitalize">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {(value * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full gradient-accent transition-all duration-500"
                      style={{ width: `${value * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
