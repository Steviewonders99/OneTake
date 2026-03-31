"use client";

import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

export interface PipelineStage {
  key: string;
  label: string;
  status: "pending" | "running" | "passed" | "failed" | "retrying";
}

interface PipelineNavProps {
  stages: PipelineStage[];
  activeSection?: string;
  onNavigate?: (key: string) => void;
}

const shimmerVariants: Variants = {
  initial: {
    backgroundPosition: "0% 0",
  },
  animate: {
    backgroundPosition: "200% 0",
    transition: {
      duration: 2,
      repeat: Infinity,
      repeatType: "reverse",
      ease: "linear",
    },
  },
};

function NavLabel({
  label,
  status,
  isActive,
}: {
  label: string;
  status: PipelineStage["status"];
  isActive: boolean;
}) {
  const isReady = status === "passed" || status === "failed";
  const isLoading = status === "running" || status === "retrying";

  // Ready: solid black text
  if (isReady) {
    return (
      <span
        className={cn(
          "text-[13px] font-medium transition-colors",
          isActive ? "text-[var(--foreground)]" : "text-[var(--foreground)]"
        )}
      >
        {label}
      </span>
    );
  }

  // Loading: animated gradient shimmer
  if (isLoading) {
    return (
      <motion.span
        className="text-[13px] font-medium"
        style={{
          background: "linear-gradient(90deg, #a1a1aa, #d4d4d8, #a1a1aa)",
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
        variants={shimmerVariants}
        initial="initial"
        animate="animate"
      >
        {label}
      </motion.span>
    );
  }

  // Pending: light gray
  return (
    <span className="text-[13px] font-medium text-[#d4d4d8]">
      {label}
    </span>
  );
}

export default function PipelineNav({
  stages,
  activeSection,
  onNavigate,
}: PipelineNavProps) {
  return (
    <div className="sticky top-0 z-30 bg-white border-b border-[var(--border)]">
      <div className="flex items-center gap-0 max-w-4xl mx-auto">
        {stages.map((stage, i) => {
          const isActive = activeSection === stage.key;
          const isReady = stage.status === "passed" || stage.status === "failed";

          return (
            <div key={stage.key} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => onNavigate?.(stage.key)}
                disabled={stage.status === "pending"}
                className={cn(
                  "relative px-4 py-3 cursor-pointer transition-all",
                  stage.status === "pending" && "cursor-default",
                  isActive && isReady && "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[var(--foreground)]"
                )}
              >
                <NavLabel
                  label={stage.label}
                  status={stage.status}
                  isActive={isActive}
                />
              </button>

              {/* Connector dot */}
              {i < stages.length - 1 && (
                <div
                  className={cn(
                    "w-1 h-1 rounded-full mx-1 flex-shrink-0",
                    isReady ? "bg-[var(--foreground)]" : "bg-[#e5e5e5]"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
