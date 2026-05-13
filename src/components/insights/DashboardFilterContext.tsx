"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface DashboardFilters {
  platform?: string;
  dateRange?: string;  // stored as string like "7", "14", "30", "90"
}

interface DashboardFilterContextValue {
  filters: DashboardFilters;
  setFilter: (key: keyof DashboardFilters, value: string) => void;
  clearFilter: (key: keyof DashboardFilters) => void;
  clearAll: () => void;
  isFiltered: boolean;
}

const DashboardFilterContext = createContext<DashboardFilterContextValue>({
  filters: {},
  setFilter: () => {},
  clearFilter: () => {},
  clearAll: () => {},
  isFiltered: false,
});

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<DashboardFilters>({});

  const setFilter = useCallback((key: keyof DashboardFilters, value: string) => {
    setFilters(prev => {
      if (prev[key] === value) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const clearFilter = useCallback((key: keyof DashboardFilters) => {
    setFilters(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setFilters({}), []);

  const isFiltered = Object.keys(filters).length > 0;

  return (
    <DashboardFilterContext.Provider value={{ filters, setFilter, clearFilter, clearAll, isFiltered }}>
      {children}
    </DashboardFilterContext.Provider>
  );
}

export function useDashboardFilter() {
  return useContext(DashboardFilterContext);
}
