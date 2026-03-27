import {
  FileText,
  Loader2,
  Eye,
  CheckCircle2,
  Send,
  Flame,
  Clock,
  Repeat,
  XCircle,
  Headphones,
  Image,
  Languages,
  Video,
  Search,
  MessageSquare,
  Bot,
  Shield,
} from "lucide-react";
import type { Status, Urgency } from "@/lib/types";

const statusConfig: Record<
  Status,
  { label: string; className: string; Icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  draft: {
    label: "Draft",
    className: "badge badge-draft",
    Icon: FileText,
  },
  generating: {
    label: "Generating",
    className: "badge badge-generating",
    Icon: Loader2,
  },
  review: {
    label: "Review",
    className: "badge badge-review",
    Icon: Eye,
  },
  approved: {
    label: "Approved",
    className: "badge badge-approved",
    Icon: CheckCircle2,
  },
  sent: {
    label: "Sent",
    className: "badge badge-sent",
    Icon: Send,
  },
  rejected: {
    label: "Rejected",
    className: "badge badge-rejected",
    Icon: XCircle,
  },
};

const urgencyConfig: Record<
  Urgency,
  { label: string; className: string; Icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  urgent: {
    label: "Urgent",
    className: "badge badge-urgent",
    Icon: Flame,
  },
  standard: {
    label: "Standard",
    className: "badge badge-draft",
    Icon: Clock,
  },
  pipeline: {
    label: "Pipeline",
    className: "badge badge-generating",
    Icon: Repeat,
  },
};

const taskTypeIconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  audio_annotation: Headphones,
  image_annotation: Image,
  text_annotation: MessageSquare,
  translation: Languages,
  video_annotation: Video,
  data_collection: Search,
  ai_training: Bot,
  content_moderation: Shield,
};

export function StatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status];
  if (!config) return null;
  const { Icon } = config;
  return (
    <span className={config.className}>
      <Icon
        size={12}
        className={status === "generating" ? "animate-spin" : undefined}
      />
      {config.label}
    </span>
  );
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const config = urgencyConfig[urgency];
  if (!config) return null;
  const { Icon } = config;
  return (
    <span className={config.className}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}

export function TaskTypeBadge({ taskType }: { taskType: string }) {
  const Icon = taskTypeIconMap[taskType] || FileText;
  const label = taskType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return (
    <span className="badge badge-sent">
      <Icon size={12} />
      {label}
    </span>
  );
}
