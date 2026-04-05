"use client";

import { useState, useRef, useEffect } from "react";
import {
  Eraser,
  Sparkles,
  Sun,
  Shirt,
  MapPin,
  Ban,
  Send,
  Loader2,
  User,
  Bot,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────

export interface EditMessage {
  id: string;
  role: "user" | "system";
  text: string;
  imageUrl?: string;
  timestamp: string;
}

interface EditChatProps {
  messages: EditMessage[];
  onSubmit: (prompt: string) => void;
  isGenerating: boolean;
  disabled?: boolean;
}

// ── Quick actions ────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: "Clean BG", icon: Eraser, prompt: "Remove background artifacts and make the background clean and professional" },
  { label: "Fix Texture", icon: Sparkles, prompt: "Fix any texture artifacts, smooth skin imperfections, and sharpen details" },
  { label: "Lighting", icon: Sun, prompt: "Improve the lighting to be more natural and even, reduce harsh shadows" },
  { label: "Outfit", icon: Shirt, prompt: "Adjust the outfit to look more professional and culturally appropriate" },
  { label: "Setting", icon: MapPin, prompt: "Change the background setting to a clean, modern workspace environment" },
  { label: "Remove", icon: Ban, prompt: "Remove any text, watermarks, or unwanted objects from the image" },
];

// ── Component ────────────────────────────────────────────────────

export default function EditChat({
  messages,
  onSubmit,
  isGenerating,
  disabled = false,
}: EditChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleSubmit() {
    const text = input.trim();
    if (!text || isGenerating || disabled) return;
    setInput("");
    onSubmit(text);
  }

  function handleQuickAction(prompt: string) {
    if (isGenerating || disabled) return;
    onSubmit(prompt);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles size={24} className="text-[var(--muted-foreground)] mb-2 opacity-40" />
            <p className="text-xs text-[var(--muted-foreground)]">
              Drop an asset into the editor, then describe your edits
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "system" && (
              <div className="w-6 h-6 rounded-full bg-[var(--muted)] flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={14} className="text-[var(--muted-foreground)]" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-[12px] px-3 py-2 ${
                msg.role === "user"
                  ? "bg-[var(--oneforma-charcoal)] text-white"
                  : "bg-[var(--muted)] text-[var(--foreground)]"
              }`}
            >
              <p className="text-xs leading-relaxed">{msg.text}</p>
              {msg.imageUrl && (
                <div className="mt-2 rounded-[8px] overflow-hidden">
                  <img
                    src={msg.imageUrl}
                    alt="Edit result"
                    className="w-full max-w-[200px] rounded-[8px]"
                  />
                </div>
              )}
              <p
                className={`text-[12px] mt-1 ${
                  msg.role === "user" ? "text-white/50" : "text-[var(--muted-foreground)]"
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            {msg.role === "user" && (
              <div className="w-6 h-6 rounded-full bg-[var(--oneforma-charcoal)] flex items-center justify-center shrink-0 mt-0.5">
                <User size={14} className="text-white" />
              </div>
            )}
          </div>
        ))}

        {isGenerating && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full bg-[var(--muted)] flex items-center justify-center shrink-0">
              <Bot size={14} className="text-[var(--muted-foreground)]" />
            </div>
            <div className="bg-[var(--muted)] rounded-[12px] px-3 py-2">
              <div className="flex items-center gap-2">
                <Loader2 size={12} className="animate-spin text-[var(--muted-foreground)]" />
                <p className="text-xs text-[var(--muted-foreground)]">Generating edit...</p>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick action chips */}
      <div className="px-4 py-2 border-t border-[var(--border)]">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action.prompt)}
              disabled={isGenerating || disabled}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium bg-white border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <action.icon size={11} />
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[var(--border)]">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Select an asset first..." : "Describe your edit..."}
            disabled={isGenerating || disabled}
            rows={1}
            className="flex-1 resize-none px-3 py-2 text-xs rounded-[10px] border border-[var(--border)] bg-white text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--oneforma-charcoal)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isGenerating || disabled}
            className="p-2 rounded-full bg-[var(--oneforma-charcoal)] text-white cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {isGenerating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
