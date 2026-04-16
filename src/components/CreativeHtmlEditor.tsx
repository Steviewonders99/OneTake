"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Type,
  Move,
  Palette,
  Sparkles,
  Download,
  RotateCcw,
  X,
  ChevronDown,
  ChevronRight,
  Maximize2,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import type { GeneratedAsset } from "@/lib/types";

interface CreativeHtmlEditorProps {
  asset: GeneratedAsset;
  onClose: () => void;
  onChangeLayout?: (asset: GeneratedAsset) => void;
  onSave?: (asset: GeneratedAsset, html: string) => void;
}

// ── Inject interaction scripts into the creative HTML ────────────────

function injectInteractionScript(html: string): string {
  // Inject a script that:
  // 1. Makes elements clickable (sends selection to parent)
  // 2. Listens for text/color/position updates from parent
  // 3. Makes CTA and elements draggable + resizable

  const script = `
<script>
(function() {
  // ── Element selection ──
  let selectedEl = null;
  let dragState = null;
  let resizeState = null;

  document.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();

    // Remove old highlight
    if (selectedEl) {
      selectedEl.style.outline = '';
      selectedEl.style.outlineOffset = '';
    }

    selectedEl = e.target;
    selectedEl.style.outline = '2px solid #7C3AED';
    selectedEl.style.outlineOffset = '2px';

    // Send element info to parent
    var computed = window.getComputedStyle(selectedEl);
    window.parent.postMessage({
      type: 'element-selected',
      tag: selectedEl.tagName,
      text: selectedEl.textContent?.substring(0, 200) || '',
      styles: {
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        fontSize: computed.fontSize,
        fontWeight: computed.fontWeight,
        fontFamily: computed.fontFamily,
        borderRadius: computed.borderRadius,
        padding: computed.padding,
        width: selectedEl.offsetWidth,
        height: selectedEl.offsetHeight,
        left: selectedEl.offsetLeft,
        top: selectedEl.offsetTop,
      },
      path: getPath(selectedEl),
    }, '*');
  }, true);

  // ── Drag support ──
  document.addEventListener('mousedown', function(e) {
    if (!selectedEl || e.target !== selectedEl) return;
    if (!selectedEl.style.position || selectedEl.style.position === 'static') {
      selectedEl.style.position = 'relative';
    }
    dragState = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: parseInt(selectedEl.style.left || '0'),
      origTop: parseInt(selectedEl.style.top || '0'),
    };
    e.preventDefault();
  });

  document.addEventListener('mousemove', function(e) {
    if (!dragState || !selectedEl) return;
    var dx = e.clientX - dragState.startX;
    var dy = e.clientY - dragState.startY;
    selectedEl.style.left = (dragState.origLeft + dx) + 'px';
    selectedEl.style.top = (dragState.origTop + dy) + 'px';
    e.preventDefault();
  });

  document.addEventListener('mouseup', function() {
    if (dragState && selectedEl) {
      window.parent.postMessage({
        type: 'element-moved',
        left: selectedEl.style.left,
        top: selectedEl.style.top,
      }, '*');
    }
    dragState = null;
  });

  // ── Listen for updates from parent ──
  window.addEventListener('message', function(e) {
    var msg = e.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'update-text') {
      // Find element by role and update text
      var el = findByRole(msg.role);
      if (el) {
        el.textContent = msg.text;
      }
    }

    if (msg.type === 'update-style') {
      var el = findByRole(msg.role) || selectedEl;
      if (el && msg.property && msg.value) {
        el.style[msg.property] = msg.value;
      }
    }

    if (msg.type === 'update-selected-style') {
      if (selectedEl && msg.property && msg.value) {
        selectedEl.style[msg.property] = msg.value;
      }
    }

    if (msg.type === 'get-html') {
      // Remove our outline before sending
      if (selectedEl) {
        selectedEl.style.outline = '';
        selectedEl.style.outlineOffset = '';
      }
      window.parent.postMessage({
        type: 'current-html',
        html: document.documentElement.outerHTML,
      }, '*');
      // Restore outline
      if (selectedEl) {
        selectedEl.style.outline = '2px solid #7C3AED';
        selectedEl.style.outlineOffset = '2px';
      }
    }
  });

  // ── Helpers ──
  function getPath(el) {
    var path = [];
    while (el && el !== document.body) {
      path.unshift(el.tagName + (el.className ? '.' + el.className.split(' ')[0] : ''));
      el = el.parentElement;
    }
    return path.join(' > ');
  }

  function findByRole(role) {
    // Find elements by data-role attribute or by content heuristic
    var byRole = document.querySelector('[data-role="' + role + '"]');
    if (byRole) return byRole;

    // Heuristic: find by likely element type
    var all = document.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var fs = parseInt(window.getComputedStyle(el).fontSize);
      var text = (el.textContent || '').trim();
      if (!text || text.length > 200) continue;

      if (role === 'headline' && fs >= 24 && el.children.length <= 3) return el;
      if (role === 'subheadline' && fs >= 12 && fs < 24 && text.length > 10 && text.length < 120) return el;
      if (role === 'cta' && (el.tagName === 'BUTTON' || el.tagName === 'A' ||
          (window.getComputedStyle(el).borderRadius && parseInt(window.getComputedStyle(el).borderRadius) > 20))) return el;
    }
    return null;
  }

  // Signal ready
  window.parent.postMessage({ type: 'editor-ready' }, '*');
})();
</script>`;

  // Insert script before </body> or at end
  if (html.includes("</body>")) {
    return html.replace("</body>", `${script}\n</body>`);
  }
  return html + script;
}

