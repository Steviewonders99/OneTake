'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Minimize2, Maximize2 } from 'lucide-react';
import { useDashboard } from './DashboardContext';
import type { WidgetInstance, GridLayoutItem } from './types';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  widgets?: WidgetInstance[];
}

export function DashboardAiChat() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: 'Describe what you want to see and I\'ll build the dashboard with the right widgets. I don\'t access any data directly — I configure widgets that connect to your sources.' },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { state, addWidget, updateLayouts, setTitle, setDescription, toggleEditMode } = useDashboard();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: prompt }]);
    setLoading(true);

    try {
      const res = await fetch('/api/insights/ai/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        setMessages(prev => [...prev, { role: 'assistant', content: err.error || 'Something went wrong. Try rephrasing.' }]);
        return;
      }

      const data = await res.json();

      // The compose endpoint creates a new dashboard — we want to MERGE widgets into current
      // Fetch the created dashboard's layout to extract widgets
      if (data.id) {
        const dashRes = await fetch(`/api/insights/${data.id}`);
        if (dashRes.ok) {
          const dash = await dashRes.json();
          const layoutData = dash.layout_data;
          const widgets: WidgetInstance[] = layoutData?.widgets || [];
          const lgLayout: GridLayoutItem[] = layoutData?.gridLayouts?.lg || [];

          if (widgets.length > 0) {
            // Enable edit mode if not already
            if (!state.isEditMode) toggleEditMode();

            // Add each widget from the AI response
            for (const w of widgets) {
              addWidget(w.type);
            }

            const widgetNames = widgets.map(w => w.title || w.type).join(', ');
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `Added ${widgets.length} widgets: ${widgetNames}. You can drag to rearrange or click to configure each one.`,
              widgets,
            }]);

            // Update title/description if this is a fresh dashboard
            if (state.layoutData.widgets.length === 0 && data.title) {
              setTitle(data.title);
              if (dash.description) setDescription(dash.description);
            }

            // Clean up the temp dashboard
            fetch(`/api/insights/${data.id}`, { method: 'DELETE' }).catch(() => {});
          } else {
            setMessages(prev => [...prev, { role: 'assistant', content: 'No suitable widgets found. Try being more specific about what metrics you want to see.' }]);
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  // Floating button when closed
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all hover:scale-110 hover:shadow-xl cursor-pointer"
        style={{ background: 'linear-gradient(135deg, #7C3AED, #2563EB)' }}
      >
        <Sparkles className="w-5 h-5" />
      </button>
    );
  }

  // Chat panel
  const panelW = expanded ? 480 : 360;
  const panelH = expanded ? 520 : 400;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 bg-white rounded-2xl border border-black/[0.08] flex flex-col overflow-hidden"
      style={{
        width: panelW,
        height: panelH,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        fontFamily: "'Roboto', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2.5 shrink-0"
        style={{ background: 'linear-gradient(135deg, #7C3AED, #2563EB)' }}
      >
        <Sparkles className="w-4 h-4 text-white/80" />
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-white">Dashboard Builder</div>
          <div className="text-[9px] text-white/60">Widgets connect to data — AI never sees raw data</div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="p-1 rounded hover:bg-white/10 transition-colors cursor-pointer">
          {expanded ? <Minimize2 className="w-3.5 h-3.5 text-white/70" /> : <Maximize2 className="w-3.5 h-3.5 text-white/70" />}
        </button>
        <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/10 transition-colors cursor-pointer">
          <X className="w-3.5 h-3.5 text-white/70" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#7C3AED] text-white'
                  : msg.role === 'system'
                    ? 'bg-[#F5F3FF] text-[#4B5563] border border-[#EDE9FE]'
                    : 'bg-[#F3F4F6] text-[#111827]'
              }`}
            >
              {msg.content}
              {msg.widgets && msg.widgets.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {msg.widgets.map(w => (
                    <span key={w.id} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-white/20 text-[#7C3AED]">
                      {w.title || w.type}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#F3F4F6] rounded-xl px-3 py-2 text-[12px] text-[#9CA3AF]">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF] animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-1 shrink-0">
        <div className="flex items-end gap-2 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Build a paid media overview with spend and CPA..."
            rows={1}
            className="flex-1 text-[12px] text-[#111827] placeholder-[#D1D5DB] bg-transparent outline-none resize-none leading-relaxed"
            style={{ maxHeight: 80 }}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:cursor-not-allowed"
            style={{ background: input.trim() ? '#7C3AED' : '#E5E7EB' }}
          >
            <Send className="w-3.5 h-3.5" style={{ color: input.trim() ? 'white' : '#9CA3AF' }} />
          </button>
        </div>
        <div className="text-[8px] text-[#D1D5DB] mt-1 text-center">
          AI selects widgets only — never accesses your data directly
        </div>
      </div>
    </div>
  );
}
