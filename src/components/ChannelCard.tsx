import { ExternalLink } from "lucide-react";

interface ChannelCardProps {
  name: string;
  effectiveness: number;
  rationale?: string;
  sources?: string[];
  formats?: string[];
}

export default function ChannelCard({
  name,
  effectiveness,
  rationale,
  sources,
  formats,
}: ChannelCardProps) {
  return (
    <div className="border border-[var(--border)] rounded-[var(--radius-md)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[var(--foreground)]">{name}</h4>
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-[var(--muted)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full gradient-accent"
              style={{ width: `${effectiveness}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-[var(--foreground)]">
            {effectiveness}%
          </span>
        </div>
      </div>

      {rationale && (
        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">{rationale}</p>
      )}

      {formats && formats.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {formats.map((f) => (
            <span key={f} className="tag-pill">
              {f}
            </span>
          ))}
        </div>
      )}

      {sources && sources.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {sources.map((src, i) => (
            <a
              key={i}
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline cursor-pointer"
            >
              <ExternalLink size={10} />
              Source {i + 1}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
