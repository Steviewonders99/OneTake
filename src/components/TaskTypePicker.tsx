"use client";

import {
  Headphones,
  Image,
  Languages,
  Video,
  Search,
  MessageSquare,
  Bot,
  Shield,
  FileText,
  Check,
} from "lucide-react";
import type { TaskTypeSchema } from "@/lib/types";

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Headphones,
  Image,
  Languages,
  Video,
  Search,
  MessageSquare,
  Bot,
  Shield,
  FileText,
};

interface TaskTypePickerProps {
  schemas: TaskTypeSchema[];
  selected: string | null;
  onSelect: (taskType: string) => void;
}

export default function TaskTypePicker({ schemas, selected, onSelect }: TaskTypePickerProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {schemas.map((schema) => {
        const isActive = selected === schema.task_type;
        const Icon = iconMap[schema.icon] || FileText;

        return (
          <button
            key={schema.task_type}
            type="button"
            onClick={() => onSelect(schema.task_type)}
            className={`
              relative p-4 rounded-[var(--radius-md)] text-left transition-all cursor-pointer
              border-2
              ${
                isActive
                  ? "border-[var(--oneforma-charcoal)] bg-[var(--muted)]"
                  : "border-[var(--border)] bg-white hover:border-[#d4d4d4] hover:shadow-sm"
              }
            `}
          >
            {isActive && (
              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full gradient-accent flex items-center justify-center">
                <Check size={12} className="text-white" />
              </div>
            )}
            <Icon
              size={22}
              className={isActive ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}
            />
            <p className="text-sm font-semibold text-[var(--foreground)] mt-2">
              {schema.display_name}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1 line-clamp-2">
              {schema.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
