import { CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";

type ConfidenceLevel = "extracted" | "inferred" | "missing" | "none";

interface ConfidenceIndicatorProps {
  level: ConfidenceLevel;
  children: React.ReactNode;
}

const config: Record<
  Exclude<ConfidenceLevel, "none">,
  {
    borderClass: string;
    label: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
  }
> = {
  extracted: {
    borderClass: "confidence-extracted",
    label: "Extracted from RFP",
    Icon: CheckCircle2,
    color: "text-green-600",
  },
  inferred: {
    borderClass: "confidence-inferred",
    label: "AI-inferred",
    Icon: AlertTriangle,
    color: "text-yellow-600",
  },
  missing: {
    borderClass: "confidence-missing",
    label: "Missing - please fill",
    Icon: AlertCircle,
    color: "text-red-600",
  },
};

export default function ConfidenceIndicator({
  level,
  children,
}: ConfidenceIndicatorProps) {
  if (level === "none") {
    return <>{children}</>;
  }

  const c = config[level];

  return (
    <div className="relative">
      <div className={c.borderClass}>{children}</div>
      <div className={`flex items-center gap-1 mt-1 text-xs ${c.color}`}>
        <c.Icon size={12} />
        {c.label}
      </div>
    </div>
  );
}
