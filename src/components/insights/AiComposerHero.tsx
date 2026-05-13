"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Loader2, Command, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const SUGGESTIONS = [
  'Campaign performance overview',
  'Humus full funnel by channel',
  'Lumina vs Milky Way CVR',
  'Reddit vs Meta efficiency',
  'Weekly organic growth report',
];

const THINKING_TAGS = [
  'Analyzing question...',
  'Selecting widgets...',
  'Arranging layout...',
];

export function AiComposerHero() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visibleTags, setVisibleTags] = useState<number>(0);

  // Auto-resize textarea
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 60), 200)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [query, resize]);

  // Stagger thinking tags
  useEffect(() => {
    if (!loading) { setVisibleTags(0); return; }
    setVisibleTags(0);
    const timers = THINKING_TAGS.map((_, i) =>
      setTimeout(() => setVisibleTags(i + 1), i * 500 + 200)
    );
    return () => timers.forEach(clearTimeout);
  }, [loading]);

  const submit = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/insights/ai/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      const { id } = await res.json();
      router.push(`/insights/${id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast.error(msg);
      setLoading(false);
    }
  }, [loading, router]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(query);
    }
  };

  const handleSuggestion = (s: string) => {
    setQuery(s);
    submit(s);
  };

  const canSend = query.trim().length > 0;

  return (
    <div className="relative w-full py-16 px-4 flex flex-col items-center gap-8 overflow-hidden">

      {/* Ambient glow orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          style={{
            position: 'absolute',
            top: '10%',
            left: '15%',
            width: 480,
            height: 480,
            background: 'rgba(6,147,227,0.04)',
            borderRadius: '50%',
            filter: 'blur(120px)',
            animation: 'pulse 8s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '5%',
            right: '12%',
            width: 360,
            height: 360,
            background: 'rgba(155,81,224,0.03)',
            borderRadius: '50%',
            filter: 'blur(120px)',
            animation: 'pulse 10s ease-in-out infinite',
            animationDelay: '2s',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '0%',
            left: '40%',
            width: 300,
            height: 300,
            background: 'rgba(34,197,94,0.03)',
            borderRadius: '50%',
            filter: 'blur(120px)',
            animation: 'pulse 12s ease-in-out infinite',
            animationDelay: '4s',
          }}
        />
      </div>

      {/* Heading */}
      <div className="relative z-10 flex flex-col items-center gap-3 text-center max-w-xl">
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            background: 'linear-gradient(135deg, #1a1a1a 40%, #a3a3a3 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          What do you want to analyze?
        </h1>
        <p className="text-[14px] text-[#a3a3a3] leading-relaxed">
          Describe what you&apos;re looking for — I&apos;ll build the dashboard
        </p>

        {/* Decorative gradient line */}
        <div
          style={{
            width: 64,
            height: 2,
            borderRadius: 9999,
            background: 'linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))',
            marginTop: 4,
            opacity: 0.6,
          }}
        />
      </div>

      {/* Input card */}
      <div
        className="relative z-10 w-full max-w-2xl"
        style={{
          background: '#fff',
          border: focused
            ? '1px solid #d4d4d4'
            : '1px solid #e5e5e5',
          borderRadius: 16,
          boxShadow: focused
            ? '0 8px 40px rgba(0,0,0,0.06), 0 0 0 4px rgba(6,147,227,0.06)'
            : '0 4px 24px rgba(0,0,0,0.04)',
          transition: 'box-shadow 200ms ease, border-color 200ms ease',
        }}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); resize(); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="e.g. Show me campaign performance by channel for the last 30 days..."
          disabled={loading}
          rows={1}
          style={{
            display: 'block',
            width: '100%',
            minHeight: 60,
            maxHeight: 200,
            resize: 'none',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            padding: '18px 20px 12px',
            fontSize: 15,
            color: '#1a1a1a',
            lineHeight: 1.55,
            fontFamily: 'inherit',
            overflowY: 'auto',
          }}
          className="placeholder-[#d4d4d4]"
        />

        {/* Thinking tags */}
        {loading && visibleTags > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {THINKING_TAGS.slice(0, visibleTags).map((tag, i) => (
              <span
                key={tag}
                className="animate-fadeIn"
                style={{
                  fontSize: 10,
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: '#f0f9ff',
                  color: '#3b82f6',
                  animationDelay: `${i * 500}ms`,
                  opacity: 0,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px 14px',
            borderTop: '1px solid #f5f5f5',
          }}
        >
          {/* Left actions */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              tabIndex={-1}
              title="AI suggestions"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#d4d4d4',
                transition: 'color 150ms ease, background 150ms ease',
              }}
              className="hover:!text-[#a855f7] hover:!bg-[#f5f5f5]"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              title="Keyboard shortcut"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#d4d4d4',
                transition: 'color 150ms ease, background 150ms ease',
              }}
              className="hover:!text-[#525252] hover:!bg-[#f5f5f5]"
            >
              <Command className="w-4 h-4" />
            </button>
          </div>

          {/* Send button */}
          <button
            type="button"
            onClick={() => submit(query)}
            disabled={!canSend || loading}
            title="Send (Enter)"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: canSend && !loading ? 'pointer' : 'default',
              transition: 'all 200ms ease',
              ...(canSend && !loading
                ? {
                    background: '#1a1a1a',
                    color: '#ffffff',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  }
                : {
                    background: '#f5f5f5',
                    color: '#d4d4d4',
                  }),
            }}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Loading label */}
      {loading && (
        <p className="relative z-10 text-[12px] text-[#a3a3a3] animate-fadeIn">
          Building your dashboard...
        </p>
      )}

      {/* Suggestion pills */}
      {!loading && (
        <div className="relative z-10 flex flex-wrap justify-center gap-2 max-w-2xl">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSuggestion(s)}
              style={{
                background: '#fff',
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                fontSize: 12,
                color: '#a3a3a3',
                padding: '6px 12px',
                cursor: 'pointer',
                transition: 'all 150ms ease',
                lineHeight: 1.4,
              }}
              className="hover:!text-[#525252] hover:-translate-y-px"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
