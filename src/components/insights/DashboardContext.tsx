"use client";

/**
 * DashboardContext — state management for the Insights dashboard builder.
 * Ported from VYRA: useReducer with 50-step undo/redo, 1500ms auto-save.
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type {
  WidgetInstance,
  WidgetType,
  DashboardLayoutData,
  GridLayoutItem,
  SaveStatus,
} from './types';
import { WIDGET_REGISTRY } from './widgetRegistry';

// ── State ──────────────────────────────────────────────────────────────────

interface DashboardState {
  dashboardId: string;
  title: string;
  description: string;
  layoutData: DashboardLayoutData;
  isEditMode: boolean;
  selectedWidgetId: string | null;
  saveStatus: SaveStatus;
}

interface HistoryEntry {
  layoutData: DashboardLayoutData;
  title: string;
}

const MAX_HISTORY = 50;

// ── Actions ────────────────────────────────────────────────────────────────

type DashboardAction =
  | { type: 'ADD_WIDGET'; widget: WidgetInstance; gridItem: GridLayoutItem }
  | { type: 'REMOVE_WIDGET'; widgetId: string }
  | { type: 'UPDATE_WIDGET'; widgetId: string; updates: Partial<WidgetInstance> }
  | { type: 'UPDATE_LAYOUTS'; layouts: { lg: GridLayoutItem[]; md: GridLayoutItem[]; sm: GridLayoutItem[] } }
  | { type: 'SET_TITLE'; title: string }
  | { type: 'SET_DESCRIPTION'; description: string }
  | { type: 'SET_EDIT_MODE'; isEditMode: boolean }
  | { type: 'SET_SELECTED_WIDGET'; widgetId: string | null }
  | { type: 'SET_SAVE_STATUS'; status: SaveStatus }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'LOAD'; state: Pick<DashboardState, 'dashboardId' | 'title' | 'description' | 'layoutData'> };

// ── Reducer ────────────────────────────────────────────────────────────────

interface ReducerState {
  current: DashboardState;
  past: HistoryEntry[];
  future: HistoryEntry[];
}

function pushHistory(state: ReducerState): ReducerState {
  const entry: HistoryEntry = {
    layoutData: state.current.layoutData,
    title: state.current.title,
  };
  return {
    ...state,
    past: [...state.past.slice(-(MAX_HISTORY - 1)), entry],
    future: [],
  };
}

function reducer(state: ReducerState, action: DashboardAction): ReducerState {
  switch (action.type) {
    case 'ADD_WIDGET': {
      const s = pushHistory(state);
      const widgets = [...s.current.layoutData.widgets, action.widget];
      const gridLayouts = {
        lg: [...s.current.layoutData.gridLayouts.lg, action.gridItem],
        md: [...s.current.layoutData.gridLayouts.md, { ...action.gridItem, w: Math.min(action.gridItem.w, 8) }],
        sm: [...s.current.layoutData.gridLayouts.sm, { ...action.gridItem, w: Math.min(action.gridItem.w, 4), x: 0 }],
      };
      return { ...s, current: { ...s.current, layoutData: { widgets, gridLayouts }, saveStatus: 'unsaved' } };
    }
    case 'REMOVE_WIDGET': {
      const s = pushHistory(state);
      const widgets = s.current.layoutData.widgets.filter(w => w.id !== action.widgetId);
      const gridLayouts = {
        lg: s.current.layoutData.gridLayouts.lg.filter(l => l.i !== action.widgetId),
        md: s.current.layoutData.gridLayouts.md.filter(l => l.i !== action.widgetId),
        sm: s.current.layoutData.gridLayouts.sm.filter(l => l.i !== action.widgetId),
      };
      return {
        ...s,
        current: {
          ...s.current,
          layoutData: { widgets, gridLayouts },
          selectedWidgetId: s.current.selectedWidgetId === action.widgetId ? null : s.current.selectedWidgetId,
          saveStatus: 'unsaved',
        },
      };
    }
    case 'UPDATE_WIDGET': {
      const s = pushHistory(state);
      const widgets = s.current.layoutData.widgets.map(w =>
        w.id === action.widgetId ? { ...w, ...action.updates } : w,
      );
      return { ...s, current: { ...s.current, layoutData: { ...s.current.layoutData, widgets }, saveStatus: 'unsaved' } };
    }
    case 'UPDATE_LAYOUTS': {
      const s = pushHistory(state);
      return { ...s, current: { ...s.current, layoutData: { ...s.current.layoutData, gridLayouts: action.layouts }, saveStatus: 'unsaved' } };
    }
    case 'SET_TITLE': {
      const s = pushHistory(state);
      return { ...s, current: { ...s.current, title: action.title, saveStatus: 'unsaved' } };
    }
    case 'SET_DESCRIPTION':
      return { ...state, current: { ...state.current, description: action.description, saveStatus: 'unsaved' } };
    case 'SET_EDIT_MODE':
      return { ...state, current: { ...state.current, isEditMode: action.isEditMode } };
    case 'SET_SELECTED_WIDGET':
      return { ...state, current: { ...state.current, selectedWidgetId: action.widgetId } };
    case 'SET_SAVE_STATUS':
      return { ...state, current: { ...state.current, saveStatus: action.status } };
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      const futureEntry: HistoryEntry = { layoutData: state.current.layoutData, title: state.current.title };
      return {
        past: state.past.slice(0, -1),
        future: [futureEntry, ...state.future],
        current: { ...state.current, layoutData: prev.layoutData, title: prev.title, saveStatus: 'unsaved' },
      };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const pastEntry: HistoryEntry = { layoutData: state.current.layoutData, title: state.current.title };
      return {
        past: [...state.past, pastEntry],
        future: state.future.slice(1),
        current: { ...state.current, layoutData: next.layoutData, title: next.title, saveStatus: 'unsaved' },
      };
    }
    case 'LOAD':
      return {
        past: [],
        future: [],
        current: {
          dashboardId: action.state.dashboardId,
          title: action.state.title,
          description: action.state.description,
          layoutData: action.state.layoutData,
          isEditMode: false,
          selectedWidgetId: null,
          saveStatus: 'saved',
        },
      };
    default:
      return state;
  }
}

// ── Context ────────────────────────────────────────────────────────────────

interface DashboardContextValue {
  state: DashboardState;
  canUndo: boolean;
  canRedo: boolean;
  addWidget: (type: WidgetType) => void;
  removeWidget: (widgetId: string) => void;
  updateWidget: (widgetId: string, updates: Partial<WidgetInstance>) => void;
  updateLayouts: (layouts: { lg: GridLayoutItem[]; md: GridLayoutItem[]; sm: GridLayoutItem[] }) => void;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  toggleEditMode: () => void;
  selectWidget: (widgetId: string | null) => void;
  undo: () => void;
  redo: () => void;
  forceSave: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

const emptyLayout: DashboardLayoutData = {
  widgets: [],
  gridLayouts: { lg: [], md: [], sm: [] },
};

interface DashboardProviderProps {
  dashboardId: string;
  initialTitle: string;
  initialDescription?: string;
  initialLayoutData?: DashboardLayoutData;
  children: ReactNode;
}

export function DashboardProvider({
  dashboardId,
  initialTitle,
  initialDescription = '',
  initialLayoutData,
  children,
}: DashboardProviderProps) {
  const [reducerState, dispatch] = useReducer(reducer, {
    past: [],
    future: [],
    current: {
      dashboardId,
      title: initialTitle,
      description: initialDescription,
      layoutData: initialLayoutData || emptyLayout,
      isEditMode: false,
      selectedWidgetId: null,
      saveStatus: 'saved',
    },
  });

  const { current: state } = reducerState;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const doSave = useCallback(async () => {
    if (!isMountedRef.current) return;
    dispatch({ type: 'SET_SAVE_STATUS', status: 'saving' });
    try {
      await fetch(`/api/insights/${dashboardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layout_data: state.layoutData,
          title: state.title || undefined,
          description: state.description || undefined,
        }),
      });
      if (isMountedRef.current) dispatch({ type: 'SET_SAVE_STATUS', status: 'saved' });
    } catch {
      if (isMountedRef.current) dispatch({ type: 'SET_SAVE_STATUS', status: 'error' });
    }
  }, [dashboardId, state.layoutData, state.title, state.description]);

  useEffect(() => {
    if (state.saveStatus !== 'unsaved') return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(), 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [state.saveStatus, doSave]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); dispatch({ type: 'UNDO' }); }
      else if (mod && e.key === 'z' && e.shiftKey) { e.preventDefault(); dispatch({ type: 'REDO' }); }
      else if (mod && e.key === 'y') { e.preventDefault(); dispatch({ type: 'REDO' }); }
      else if (mod && e.key === 's') { e.preventDefault(); doSave(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [doSave]);

  const addWidget = useCallback((type: WidgetType) => {
    const entry = WIDGET_REGISTRY[type];
    if (!entry) return;
    const id = `widget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const widget: WidgetInstance = { id, type, title: entry.label, config: {} };
    const maxY = state.layoutData.gridLayouts.lg.reduce((max, l) => Math.max(max, l.y + l.h), 0);
    const gridItem: GridLayoutItem = {
      i: id, x: 0, y: maxY,
      w: entry.defaultSize.w, h: entry.defaultSize.h,
      minW: entry.minSize.w, minH: entry.minSize.h,
    };
    dispatch({ type: 'ADD_WIDGET', widget, gridItem });
  }, [state.layoutData.gridLayouts.lg]);

  const removeWidget = useCallback((widgetId: string) => dispatch({ type: 'REMOVE_WIDGET', widgetId }), []);
  const updateWidget = useCallback((widgetId: string, updates: Partial<WidgetInstance>) => dispatch({ type: 'UPDATE_WIDGET', widgetId, updates }), []);
  const updateLayouts = useCallback((layouts: { lg: GridLayoutItem[]; md: GridLayoutItem[]; sm: GridLayoutItem[] }) => dispatch({ type: 'UPDATE_LAYOUTS', layouts }), []);
  const setTitle = useCallback((title: string) => dispatch({ type: 'SET_TITLE', title }), []);
  const setDescription = useCallback((description: string) => dispatch({ type: 'SET_DESCRIPTION', description }), []);
  const toggleEditMode = useCallback(() => dispatch({ type: 'SET_EDIT_MODE', isEditMode: !state.isEditMode }), [state.isEditMode]);
  const selectWidget = useCallback((widgetId: string | null) => dispatch({ type: 'SET_SELECTED_WIDGET', widgetId }), []);
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);
  const forceSave = useCallback(() => doSave(), [doSave]);

  return (
    <DashboardContext.Provider value={{
      state, canUndo: reducerState.past.length > 0, canRedo: reducerState.future.length > 0,
      addWidget, removeWidget, updateWidget, updateLayouts, setTitle, setDescription,
      toggleEditMode, selectWidget, undo, redo, forceSave,
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}
