'use client';

import { useState, useCallback } from 'react';
import { Pencil, X, Upload, Send, Undo2, CheckSquare, Square, Loader2 } from 'lucide-react';

interface EditModeProps {
  requestId: string;
  campaignTitle: string;
  allAssetIds: string[];
  onEditComplete?: () => void;
}

interface EditState {
  active: boolean;
  selectedIds: Set<string>;
  instruction: string;
  excelFile: File | null;
  submitting: boolean;
  lastBatchId: string | null;
  result: {
    action_type: string;
    assets_updated: number;
    assets_failed: number;
    jobs_created?: number;
    new_countries?: string[];
  } | null;
}

export function EditMode({ requestId, campaignTitle, allAssetIds, onEditComplete }: EditModeProps) {
  const [state, setState] = useState<EditState>({
    active: false,
    selectedIds: new Set(),
    instruction: '',
    excelFile: null,
    submitting: false,
    lastBatchId: null,
    result: null,
  });

  const toggleSelect = useCallback((id: string) => {
    setState(prev => {
      const next = new Set(prev.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, selectedIds: next };
    });
  }, []);

  const selectAll = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedIds: new Set(allAssetIds),
    }));
  }, [allAssetIds]);

  const clearSelection = useCallback(() => {
    setState(prev => ({ ...prev, selectedIds: new Set() }));
  }, []);

  const handleSubmit = async () => {
    if (!state.instruction.trim() || state.selectedIds.size === 0) return;

    setState(prev => ({ ...prev, submitting: true }));

    try {
      const formData = new FormData();
      formData.append('instruction', state.instruction);
      formData.append('asset_ids', JSON.stringify([...state.selectedIds]));
      if (state.excelFile) {
        formData.append('excel_file', state.excelFile);
      }

      const res = await fetch(`/api/intake/${requestId}/edit`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok || res.status === 207) {
        setState(prev => ({
          ...prev,
          submitting: false,
          result: data,
          lastBatchId: data.batch_id,
          instruction: '',
          selectedIds: new Set(),
          excelFile: null,
        }));
      } else {
        alert(data.error || 'Edit failed');
        setState(prev => ({ ...prev, submitting: false }));
      }
    } catch {
      alert('Network error');
      setState(prev => ({ ...prev, submitting: false }));
    }
  };

  const handleUndo = async () => {
    if (!state.lastBatchId) return;

    const res = await fetch(`/api/intake/${requestId}/edit/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch_id: state.lastBatchId }),
    });

    if (res.ok) {
      setState(prev => ({ ...prev, result: null, lastBatchId: null }));
      onEditComplete?.();
    }
  };

  if (!state.active) {
    return (
      <button
        onClick={() => setState(prev => ({ ...prev, active: true }))}
        className="btn-secondary flex items-center gap-2 cursor-pointer"
      >
        <Pencil size={14} />
        Edit Campaign
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {state.result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex justify-between items-center">
          <div>
            <span className="text-sm font-medium text-green-800">
              {state.result.action_type === 'locale_add'
                ? `${state.result.jobs_created} new countries queued`
                : `${state.result.assets_updated} assets updated`}
            </span>
            {state.result.assets_failed > 0 && (
              <span className="text-sm text-red-600 ml-2">
                ({state.result.assets_failed} failed)
              </span>
            )}
          </div>
          <button
            onClick={handleUndo}
            className="btn-secondary text-xs flex items-center gap-1 cursor-pointer"
          >
            <Undo2 size={12} /> Undo
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 text-sm">
        <button onClick={selectAll} className="text-[#0693E3] cursor-pointer hover:underline">
          Select All ({allAssetIds.length})
        </button>
        <button onClick={clearSelection} className="text-[#737373] cursor-pointer hover:underline">
          Clear
        </button>
        <span className="text-[#737373]">{state.selectedIds.size} selected</span>
        <button
          onClick={() => setState(prev => ({ ...prev, active: false, selectedIds: new Set(), instruction: '', excelFile: null, result: null }))}
          className="ml-auto text-[#737373] cursor-pointer hover:text-[#1A1A1A]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="sticky bottom-4 bg-white border border-[#E5E5E5] rounded-xl shadow-lg p-4 space-y-3">
        <textarea
          value={state.instruction}
          onChange={e => setState(prev => ({ ...prev, instruction: e.target.value }))}
          placeholder="Describe the change... (e.g., 'Change compensation from $15/hr to $18/hr')"
          rows={2}
          className="w-full border border-[#E5E5E5] rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-[#0693E3]"
          maxLength={2000}
        />

        <div className="flex items-center gap-3">
          <label className="btn-secondary text-xs flex items-center gap-1 cursor-pointer">
            <Upload size={12} />
            {state.excelFile ? state.excelFile.name : 'Attach Excel'}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => setState(prev => ({ ...prev, excelFile: e.target.files?.[0] || null }))}
            />
          </label>

          <span className="text-xs text-[#737373] flex-1">
            {state.instruction.length}/2000
          </span>

          <button
            onClick={handleSubmit}
            disabled={state.submitting || !state.instruction.trim() || state.selectedIds.size === 0}
            className="btn-primary flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {state.submitting ? (
              <><Loader2 size={14} className="animate-spin" /> Applying...</>
            ) : (
              <><Send size={14} /> Apply Edit ({state.selectedIds.size})</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EditCheckbox({
  assetId,
  selected,
  onToggle,
}: {
  assetId: string;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(assetId); }}
      className="cursor-pointer p-1"
    >
      {selected ? (
        <CheckSquare size={18} className="text-[#0693E3]" />
      ) : (
        <Square size={18} className="text-[#737373]" />
      )}
    </button>
  );
}
