
import React from 'react';
import { SortConfig } from '../../hooks/useSortableData';
import { useTheme } from '../../hooks/useTheme';

export const SortIndicator: React.FC<{ direction: 'asc' | 'desc' | null}> = ({ direction }) => {
  const { theme } = useTheme();
  
  if (!direction) return null;
  return (
    <span className="ml-1.5 inline-flex flex-col">
      <span className={`h-1.5 w-2.5 flex items-center justify-center ${direction === 'asc' ? 'text-accent' : theme.text.muted}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-2.5 w-2.5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
        </svg>
      </span>
      <span className={`h-1.5 w-2.5 flex items-center justify-center ${direction === 'desc' ? 'text-accent' : theme.text.muted}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-2.5 w-2.5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </span>
  );
};

interface SortableThProps<T> {
  children: React.ReactNode;
  sortKey: keyof T;
  sortConfig: SortConfig<T> | null;
  requestSort: (key: keyof T) => void;
  className?: string;
  scope?: string;
}

export function SortableTh<T>({ children, sortKey, sortConfig, requestSort, className = '', scope = "col" }: SortableThProps<T>) {
  const { theme } = useTheme();
  const isSorted = sortConfig?.key === sortKey;
  
  return (
    <th
      scope={scope}
      className={`px-3 py-2 text-left text-xs font-medium ${theme.text.muted} uppercase tracking-wider cursor-pointer select-none hover:${theme.bg.hover} transition-colors ${className}`}
      onClick={() => requestSort(sortKey)}
      aria-sort={isSorted ? sortConfig.direction : 'none'}
    >
      <div className="flex items-center group">
        <span className="mr-1">{children}</span>
        <SortIndicator direction={isSorted ? sortConfig.direction : null} />
      </div>
    </th>
  );
}

interface TableFilterProps {
  filterQuery: string;
  setFilterQuery: (query: string) => void;
  placeholder?: string;
}

export const TableFilter: React.FC<TableFilterProps> = ({ filterQuery, setFilterQuery, placeholder = "Filter items..." }) => {
  const { theme } = useTheme();
  
  return (
    <div className="w-full max-w-sm">
      <label htmlFor="table-filter" className="sr-only">{placeholder}</label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <svg 
            className={`h-4 w-4 ${theme.text.muted}`}
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          id="table-filter"
          type="search"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder={placeholder}
          className={`block w-full rounded-lg border ${theme.border.primary} ${theme.bg.input} py-2 pl-10 pr-3 text-sm ${theme.text.primary} shadow-sm transition-all placeholder:${theme.text.muted} hover:${theme.border.secondary} focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none`}
        />
      </div>
    </div>
  );
};
