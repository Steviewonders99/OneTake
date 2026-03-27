import { UserCircle } from "lucide-react";
import type { ActorProfile } from "@/lib/types";

interface ActorCardProps {
  actor: ActorProfile;
}

export default function ActorCard({ actor }: ActorCardProps) {
  const faceDesc =
    typeof actor.face_lock === "object" && actor.face_lock !== null
      ? (actor.face_lock as Record<string, string>).description || JSON.stringify(actor.face_lock)
      : String(actor.face_lock);

  const outfits = actor.outfit_variations
    ? Object.entries(actor.outfit_variations as Record<string, string>)
    : [];

  return (
    <div className="border border-[var(--border)] rounded-[var(--radius-md)] p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[var(--muted)] flex items-center justify-center shrink-0">
          <UserCircle size={20} className="text-[var(--muted-foreground)]" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-[var(--foreground)]">{actor.name}</h4>
          {actor.signature_accessory && (
            <p className="text-xs text-[var(--muted-foreground)]">
              Signature: {actor.signature_accessory}
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-[var(--foreground)] leading-relaxed line-clamp-3">
        {faceDesc}
      </p>

      {outfits.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
            Outfit Variations
          </p>
          <div className="space-y-1">
            {outfits.map(([key, val]) => (
              <div key={key} className="flex items-start gap-2 text-xs">
                <span className="font-medium text-[var(--foreground)] capitalize whitespace-nowrap">
                  {key.replace(/_/g, " ")}:
                </span>
                <span className="text-[var(--muted-foreground)]">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {actor.backdrops.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {actor.backdrops.map((b) => (
            <span key={b} className="tag-pill">{b}</span>
          ))}
        </div>
      )}
    </div>
  );
}
