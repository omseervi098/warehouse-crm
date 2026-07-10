import { useState, useMemo, useEffect } from 'react';

type SortDirection = 'asc' | 'desc';

export interface SortConfig<T> {
  key: keyof T;
  direction: SortDirection;
}

// Default date range: empty (no default dates)
const defaultStartDate = '';
const defaultEndDate = '';

const ITEMS_PER_PAGE = 10;

export function useSortableData<T>(
  data: T[], 
  defaultSortConfig: SortConfig<T> | null = null,
  searchableKeys: (keyof T)[] = [],
  options: { 
    paginate?: boolean;
  } = {}
) {
  const { paginate = true } = options;
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(defaultSortConfig);
  const [filterQuery, setFilterQuery] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: defaultStartDate,
    endDate: defaultEndDate
  });
  const [currentPage, setCurrentPage] = useState(1);

  const processedItems = useMemo(() => {
    let processableData = [...data];

    // Date range filtering
    if (dateRange.startDate || dateRange.endDate) {
      processableData = processableData.filter(item => {
        const itemDate = (item as any).date; // Assuming the date field is named 'date'
        if (!itemDate) return true; // Skip if no date field
        
        const itemDateObj = new Date(itemDate);
        const startDateObj = dateRange.startDate ? new Date(dateRange.startDate) : null;
        const endDateObj = dateRange.endDate ? new Date(dateRange.endDate) : null;
        
        if (startDateObj && itemDateObj < startDateObj) return false;
        if (endDateObj) {
          // Include the entire end date (up to 23:59:59.999)
          const endOfDay = new Date(endDateObj);
          endOfDay.setHours(23, 59, 59, 999);
          if (itemDateObj > endOfDay) return false;
        }
        return true;
      });
    }

    // Party filtering
    if (partyFilter) {
      processableData = processableData.filter(item => (item as any).partyId === partyFilter);
    }

    // Item filtering
    if (itemFilter) {
      processableData = processableData.filter(item => (item as any).itemId === itemFilter);
    }

    // Text search filtering
    if (filterQuery && searchableKeys.length > 0) {
      const lowercasedQuery = filterQuery.toLowerCase();
      processableData = processableData.filter(item => {
        return searchableKeys.some(key => {
          const value = item[key];
          if (Array.isArray(value)) {
            return value.join(', ').toLowerCase().includes(lowercasedQuery);
          }
          return value?.toString().toLowerCase().includes(lowercasedQuery);
        });
      });
    }

    // Sorting
    if (sortConfig) {
      processableData.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (Array.isArray(aVal) && Array.isArray(bVal)) {
          const aString = aVal.join(', ');
          const bString = bVal.join(', ');
          return sortConfig.direction === 'asc' ? aString.localeCompare(bString, undefined, {numeric: true}) : bString.localeCompare(aString, undefined, {numeric: true});
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
             return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal, undefined, {numeric: true}) : bVal.localeCompare(aVal, undefined, {numeric: true});
        }
        
        if (aVal < bVal) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return processableData;
  }, [data, filterQuery, partyFilter, itemFilter, sortConfig, searchableKeys]);

  useEffect(() => {
    // Reset to page 1 if filters change and the current page becomes invalid.
    if (!paginate) return;
    const totalPages = Math.ceil(processedItems.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(1);
    }
  }, [processedItems.length, currentPage, paginate]);


  const paginatedData = useMemo(() => {
    const totalItems = processedItems.length;

    if (!paginate) {
      return {
        items: processedItems,
        pagination: {
          currentPage: 1,
          setCurrentPage: () => {}, // No-op for non-paginated views
          totalPages: 1,
          totalItems,
          itemsPerPage: totalItems,
        }
      };
    }

    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    
    return {
      items: processedItems.slice(startIndex, endIndex),
      pagination: {
        currentPage,
        setCurrentPage,
        totalPages,
        totalItems,
        itemsPerPage: ITEMS_PER_PAGE
      }
    };
  }, [processedItems, currentPage, paginate]);


  const requestSort = (key: keyof T) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1); // Reset page on sort
  };

  // Update date range
  const setStartDate = (date: string) => {
    setDateRange(prev => ({
      ...prev,
      startDate: date
    }));
    setCurrentPage(1); // Reset to first page on filter change
  };

  const setEndDate = (date: string) => {
    setDateRange(prev => ({
      ...prev,
      endDate: date
    }));
    setCurrentPage(1); // Reset to first page on filter change
  };

  return { 
    items: paginatedData.items,
    pagination: paginatedData.pagination,
    processedItems,
    requestSort, 
    sortConfig, 
    filterQuery, 
    setFilterQuery,
    partyFilter, 
    setPartyFilter,
    itemFilter,
    setItemFilter,
    dateRange,
    setStartDate,
    setEndDate
  };
}