// ── Text Control Panel ───────────────────────────────────────────────

function TextControl({
  label,
  role,
  defaultValue,
  iframeRef,
  expanded,
  onToggle,
}: {
  label: string;
  role: string;
  defaultValue: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [value, setValue] = useState(defaultValue);

  const handleChange = (text: string) => {
    setValue(text);
    iframeRef.current?.contentWindow?.postMessage(
      { type: "update-text", role, text },
      window.location.origin
    );
  };

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-[var(--muted)] hover:bg-[var(--muted)]/80 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2">
          <Type size={12} className="text-[#6B21A8]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">{label}</span>
        </div>
        {expanded ? <ChevronDown size={14} className="text-[var(--muted-foreground)]" /> : <ChevronRight size={14} className="text-[var(--muted-foreground)]" />}
      </button>
      {expanded && (
        <div className="p-3">
          <textarea
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            rows={label === "Headline" ? 2 : label === "CTA" ? 1 : 2}
            className="w-full bg-white border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--foreground)] resize-none focus:outline-none focus:border-[#6B21A8]/40 transition-colors"
            placeholder={`Edit ${label.toLowerCase()}...`}
          />
        </div>
      )}
    </div>
  );
}

// ── Color Picker Control ─────────────────────────────────────────────

function ColorControl({
  label,
  property,
  defaultValue,
  iframeRef,
}: {
  label: string;
  property: string;
  defaultValue: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  const [color, setColor] = useState(defaultValue);

  const handleChange = (newColor: string) => {
    setColor(newColor);
    iframeRef.current?.contentWindow?.postMessage(
      { type: "update-selected-style", property, value: newColor },
      window.location.origin
    );
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={color}
        onChange={(e) => handleChange(e.target.value)}
        className="w-7 h-7 rounded-md border border-[var(--border)] cursor-pointer p-0"
      />
      <span className="text-[11px] text-[var(--muted-foreground)]">{label}</span>
    </div>
  );
}

// ── Main Editor Component ────────────────────────────────────────────

export default function CreativeHtmlEditor({
  asset,
  onClose,
  onChangeLayout,
  onSave,
}: CreativeHtmlEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selectedElement, setSelectedElement] = useState<Record<string, any> | null>(null);
  const [expandedControl, setExpandedControl] = useState<string>("headline");
  const [isReady, setIsReady] = useState(false);
  const [layoutLoading, setLayoutLoading] = useState(false);

  const content = (asset.content || {}) as Record<string, any>;
  const creativeHtml = content.creative_html || content.html || "";

  // Parse dimensions from format
  const [width, height] = (asset.format || "1080x1080").split("x").map(Number);
  const scale = Math.min(1, 500 / Math.max(width, height));

  // Inject interaction scripts into HTML
  const editorHtml = creativeHtml ? injectInteractionScript(creativeHtml) : "";

  // Listen for messages from iframe
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      const msg = e.data;
      if (!msg || !msg.type) return;

      if (msg.type === "editor-ready") {
        setIsReady(true);
      }
      if (msg.type === "element-selected") {
        setSelectedElement(msg);
      }
      if (msg.type === "element-moved") {
        // Element was dragged — could save position
      }
      if (msg.type === "current-html") {
        // Received current HTML state for saving
        if (onSave && msg.html) {
          onSave(asset, msg.html);
          toast.success("Creative HTML saved");
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [asset, onSave]);

  const handleChangeLayout = async () => {
    if (!onChangeLayout) return;
    setLayoutLoading(true);
    try {
      await onChangeLayout(asset);
      toast.success("Layout change requested — GLM-5 generating new variation...");
    } catch {
      toast.error("Failed to request layout change");
    } finally {
      setLayoutLoading(false);
    }
  };

  const handleSave = () => {
    // Ask iframe for current HTML state
    iframeRef.current?.contentWindow?.postMessage({ type: "get-html" }, window.location.origin);
  };

  const handleDownload = () => {
    if (asset.blob_url) {
      window.open(asset.blob_url, "_blank");
    }
  };

  // No HTML available — show fallback
  if (!editorHtml) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl max-w-[600px] w-full p-8 text-center" onClick={e => e.stopPropagation()}>
          <div className="w-12 h-12 rounded-xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
            <Type size={20} className="text-[var(--muted-foreground)]" />
          </div>
          <h3 className="text-base font-semibold text-[var(--foreground)] mb-2">Interactive Editor Not Available</h3>
          <p className="text-sm text-[var(--muted-foreground)] mb-4">
            This creative doesn&apos;t have stored HTML. Run the pipeline again to generate editable creatives.
          </p>
          {asset.blob_url && (
            <img src={asset.blob_url} alt="" className="max-w-[300px] mx-auto rounded-lg mb-4" />
          )}
          <button onClick={onClose} className="btn-secondary cursor-pointer">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0f0f] flex" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Left: Live HTML Canvas */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-[#1a1a1a]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg cursor-pointer transition-colors z-10"
        >
          <X size={18} className="text-white" />
        </button>

        {/* Scale indicator */}
        <div className="absolute top-4 right-4 text-[11px] text-white/40 font-mono z-10">
          {width}×{height} @ {(scale * 100).toFixed(0)}%
        </div>

        {/* Iframe container with scale */}
        <div
          className="relative border-2 border-white/10 rounded-lg overflow-hidden shadow-2xl"
          style={{
            width: `${width}px`,
            height: `${height}px`,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <iframe
            ref={iframeRef}
            srcDoc={editorHtml}
            sandbox="allow-scripts"
            className="absolute inset-0 w-full h-full border-0"
            style={{ width: `${width}px`, height: `${height}px` }}
          />
          {!isReady && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="text-white/60 text-sm">Loading editor...</div>
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2 text-[11px] text-white/50">
            <Move size={13} />
            Click to select · Drag to move
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleChangeLayout}
              disabled={layoutLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#6B21A8] hover:bg-[#5B21B6] rounded-lg text-[12px] font-semibold text-white cursor-pointer transition-colors disabled:opacity-50"
            >
              <Sparkles size={14} />
              {layoutLoading ? "Generating..." : "Change Layout"}
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-[12px] font-medium text-white cursor-pointer transition-colors"
            >
              Save Edits
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-[12px] font-medium text-white cursor-pointer transition-colors"
            >
              <Download size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Right: Controls Panel */}
      <div className="w-[320px] bg-white border-l border-[var(--border)] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)]">
          <h3 className="text-[13px] font-semibold text-[var(--foreground)]">Creative Editor</h3>
          <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
            Edit text live · Click elements to style · Drag to reposition
          </p>
        </div>

        {/* Text Controls */}
        <div className="p-4 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">Text Elements</span>

          <TextControl
            label="Headline"
            role="headline"
            defaultValue={content.overlay_headline || ""}
            iframeRef={iframeRef}
            expanded={expandedControl === "headline"}
            onToggle={() => setExpandedControl(expandedControl === "headline" ? "" : "headline")}
          />

          <TextControl
            label="Subheadline"
            role="subheadline"
            defaultValue={content.overlay_sub || ""}
            iframeRef={iframeRef}
            expanded={expandedControl === "subheadline"}
            onToggle={() => setExpandedControl(expandedControl === "subheadline" ? "" : "subheadline")}
          />

          <TextControl
            label="CTA Button"
            role="cta"
            defaultValue={content.overlay_cta || "Apply Now →"}
            iframeRef={iframeRef}
            expanded={expandedControl === "cta"}
            onToggle={() => setExpandedControl(expandedControl === "cta" ? "" : "cta")}
          />
        </div>

        {/* Selected Element Styling */}
        {selectedElement && (
          <div className="p-4 border-t border-[var(--border)] space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block">
              Selected: &lt;{selectedElement.tag?.toLowerCase()}&gt;
            </span>
            <p className="text-[11px] text-[var(--foreground)] bg-[var(--muted)] rounded-lg px-2.5 py-1.5 line-clamp-2">
              {selectedElement.text?.substring(0, 80) || "(empty)"}
            </p>

            {/* Color controls */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block">Colors</span>
              <div className="grid grid-cols-2 gap-2">
                <ColorControl
                  label="Text"
                  property="color"
                  defaultValue={rgbToHex(selectedElement.styles?.color || "#000000")}
                  iframeRef={iframeRef}
                />
                <ColorControl
                  label="Background"
                  property="backgroundColor"
                  defaultValue={rgbToHex(selectedElement.styles?.backgroundColor || "#ffffff")}
                  iframeRef={iframeRef}
                />
              </div>
            </div>

            {/* Size controls */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block">Size</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-[var(--muted-foreground)] block mb-0.5">Font Size</label>
                  <input
                    type="range"
                    min="8"
                    max="72"
                    defaultValue={parseInt(selectedElement.styles?.fontSize || "16")}
                    onChange={(e) => {
                      iframeRef.current?.contentWindow?.postMessage(
                        { type: "update-selected-style", property: "fontSize", value: `${e.target.value}px` },
                        window.location.origin
                      );
                    }}
                    className="w-full cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-[var(--muted-foreground)] block mb-0.5">Border Radius</label>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    defaultValue={parseInt(selectedElement.styles?.borderRadius || "0")}
                    onChange={(e) => {
                      iframeRef.current?.contentWindow?.postMessage(
                        { type: "update-selected-style", property: "borderRadius", value: `${e.target.value}px` },
                        window.location.origin
                      );
                    }}
                    className="w-full cursor-pointer"
                  />
                </div>
              </div>
              {/* Width/height for CTA and block elements */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-[var(--muted-foreground)] block mb-0.5">
                    Width ({selectedElement.styles?.width || "auto"}px)
                  </label>
                  <input
                    type="range"
                    min="40"
                    max="500"
                    defaultValue={selectedElement.styles?.width || 100}
                    onChange={(e) => {
                      iframeRef.current?.contentWindow?.postMessage(
                        { type: "update-selected-style", property: "width", value: `${e.target.value}px` },
                        window.location.origin
                      );
                    }}
                    className="w-full cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-[var(--muted-foreground)] block mb-0.5">Padding</label>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    defaultValue={parseInt(selectedElement.styles?.padding || "12")}
                    onChange={(e) => {
                      iframeRef.current?.contentWindow?.postMessage(
                        { type: "update-selected-style", property: "padding", value: `${e.target.value}px` },
                        window.location.origin
                      );
                    }}
                    className="w-full cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Brand Colors Quick Access */}
        <div className="p-4 border-t border-[var(--border)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">Brand Colors</span>
          <div className="flex gap-1.5">
            {[
              { color: "#6B21A8", label: "Purple" },
              { color: "#E91E8C", label: "Pink" },
              { color: "#5B21B6", label: "Deep Purple" },
              { color: "#16A34A", label: "Green" },
              { color: "#FFFFFF", label: "White" },
              { color: "#1A1A1A", label: "Dark" },
              { color: "#F59E0B", label: "Gold" },
            ].map((c) => (
              <button
                key={c.color}
                onClick={() => {
                  if (selectedElement) {
                    iframeRef.current?.contentWindow?.postMessage(
                      { type: "update-selected-style", property: "color", value: c.color },
                      window.location.origin
                    );
                  }
                }}
                className="w-7 h-7 rounded-md border border-[var(--border)] cursor-pointer hover:scale-110 transition-transform"
                style={{ backgroundColor: c.color }}
                title={`${c.label} — apply to text`}
              />
            ))}
          </div>
          <div className="flex gap-1.5 mt-1.5">
            {[
              { color: "#6B21A8", label: "Purple bg" },
              { color: "#E91E8C", label: "Pink bg" },
              { color: "#5B21B6", label: "Deep Purple bg" },
              { color: "#16A34A", label: "Green bg" },
              { color: "#FFFFFF", label: "White bg" },
              { color: "#F8F9FA", label: "Light bg" },
              { color: "#1A1A1A", label: "Dark bg" },
            ].map((c) => (
              <button
                key={`bg-${c.color}`}
                onClick={() => {
                  if (selectedElement) {
                    iframeRef.current?.contentWindow?.postMessage(
                      { type: "update-selected-style", property: "backgroundColor", value: c.color },
                      window.location.origin
                    );
                  }
                }}
                className="w-7 h-7 rounded-md border-2 border-[var(--border)] cursor-pointer hover:scale-110 transition-transform"
                style={{ backgroundColor: c.color }}
                title={`${c.label} — apply to background`}
              />
            ))}
          </div>
        </div>

        {/* Asset info */}
        <div className="p-4 border-t border-[var(--border)] mt-auto">
          <div className="text-[10px] text-[var(--muted-foreground)] space-y-1">
            <p>Platform: {asset.platform?.replace(/_/g, " ")}</p>
            <p>Format: {asset.format}</p>
            {content.actor_name && <p>Actor: {content.actor_name}</p>}
            {content.persona && <p>Persona: {content.persona}</p>}
            {asset.evaluation_score && <p>VQA Score: {(asset.evaluation_score * 100).toFixed(0)}%</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helper: RGB string to hex ────────────────────────────────────────

function rgbToHex(rgb: string): string {
  if (rgb.startsWith("#")) return rgb;
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return "#000000";
  const [r, g, b] = match.map(Number);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
