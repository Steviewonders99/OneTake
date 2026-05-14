"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Undo2, Redo2, Eye, Pencil, Share2, Copy, Trash2, Check, Loader2, AlertCircle, ArrowLeft, Download } from 'lucide-react';
import { useDashboard } from './DashboardContext';
import { useDashboardFilter } from './DashboardFilterContext';
import { getDashboardMeta } from './dashboard-meta';
import { ShareModal } from './ShareModal';
import { toast } from 'sonner';

export function DashboardToolbar({ dashboardId }: { dashboardId: string }) {
  const router = useRouter();
  const { state, canUndo, canRedo, undo, redo, setTitle, toggleEditMode, forceSave } = useDashboard();
  const { filters, setFilter } = useDashboardFilter();
  const activeDateRange = filters.dateRange ? parseInt(filters.dateRange) : 30;
  const DATE_OPTIONS = [7, 14, 30, 90];
  const [showShareModal, setShowShareModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(state.title);

  const handleTitleSubmit = () => {
    setIsEditing(false);
    if (editTitle.trim() && editTitle !== state.title) setTitle(editTitle.trim());
    else setEditTitle(state.title);
  };

  const handleDuplicate = async () => {
    try {
      const res = await fetch(`/api/insights/${dashboardId}/duplicate`, { method: 'POST' });
      const dup = await res.json();
      toast.success('Dashboard duplicated');
      router.push(`/insights/${dup.id}`);
    } catch { toast.error('Failed to duplicate'); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this dashboard? This cannot be undone.')) return;
    try {
      await fetch(`/api/insights/${dashboardId}`, { method: 'DELETE' });
      toast.success('Dashboard deleted');
      router.push('/insights');
    } catch { toast.error('Failed to delete'); }
  };

  const meta = getDashboardMeta(state.title);
  const MetaIcon = meta?.icon;

  const saveIcon = {
    saved: <Check className="w-3.5 h-3.5 text-green-600" />,
    saving: <Loader2 className="w-3.5 h-3.5 text-[var(--muted-foreground)] animate-spin" />,
    unsaved: <div className="w-2 h-2 rounded-full bg-amber-500" />,
    error: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
  };
  const saveText = { saved: 'Saved', saving: 'Saving...', unsaved: 'Unsaved', error: 'Save failed' };

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-white">
        <button onClick={() => router.push('/insights')} className="p-1.5 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer" title="Back"><ArrowLeft className="w-4 h-4" /></button>
        {MetaIcon && meta && (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: meta.accentBg }}>
            <MetaIcon className="w-3.5 h-3.5" style={{ color: meta.accent }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onBlur={handleTitleSubmit} onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()} className="bg-transparent text-sm font-semibold text-[var(--foreground)] outline-none border-b-2 border-[var(--ring)] pb-0.5 w-full max-w-md" />
          ) : (
            <button onClick={() => { setEditTitle(state.title); setIsEditing(true); }} className="text-sm font-semibold text-[var(--foreground)] hover:text-[var(--ring)] truncate max-w-md block cursor-pointer">{state.title}</button>
          )}
          {state.description && (
            <div className="text-[10px] text-[#a3a3a3] truncate max-w-md">{state.description}</div>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[#a3a3a3]">
          <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
          <span>Live</span>
        </div>
        {state.saveStatus === 'error' ? (
          <button onClick={() => forceSave()} className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-500 cursor-pointer">{saveIcon.error}<span>Save failed — retry</span></button>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">{saveIcon[state.saveStatus]}<span>{saveText[state.saveStatus]}</span></div>
        )}
        <div className="flex items-center gap-0.5 border-l border-[var(--border)] pl-3">
          {DATE_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setFilter('dateRange', String(d))}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                activeDateRange === d
                  ? 'bg-[#1a1a1a] text-white'
                  : 'text-[#a3a3a3] hover:text-[#525252] hover:bg-[#f5f5f5]'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 border-l border-[var(--border)] pl-3">
          <button onClick={undo} disabled={!canUndo} className="p-1.5 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer" title="Undo (Cmd+Z)"><Undo2 className="w-4 h-4" /></button>
          <button onClick={redo} disabled={!canRedo} className="p-1.5 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer" title="Redo"><Redo2 className="w-4 h-4" /></button>
        </div>
        <button onClick={toggleEditMode} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${state.isEditMode ? 'bg-[#1a1a1a] text-white' : 'text-[#525252] bg-[#f5f5f5] hover:bg-[#ebebeb]'}`}>
          {state.isEditMode ? <><Eye className="w-3 h-3" /> Preview</> : <><Pencil className="w-3 h-3" /> Edit</>}
        </button>
        <div className="flex items-center gap-1 border-l border-[var(--border)] pl-3">
          <button onClick={() => setShowShareModal(true)} className="p-1.5 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer" title="Share"><Share2 className="w-4 h-4" /></button>
          <button onClick={() => window.print()} className="p-1.5 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer" title="Export PDF"><Download className="w-4 h-4" /></button>
          <button onClick={handleDuplicate} className="p-1.5 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer" title="Duplicate"><Copy className="w-4 h-4" /></button>
          <button onClick={handleDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--muted-foreground)] hover:text-red-600 transition-colors cursor-pointer" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      {showShareModal && <ShareModal dashboardId={dashboardId} onClose={() => setShowShareModal(false)} />}
    </>
  );
}
