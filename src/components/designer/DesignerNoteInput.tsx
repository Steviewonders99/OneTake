"use client";

import { useState } from "react";
import { Send, Loader2, MessageCircle } from "lucide-react";

interface DesignerNote {
  id: string;
  request_id: string;
  asset_id: string;
  note_text: string;
  created_at: string;
}

interface DesignerNoteInputProps {
  requestId: string;
  assetId: string;
  token: string;
  existingNotes: DesignerNote[];
  onNoteSaved: (note: DesignerNote) => void;
}

export default function DesignerNoteInput({
  requestId,
  assetId,
  token,
  existingNotes,
  onNoteSaved,
}: DesignerNoteInputProps) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/designer/${requestId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_id: assetId, note_text: text.trim(), token }),
      });
      if (!res.ok) throw new Error("Failed to save note");
      const note: DesignerNote = await res.json();
      onNoteSaved(note);
      setText("");
      setExpanded(false);
    } catch {
      // Error handled silently — user can retry
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Existing notes */}
      {existingNotes.length > 0 && (
        <div className="space-y-1.5">
          {existingNotes.map((note) => (
            <div
              key={note.id}
              className="text-xs text-[var(--foreground)] bg-blue-50 border border-blue-100 rounded-[var(--radius-sm)] px-3 py-2"
            >
              <p>{note.note_text}</p>
              <p className="text-[12px] text-blue-400 mt-1">
                {new Date(note.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Toggle */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
        >
          <MessageCircle size={12} />
          Add a note
        </button>
      )}

      {/* Input */}
      {expanded && (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a note for Steven..."
            rows={2}
            className="input-base text-xs resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!text.trim() || saving}
              className="btn-primary text-xs py-1.5 px-3"
            >
              {saving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} />
              )}
              Save
            </button>
            <button
              onClick={() => { setExpanded(false); setText(""); }}
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
