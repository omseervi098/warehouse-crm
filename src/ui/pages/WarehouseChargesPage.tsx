
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import PageHeader from '../components/common/PageHeader';
import Pagination from '../components/common/Pagination';
import { SortIndicator } from '../components/common/Table';
import TransactionFilters from '../components/transactions/TransactionFilters';
import { useAppContext } from '../contexts/AppContext';
import { useNotify } from '../hooks/useNotify';
import { useTheme } from '../hooks/useTheme';
import { Charge } from '../types';
import { chargesApi } from '../utils/api';
import { downloadChargeReportPdf, downloadChargesReportPdf } from '../utils/exportpdf';
import { getDisplayLotNumber } from '../utils/lotNumber';
const ExportIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const WarehouseChargesPage: React.FC = () => {
  const { theme } = useTheme();
  const {
    charges,
    errorCharges,
    chargesPagination,
    loadingCharges,
    fetchCharges,
    parties,
    items,
  } = useAppContext();

  const notify = useNotify();
  const [filterQuery, setFilterQuery] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [nilStockIncluded, setNilStockIncluded] = useState<string>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 25;

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>(
    { key: 'earliestEntryAt', direction: 'desc' }
  );

  const apiParams = useMemo(() => {
    const onlyNil = nilStockIncluded === 'onlyNil';
    const params: any = {
      page: currentPage,
      limit: itemsPerPage,
      sort: onlyNil ? 'latestEntryAt' : sortConfig.key,
      order: onlyNil ? 'asc' : sortConfig.direction,
      filters: {},
      rangeFilters: {}
    };

    if (filterQuery.trim()) {
      params.search = filterQuery.trim();
    }

    if (partyFilter) {
      params.filters['party'] = partyFilter;
    }

    if (itemFilter) {
      params.filters['item'] = itemFilter;
    }

    if (nilStockIncluded && nilStockIncluded !== 'all') {
      if (onlyNil) {
        params.filters['isNil'] = true;
      }
      else if (nilStockIncluded === 'withoutNil') {
        params.filters['isNil'] = false;
      }
    }
    if (storeFilter && storeFilter !== 'all') {
      if (storeFilter === 'onlyStored') {
        params.filters['chargeable'] = true;
      }
      else if (storeFilter === 'withoutStored') {
        params.filters['chargeable'] = false;
      }
    }

    if (dateRange.startDate) {
      if (onlyNil) {
        params.rangeFilters.latestEntryAt = params.rangeFilters.latestEntryAt || {};
        params.rangeFilters.latestEntryAt.from = dateRange.startDate;
      } else {
        params.rangeFilters.earliestEntryAt = params.rangeFilters.earliestEntryAt || {};
        params.rangeFilters.earliestEntryAt.from = dateRange.startDate;
      }
    }
    if (dateRange.endDate) {
      if (onlyNil) {
        params.rangeFilters.latestEntryAt = params.rangeFilters.latestEntryAt || {};
        params.rangeFilters.latestEntryAt.to = dateRange.endDate;
      } else {
        params.rangeFilters.earliestEntryAt = params.rangeFilters.earliestEntryAt || {};
        params.rangeFilters.earliestEntryAt.to = dateRange.endDate;
      }
    }

    return params;
  }, [currentPage, itemsPerPage, filterQuery, partyFilter, itemFilter, nilStockIncluded, storeFilter, dateRange, sortConfig.key, sortConfig.direction]);

  useEffect(() => {
    if (errorCharges) {
      notify({ type: 'error', message: errorCharges });
      return;
    }
    fetchCharges(apiParams);
  }, [fetchCharges, apiParams, errorCharges]);

  useEffect(() => {
    setCurrentPage(0);
  }, [filterQuery, partyFilter, itemFilter, dateRange]);

  const requestSort = useCallback((key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(0);
  }, [sortConfig.key, sortConfig.direction]);


  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const grandTotal = useMemo(() => {
    // Use aggregation data from backend response instead of calculating from current page
    return chargesPagination?.aggregation?.grandTotal || 0;
  }, [chargesPagination]);


  // Modal + transactions state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCharge, setSelectedCharge] = useState<Charge | null>(null);

  const openModalForCharge = useCallback(async (c: Charge) => {
    try {
      // Use lot number instead of ID since the ID might be from Charge collection
      // but the endpoint expects to find it in Stock collection
      const { data: detailedCharge } = await chargesApi.getById(c.lotNumber);
      setSelectedCharge(detailedCharge);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error fetching charge details:', error);
      notify({ type: 'error', message: 'Failed to load charge details' });
      // Fallback to using the list data
      setSelectedCharge(c);
      setIsModalOpen(true);
    }
  }, [notify]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedCharge(null);
  }, []);

  const handleChargeExport = useCallback(() => {
    if (!selectedCharge) return;
    downloadChargeReportPdf(selectedCharge);
  }, [selectedCharge]);

  const handleChargesExport = useCallback(async () => {
    //if party filter not applied, then notify
    if (!partyFilter) {
      notify({ type: 'error', message: 'Party Not Selected' });
      return;
    }
    if (nilStockIncluded !== 'onlyNil') {
      notify({ type: 'error', message: 'Nil Stock Not Selected' });
      return;
    }

    let toastId: string | undefined;
    try {
      const exportParams = {
        ...apiParams,
        page: 0,
        limit: 1000000,
        sort: 'latestEntryAt',
        order: 'asc' as const,
      };

      toastId = notify({ type: 'loading', message: 'Preparing export...' });

      const { data } = await chargesApi.getAll(exportParams);
      const allCharges = [...(data.results || [])].sort((a, b) => {
        const ta = a.latestEntryAt ? new Date(a.latestEntryAt).getTime() : 0;
        const tb = b.latestEntryAt ? new Date(b.latestEntryAt).getTime() : 0;
        return ta - tb;
      });

      if (allCharges.length === 0) {
        notify({ type: 'error', message: 'No charges found to export', id: toastId });
        return;
      }

      const partyName = partyFilter ? (parties.find(p => p._id === partyFilter)?.name || '') : 'All Parties';
      await downloadChargesReportPdf(allCharges, partyName, [dateRange.startDate ? new Date(dateRange.startDate) : null, dateRange.endDate ? new Date(dateRange.endDate) : null]);

      notify({ type: 'success', message: 'Export completed', id: toastId });
    } catch (error) {
      console.error('Export failed:', error);
      notify({ type: 'error', message: 'Failed to export charges', id: toastId });
    }
  }, [partyFilter, nilStockIncluded, parties, dateRange, apiParams, notify]);

  return (
    <div>
      <PageHeader title="Warehouse Charges">
        <div className="flex space-x-2">
          {(charges || []).length > 0 && (
            <Button variant="secondary" onClick={handleChargesExport}>
              <ExportIcon /> Export
            </Button>
          )}
        </div>
      </PageHeader>

      <TransactionFilters
        filterQuery={filterQuery}
        setFilterQuery={setFilterQuery}
        partyFilter={partyFilter}
        setPartyFilter={setPartyFilter}
        itemFilter={itemFilter}
        setItemFilter={setItemFilter}
        dateRange={dateRange}
        setStartDate={(d) => setDateRange(prev => ({ ...prev, startDate: d }))}
        setEndDate={(d) => setDateRange(prev => ({ ...prev, endDate: d }))}
        parties={parties}
        items={items}
        nilStockIncluded={nilStockIncluded}
        setNilStockIncluded={setNilStockIncluded}
        storeFilter={storeFilter}
        setStoreFilter={setStoreFilter}
      />

      {/* Table */}
      <div className={`responsive-table-wrapper ${theme.bg.card} border ${theme.border.primary} rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 text-xs`}>
        <div className=" rounded-xl">
          <table className={`min-w-full divide-y ${theme.border.primary} responsive-table border-collapse border ${theme.border.primary}`}>
            <thead className={`bg-gradient-to-r ${theme.bg.secondary} to-${theme.bg.secondary}/80 border-b ${theme.border.secondary}`}>
              <tr className={`hover:${theme.bg.hover} transition-colors duration-150`}>
                <th onClick={() => requestSort('earliestEntryAt')} className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}>
                  <div className="flex items-center">Inward Dates  <SortIndicator direction={sortConfig?.key === 'earliestEntryAt' ? sortConfig.direction : null} /></div>
                </th>
                <th onClick={() => requestSort('party.name')} className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}>
                  <div className="flex items-center">Party  <SortIndicator direction={sortConfig?.key === 'party.name' ? sortConfig.direction : null} /></div>
                </th>
                <th onClick={() => requestSort('item.name')} className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}>
                  <div className="flex items-center">Item  <SortIndicator direction={sortConfig?.key === 'item.name' ? sortConfig.direction : null} /></div>
                </th>
                <th onClick={() => requestSort('item.category')} className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}>
                  <div className="flex items-center">Category  <SortIndicator direction={sortConfig?.key === 'item.category' ? sortConfig.direction : null} /></div>
                </th>
                <th onClick={() => requestSort('lotNumber')} className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}>
                  <div className="flex items-center">Lot Number  <SortIndicator direction={sortConfig?.key === 'lotNumber' ? sortConfig.direction : null} /></div>
                </th>
                <th onClick={() => requestSort('quantity')} className={`px-3 py-2 text-xs font-medium ${theme.text.muted} uppercase tracking-wider cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 text-right border-r ${theme.border.primary}`}>
                  <div className="flex items-center justify-end">Current Stock  <SortIndicator direction={sortConfig?.key === 'quantity' ? sortConfig.direction : null} /></div>
                </th>
                <th className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150`}>
                  <div className="flex items-center">Charges (₹) </div>
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${theme.border.primary}`}>
              {loadingCharges ? (
                <tr><td colSpan={7} className={`px-3 py-6 text-center ${theme.text.muted}`}>Loading charges...</td></tr>
              ) : (charges || []).length === 0 ? (
                <tr><td colSpan={7} className={`px-3 py-6 text-center ${theme.text.muted}`}>No records found</td></tr>
              ) : (
                (charges || []).map((c: any) => (
                  <tr key={c._id} className={`group hover:${theme.bg.hover} transition-all duration-150 ease-in-out cursor-pointer border-b ${theme.border.primary} last:border-0 text-xs`} onClick={() => openModalForCharge(c)}>
                    <td className={`px-3 py-2 whitespace-nowrap text-xs ${theme.text.secondary} border-r ${theme.border.primary}`} data-label="Inward Dates" >
                      <div>
                        {c.inwardDates.map((date: string) => date.split('T')[0].split('-').reverse().join('/')).join(', ')}
                        {c.isNil && c.latestEntryAt && (
                          <div className="text-[10px] text-red-500 mt-1 font-semibold">
                            Nil Date: {new Date(c.latestEntryAt).toLocaleDateString('en-GB')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className={`px-3 py-2 whitespace-nowrap text-xs ${theme.text.primary} font-medium border-r ${theme.border.primary}`} title={c.party?.name} data-label={"Party Name"}>{c.party?.name}</td>
                    <td className={`px-3 py-2 whitespace-nowrap text-xs font-semibold ${theme.text.primary} border-r ${theme.border.primary}`} title={c.item?.name} data-label={"Item Name"} >{c.item?.name}</td>
                    <td className={`px-3 py-2 whitespace-nowrap text-xs ${theme.text.secondary} border-r ${theme.border.primary}`} data-label={"Item Category"}>{c.item?.category || 'N/A'}</td>
                    <td className={`px-3 py-2 whitespace-nowrap text-xs ${theme.text.secondary} border-r ${theme.border.primary}`} data-label="Lot No.">{getDisplayLotNumber(c.lotNumber)}</td>
                    <td className={`px-3 py-2 whitespace-nowrap text-xs ${theme.text.primary} font-medium text-right border-r ${theme.border.primary}`} data-label="Current Stock">
                      <div className={`inline-flex items-center justify-end min-w-[60px] px-2.5 py-1 rounded-md ${theme.bg.secondary} group-hover:${theme.bg.tertiary} transition-colors duration-150`}>
                        <span className={theme.text.primary}>{c.quantity}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-accent" data-label="Charges">₹{(c.charge ?? 0).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className={`${theme.bg.secondary} border-t ${theme.border.primary}`}>
              <tr>
                <td colSpan={6} className={`px-3 py-2 text-right text-sm font-bold ${theme.text.primary}`}>
                  <div className="flex flex-col items-end">
                    <div>Grand Total</div>
                    {chargesPagination?.aggregation && (
                      <div className="text-xs text-gray-500">
                        {chargesPagination.aggregation.chargeableCount} chargeable lots •
                        Showing {(charges || []).length} of {chargesPagination.total} records
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-left text-sm font-bold text-accent">₹{grandTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {/* Pagination */}
        {!loadingCharges && (charges || []).length > 0 && (
          <div className={`border-t ${theme.border.primary} px-4 py-3`}>
            <Pagination
              currentPage={chargesPagination.page}
              totalItems={chargesPagination.total}
              itemsPerPage={chargesPagination.limit}
              onPageChange={handlePageChange}
              totalPages={Math.ceil(chargesPagination.total / chargesPagination.limit)}
            />
          </div>
        )}
      </div>

      {/* Breakdown Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={`Charges`}
        size='6xl'
      >

        {selectedCharge &&
          <>
            <div className={`mb-4 p-4 rounded-lg border ${theme.border.primary} ${theme.bg.secondary} grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm`}>
              <div>
                <div className="font-semibold text-[11px] uppercase text-gray-500">Party</div>
                <div className="font-bold">{selectedCharge.party?.name || '-'}</div>
              </div>
              <div>
                <div className="font-semibold text-[11px] uppercase text-gray-500">Item</div>
                <div className="font-bold">{selectedCharge.item?.name || '-'}</div>
              </div>
              <div>
                <div className="font-semibold text-[11px] uppercase text-gray-500">Category</div>
                <div>{selectedCharge.item?.category || '-'}</div>
              </div>
              <div>
                <div className="font-semibold text-[11px] uppercase text-gray-500">Lot Number</div>
                <div>{getDisplayLotNumber(selectedCharge.lotNumber)}</div>
              </div>
              <div>
                <div className="font-semibold text-[11px] uppercase text-gray-500">Packing</div>
                <div>{selectedCharge.unit?.name || '-'}</div>
              </div>
              <div>
                <div className="font-semibold text-[11px] uppercase text-gray-500">Warehouses</div>
                <div>{selectedCharge.warehouses?.map(w => w.name).join(', ') || '-'}</div>
              </div>
              <div>
                <div className="font-semibold text-[11px] uppercase text-gray-500">Remaining Quantity</div>
                <div>{selectedCharge.quantity ?? '-'}</div>
              </div>
              <div>
                <div className="font-semibold text-[11px] uppercase text-gray-500">Inward Dates</div>
                <div>{selectedCharge.inwardDates.map((date) => date.split('T')[0].split('-').reverse().join('/')).join(', ')}</div>
              </div>
              {selectedCharge.isNil && selectedCharge.latestEntryAt && (
                <div>
                  <div className="font-semibold text-[11px] uppercase text-gray-500 text-red-500">Nil Date</div>
                  <div className="text-red-500 font-semibold">{new Date(selectedCharge.latestEntryAt).toLocaleDateString('en-GB')}</div>
                </div>
              )}
              <div>
                <div className="font-semibold text-[11px] uppercase text-gray-500">Rate</div>
                <div>₹ {(selectedCharge.chargeRate ?? selectedCharge.unit.rate ?? 0).toFixed(2)}</div>
              </div>
              <div>
                <div className="font-semibold text-[11px] uppercase text-gray-500">Total Charge</div>
                <div className="font-bold text-accent">₹ {(selectedCharge.totalCharge ?? selectedCharge.charge ?? 0).toFixed(2)}</div>
              </div>
            </div>
            <div className={`responsive-table-wrapper text-xs rounded-md border ${theme.border.primary} ${theme.bg.card}`}>
              <table className={`min-w-full divide-y ${theme.border.primary}`}>
                <thead className={`bg-gradient-to-r ${theme.bg.secondary} to-${theme.bg.secondary}/80 border-b ${theme.border.secondary}`}>
                  <tr className={`hover:${theme.bg.hover} transition-colors duration-150`}>
                    <th className={`px-3 py-2 text-left text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide`}>Date</th>
                    <th className={`px-3 py-2 text-left text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide`}>Type</th>
                    <th className={`px-3 py-2 text-right text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide`}>Vehicle</th>
                    <th className={`px-3 py-2 text-right text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide`}>DO Number</th>
                    <th className={`px-3 py-2 text-right text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide`}>Qty</th>
                    <th className={`px-3 py-2 text-right text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide`}>Shortage</th>
                    <th className={`px-3 py-2 text-right text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide`}>Extra</th>
                    <th className={`px-3 py-2 text-right text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide`}>Remarks</th>
                    <th className={`px-3 py-2 text-right text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide`}>Balance</th>
                    <th className={`px-3 py-2 text-right text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide`}>Amount</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme.border.primary}`}>
                  {selectedCharge?.breakdown?.map((row: any, idx: number) => {
                    const isTxn = row.kind === 'transaction';
                    return (
                      <tr key={idx} className={`group hover:${theme.bg.hover} transition-all duration-150 ease-in-out border-b ${theme.border.primary} last:border-0 text-sm ${isTxn ? '' : theme.bg.tertiary}`}>
                        <td className={`px-3 py-2 ${theme.text.primary}`}>
                          <div className="whitespace-nowrap">
                            <p>
                              {row.date ? new Date(row.date).toLocaleString(
                                "en-GB",
                                {
                                  timeZone: 'UTC',
                                  day: '2-digit', month: '2-digit', year: 'numeric'
                                }
                              ).split(', ')[0] : '-'}
                            </p>
                            <p className="text-[10px] opacity-70">
                              {row.date ? new Date(row.date).toLocaleTimeString(
                                "en-GB", {
                                timeZone: 'UTC',
                                hour: '2-digit', minute: '2-digit', hour12: true

                              }).toUpperCase() : ''}
                            </p>
                          </div>
                        </td>

                        <td className={`px-3 py-2 font-semibold ${theme.text.primary}`}>
                          <span className={`inline-block px-2 py-1 rounded-md ${isTxn ? (row.type === 'INWARD' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800') : 'bg-blue-100 text-blue-800'}`}>
                            {isTxn ? row.type : row.label}
                          </span>
                        </td>
                        <td className={`px-3 py-2 text-right ${theme.text.secondary}`}>{isTxn ? (row.vehicleNumber || '-') : '-'}</td>
                        <td className={`px-3 py-2 text-right ${theme.text.secondary}`}>{isTxn ? (row.doNumber || '-') : '-'}</td>
                        <td className={`px-3 py-2 text-right ${theme.text.primary}`}>{isTxn ? row.quantity : '-'}</td>
                        <td className={`px-3 py-2 text-right ${theme.text.primary}`}>{isTxn ? row.shortage : '-'}</td>
                        <td className={`px-3 py-2 text-right ${theme.text.primary}`}>{isTxn ? row.extra : '-'}</td>
                        <td className={`px-3 py-2 text-right ${theme.text.secondary}`}>{isTxn ? (row.remark || '-') : '-'}</td>
                        <td className={`px-3 py-2 text-right font-semibold text-blue-500`}>{isTxn ? row.balance : row.balanceAtBoundary}</td>
                        <td className={`px-3 py-2 text-right font-semibold text-accent`}>{isTxn ? '-' : `₹ ${(row.amount ?? 0).toFixed(2)}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className={`${theme.bg.secondary} border-t ${theme.border.primary} text-sm`}>
                  <tr className={`font-medium`}>
                    <td className={`px-3 py-2 ${theme.text.primary}`} colSpan={9}>Total</td>
                    <td className={`px-3 py-2 text-right font-bold text-accent`}>
                      ₹&nbsp; {selectedCharge ? (selectedCharge.totalCharge ?? selectedCharge.charge ?? 0).toFixed(2) : '0.00'}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {selectedCharge?.breakdown?.length === 0 && (
              <div className="py-6 text-sm opacity-70">No breakdown data available.</div>
            )}

            <div className="mt-4 flex items-center justify-end space-x-2">
              <Button
                variant="secondary"
                onClick={handleChargeExport}
                disabled={!selectedCharge.breakdown || selectedCharge.breakdown.length === 0}
              >
                <ExportIcon /> Download PDF
              </Button>

              <Button onClick={closeModal}>Close</Button>
            </div>

          </>

        }
      </Modal>
    </div>
  );
};

export default WarehouseChargesPage;
