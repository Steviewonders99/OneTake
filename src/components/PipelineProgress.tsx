"use client";

import { Check, Loader2, XCircle, Circle } from "lucide-react";
import type { PipelineStageStatus } from "@/lib/types";

interface Stage {
  stage: number;
  stage_name: string;
  status: PipelineStageStatus | "pending";
}

const defaultStages: Stage[] = [
  { stage: 1, stage_name: "Creative Brief", status: "pending" },
  { stage: 2, stage_name: "Channel Research", status: "pending" },
  { stage: 3, stage_name: "Actor Profiles", status: "pending" },
  { stage: 4, stage_name: "Image Generation", status: "pending" },
  { stage: 5, stage_name: "Composition", status: "pending" },
];

interface PipelineProgressProps {
  runs?: Array<{
    stage: number;
    stage_name: string;
    status: string;
  }>;
}

function getIcon(status: string) {
  switch (status) {
    case "passed":
      return <Check size={14} className="text-white" />;
    case "running":
      return <Loader2 size={14} className="text-white animate-spin" />;
    case "failed":
      return <XCircle size={14} className="text-white" />;
    case "retrying":
      return <Loader2 size={14} className="text-white animate-spin" />;
    default:
      return <Circle size={14} className="text-[var(--muted-foreground)]" />;
  }
}

function getCircleClass(status: string) {
  switch (status) {
    case "passed":
      return "bg-green-500";
    case "running":
    case "retrying":
      return "bg-blue-500";
    case "failed":
      return "bg-red-500";
    default:
      return "bg-[var(--muted)] border border-[var(--border)]";
  }
}

function getLineClass(status: string) {
  switch (status) {
    case "passed":
      return "bg-green-500";
    case "running":
    case "retrying":
      return "bg-blue-300";
    default:
      return "bg-[var(--border)]";
  }
}

export default function PipelineProgress({ runs }: PipelineProgressProps) {
  const stages: Stage[] = defaultStages.map((s) => {
    const run = runs?.find((r) => r.stage === s.stage);
    return {
      ...s,
      stage_name: run?.stage_name || s.stage_name,
      status: (run?.status as PipelineStageStatus) || "pending",
    };
  });

  return (
    <div className="flex items-center w-full">
      {stages.map((stage, idx) => (
        <div key={stage.stage} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${getCircleClass(stage.status)}`}
            >
              {getIcon(stage.status)}
            </div>
            <span className="text-[10px] font-medium text-[var(--muted-foreground)] mt-1.5 text-center whitespace-nowrap">
              {stage.stage_name}
            </span>
          </div>
          {idx < stages.length - 1 && (
            <div className={`h-0.5 flex-1 mx-1.5 mt-[-18px] ${getLineClass(stage.status)}`} />
          )}
        </div>
      ))}
    </div>
  );
}
