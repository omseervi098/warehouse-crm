import { CalendarIcon } from '@heroicons/react/20/solid';
import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { Item, Party } from '../../types';
import Autocomplete from '../common/Autocomplete';
import { TableFilter } from '../common/Table';

interface TransactionFiltersProps {
  filterQuery: string;
  setFilterQuery: (query: string) => void;
  partyFilter: string;
  setPartyFilter: (partyId: string) => void;
  itemFilter: string;
  setItemFilter: (itemId: string) => void;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  parties: Party[];
  items: Item[];
  nilStockIncluded?: string | undefined;
  setNilStockIncluded?: (value: string) => void | undefined;
  storeFilter?: string | undefined;
  setStoreFilter?: (value: string) => void | undefined;
}

const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  filterQuery,
  setFilterQuery,
  partyFilter,
  setPartyFilter,
  itemFilter,
  setItemFilter,
  dateRange,
  setStartDate,
  setEndDate,
  parties,
  items,
  nilStockIncluded,
  setNilStockIncluded,
  storeFilter,
  setStoreFilter
}) => {
  const { theme } = useTheme();

  // Local state for item autocomplete to allow typing search terms that don't immediately match an ID
  const [itemInputValue, setItemInputValue] = React.useState('');

  // Sync local input state with itemFilter prop changes
  React.useEffect(() => {
    const itemFromProp = items.find(i => i._id === itemFilter);

    if (itemFromProp) {
      // If an item is selected via prop, always sync the name
      if (itemFromProp.name !== itemInputValue) {
        setItemInputValue(itemFromProp.name);
      }
    } else {
      // If filter is cleared/empty
      // Only clear input if the current input matches a valid item (meaning we were selected, now deselected externally)
      // If current input is partial text (no match), leave it alone so user can keep typing
      const currentInputMatchesItem = items.some(i => i.name === itemInputValue);
      if (currentInputMatchesItem) {
        setItemInputValue('');
      }
      // Also clear if input matches nothing but we want to ensure empty start state? 
      // No, relying on above should work for "Clear" button cases.
      // Exception: if itemFilter is initial empty and input is empty.
    }
  }, [itemFilter, items]);

  return (
    <div className={`mb-4 ${theme.bg.card} p-3 rounded-xl border ${theme.border.primary}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="w-full">
          <label htmlFor="start-date" className={`block text-sm font-medium ${theme.text.secondary} mb-1`}>From Date</label>
          <div className="relative mt-1 rounded-md shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 z-10">
              <CalendarIcon className={`h-5 w-5 ${theme.text.muted}`} aria-hidden="true" />
            </div>
            <input
              type="date"
              name="start-date"
              id="start-date"
              value={dateRange.startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`block w-full rounded-lg border ${theme.border.primary} ${theme.bg.input} py-2 pl-10 pr-3 ${theme.text.primary} placeholder:${theme.text.muted} hover:${theme.border.secondary} focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm sm:leading-6`}
            />
          </div>
        </div>
        <div className="w-full">
          <label htmlFor="end-date" className={`block text-sm font-medium ${theme.text.secondary} mb-1`}>To Date</label>
          <div className="relative mt-1 rounded-md shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 z-10">
              <CalendarIcon className={`h-5 w-5 ${theme.text.muted}`} aria-hidden="true" />
            </div>
            <input
              type="date"
              name="end-date"
              id="end-date"
              value={dateRange.endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`block w-full rounded-lg border ${theme.border.primary} ${theme.bg.input} py-2 pl-10 pr-3 ${theme.text.primary} placeholder:${theme.text.muted} hover:${theme.border.secondary} focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm sm:leading-6`}
            />
          </div>
        </div>
        <div className="w-full">
          <label htmlFor="party-filter" className={`block text-sm font-medium ${theme.text.secondary} mb-1`}>Party</label>
          <select
            id="party-filter"
            name="party-filter"
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value)}
            className={`block w-full rounded-lg border ${theme.border.primary} ${theme.bg.input} py-2 px-3 ${theme.text.primary} shadow-sm hover:${theme.border.secondary} focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm sm:leading-6`}
          >
            <option value="">All Parties</option>
            {parties.map(party => (
              <option key={party._id} value={party._id}>{party.name}</option>
            ))}
          </select>
        </div>
        <div className="w-full">

          <Autocomplete
            label="Item"
            options={items.map(i => i.name)}
            value={itemInputValue}
            onChange={(name) => {
              setItemInputValue(name);
              const item = items.find(i => i.name === name);
              setItemFilter(item ? item._id : '');
            }}
            filterPage={true}
            placeholder="Select Item"
            className="w-full h-[38px]"
          />
        </div>
        <div className="w-full">
          <label htmlFor="table-filter" className={`block text-sm font-medium ${theme.text.secondary} mb-1`}>Keyword</label>
          <TableFilter
            filterQuery={filterQuery}
            setFilterQuery={setFilterQuery}
            placeholder="Filter by lot, item, vehicle, D.O. ..."
          />
        </div>
        {/* Additional filters can be added here */}
        {nilStockIncluded !== undefined && setNilStockIncluded !== undefined && (
          <div className="w-full">
            <label htmlFor="nil-filter" className={`block text-sm font-medium ${theme.text.secondary} mb-1`}>Nil Stock Filter</label>
            <select
              id="nil-filter"
              name="nil-filter"
              value={nilStockIncluded}
              onChange={(e) => setNilStockIncluded(e.target.value)}
              className={`block w-full rounded-lg border ${theme.border.primary} ${theme.bg.input} py-2 px-3 ${theme.text.primary} shadow-sm hover:${theme.border.secondary} focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm sm:leading-6`}
            >
              <option value="all">All Stock</option>
              <option value="onlyNil">Only Nil Stock</option>
              <option value="withoutNil">Without Nil Stock</option>
            </select>
          </div>
        )}
        {
          storeFilter !== undefined && setStoreFilter !== undefined && (
            <div className="w-full">
              <label htmlFor="store-filter" className={`block text-sm font-medium ${theme.text.secondary} mb-1`}>Stored Filter</label>
              <select
                id="store-filter"
                name="store-filter"
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className={`block w-full rounded-lg border ${theme.border.primary} ${theme.bg.input} py-2 px-3 ${theme.text.primary} shadow-sm hover:${theme.border.secondary} focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm sm:leading-6`}
              >
                <option value="all">All Stock</option>
                <option value="onlyStored">Only Stored Stock</option>
                <option value="withoutStored">Without Stored Stock</option>
              </select>
            </div>
          )
        }
      </div>
    </div>
  );
};

export default TransactionFilters;
