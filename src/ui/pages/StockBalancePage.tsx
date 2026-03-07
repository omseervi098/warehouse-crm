import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import PageHeader from '../components/common/PageHeader';
import Pagination from '../components/common/Pagination';
import EmailReportModal from '../components/email/EmailReportModal';
import StockBalanceTable from "../components/stocks/StockBalanceTable";
import TransactionFilters from "../components/transactions/TransactionFilters.tsx";
import TransactionTypeBadge from '../components/transactions/TransactionTypeBadge';
import { useAppContext } from '../contexts/AppContext';
import { useNotify } from '../hooks/useNotify';
import { useTheme } from '../hooks/useTheme';
import { SortConfig, StockBalance } from '../types';
import { stockBalanceApi } from "../utils/api";
import { downloadStockReportPdf, downloadStocksReportPdf } from '../utils/exportpdf';
import { getDisplayLotNumber } from '../utils/lotNumber';
const ExportIcon = () => <svg xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4 mr-1.5" fill="none"
    viewBox="0 0 24 24" stroke="currentColor"
    strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
</svg>;

const EmailIcon = () => <svg xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4 mr-1.5" fill="none"
    viewBox="0 0 24 24" stroke="currentColor"
    strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
</svg>;

const StockBalancePage: React.FC = () => {
    const { theme } = useTheme();
    const {
        stockBalances,
        errorStockBalances,
        stockBalancePagination,
        loadingStockBalances,
        fetchStockBalances,
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

    // Pagination state
    const [currentPage, setCurrentPage] = useState(0);
    const itemsPerPage = 25;
    // Sorting state (stock balance table)
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        key: 'earliestEntryAt',
        direction: 'desc',
    });

    // Modal + transactions state
    const [isTxnModalOpen, setIsTxnModalOpen] = useState(false);
    const [selectedBalance, setSelectedBalance] = useState<StockBalance | null>(null);
    const [loadingTransactions, setLoadingTransactions] = useState(false);

    // Email modal state
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    // Build API parameters
    const apiParams = useMemo(() => {
        const params: any = {
            page: currentPage,
            limit: itemsPerPage,
            sort: sortConfig.key,
            order: sortConfig.direction,
            filters: {},
            rangeFilters: {
                earliestEntryAt: {}
            }
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
            if (nilStockIncluded === 'onlyNil') {
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
            // if only nill stock is selected, then we should filter by latestEntryAt
            if (nilStockIncluded === 'onlyNil') {
                params.rangeFilters.latestEntryAt = params.rangeFilters.latestEntryAt || {};
                params.rangeFilters.latestEntryAt.from = dateRange.startDate;
            } else {
                params.rangeFilters.earliestEntryAt = params.rangeFilters.earliestEntryAt || {};
                params.rangeFilters.earliestEntryAt.from = dateRange.startDate;
            }
        }
        if (dateRange.endDate) {
            if (nilStockIncluded === 'onlyNil') {
                params.rangeFilters.latestEntryAt = params.rangeFilters.latestEntryAt || {};
                params.rangeFilters.latestEntryAt.to = dateRange.endDate;
            } else {
                params.rangeFilters.earliestEntryAt = params.rangeFilters.earliestEntryAt || {};
                params.rangeFilters.earliestEntryAt.to = dateRange.endDate;
            }
        }

        return params;
    }, [currentPage, itemsPerPage, filterQuery, partyFilter, itemFilter, nilStockIncluded, storeFilter, dateRange, sortConfig.key, sortConfig.direction]);

    // Fetch data whenever params change
    useEffect(() => {
        if (errorStockBalances) {
            notify({ type: 'error', message: errorStockBalances });
            return;
        }
        fetchStockBalances(apiParams);
    }, [fetchStockBalances, apiParams, errorStockBalances]);

    // Reset to first page when filters change
    useEffect(() => {
        setCurrentPage(0);
    }, [filterQuery, partyFilter, itemFilter, dateRange]);

    // Sorting function (stock balance table)
    const requestSort = useCallback((key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
        setCurrentPage(0); // Reset to first page when sorting changes
    }, [sortConfig.key, sortConfig.direction]);

    // Pagination handlers
    const handlePageChange = useCallback((page: number) => {
        setCurrentPage(page);
    }, []);

    // // Clear all filters
    // const clearFilters = useCallback(() => {
    //     setFilterQuery('');
    //     setPartyFilter('');
    //     setItemFilter('');
    //     setDateRange({ startDate: '', endDate: '' });
    //     setCurrentPage(0);
    // }, []);

    const handleExport = async () => {
        if (stockBalances && stockBalances.length > 0) {
            const partyName = partyFilter ? (parties.find(p => p._id === partyFilter)?.name || '') : 'All Parties';
            const itemName = itemFilter ? (items.find(i => i._id === itemFilter)?.name || '') : 'All Items';
            await downloadStocksReportPdf(stockBalances, partyName, itemName, nilStockIncluded, storeFilter, [dateRange.startDate ? new Date(dateRange.startDate) : null, dateRange.endDate ? new Date(dateRange.endDate) : null]);
            notify({ type: 'success', message: 'Exported successfully.' });
        } else {
            notify({ type: 'error', message: 'No data to export.' });
        }
    }

    // Open modal and fetch transactions for a lot
    const openTransactionsModal = useCallback(async (balance: StockBalance) => {
        setIsTxnModalOpen(true);
        setLoadingTransactions(true);
        try {
            const res = await stockBalanceApi.getById(balance._id);
            const data = res.data;
            if (!data)
                return;
            setSelectedBalance(data)
        } catch (e) {
            console.error('Failed to fetch transactions for lot:', balance.lotNumber, e);
            setLoadingTransactions(false)
        } finally {
            setLoadingTransactions(false);
        }
    }, []);

    const closeTransactionsModal = useCallback(() => {
        setIsTxnModalOpen(false);
        setSelectedBalance(null);
    }, []);



    const handleStockExport = () => {
        if (!selectedBalance) {
            return;
        }
        downloadStockReportPdf(selectedBalance)
    }
    return (
        <div>
            <PageHeader title="Current Stock Balance">
                <div className="flex gap-2">
                    <Button onClick={() => setIsEmailModalOpen(true)} variant="secondary">
                        <EmailIcon /> Email Monthly Report
                    </Button>
                    <Button onClick={handleExport} variant="secondary">
                        <ExportIcon /> Download Pdf
                    </Button>
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
            {!stockBalances || stockBalances.length === 0 ? (
                <div
                    className="text-center py-12 px-6 bg-white rounded-xl border-2 border-dashed border-slate-200">
                    <svg xmlns="http://www.w3.org/2000/svg"
                        className="mx-auto h-12 w-12 text-slate-400"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        strokeWidth="1">
                        <path strokeLinecap="round" strokeLinejoin="round"
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M5 3a2 2 0 00-2 2v2a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H5z" />
                    </svg>
                    <h3 className="mt-4 text-lg font-medium text-slate-800">No
                        stock available</h3>
                    <p className="mt-1 text-sm text-slate-500">Record inward
                        entries to see stock balances.</p>
                </div>
            ) : (
                <>
                    <div className=" ">
                        <StockBalanceTable
                            stockBalances={stockBalances}
                            sortConfig={sortConfig}
                            requestSort={requestSort}
                            loading={loadingStockBalances}
                            onRowClick={openTransactionsModal}
                        />

                        {/* Pagination */}
                        {!loadingStockBalances && stockBalances.length > 0 && (
                            <div className="border-t border-slate-200 px-4 py-3">
                                <Pagination
                                    currentPage={stockBalancePagination.page}
                                    totalItems={stockBalancePagination.total}
                                    itemsPerPage={stockBalancePagination.limit}
                                    onPageChange={handlePageChange}
                                    totalPages={Math.ceil(stockBalancePagination.total / stockBalancePagination.limit)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Transactions Modal */}
                    <Modal
                        isOpen={isTxnModalOpen}
                        onClose={closeTransactionsModal}
                        title='Stock Report'
                        size="6xl"
                        footer={
                            <Button variant="secondary" onClick={handleStockExport}>
                                <ExportIcon />
                                &nbsp;Download Pdf
                            </Button>
                        }
                    >
                        {selectedBalance && (
                            <div className="space-y-2">
                                {loadingTransactions ? (
                                    <div className="flex justify-center items-center py-10">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Stock Balance Details Card */}
                                        <div className={`mb-4 p-4 rounded-lg border ${theme.border.primary} ${theme.bg.secondary} grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm`}>
                                            <div>
                                                <div className="font-semibold text-[11px] uppercase text-gray-500">Party</div>
                                                <div className="font-bold">{selectedBalance.party?.name || '-'}</div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-[11px] uppercase text-gray-500">Item</div>
                                                <div className="font-bold">{selectedBalance.item?.name || '-'}</div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-[11px] uppercase text-gray-500">Category</div>
                                                <div>{selectedBalance.item?.category || '-'}</div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-[11px] uppercase text-gray-500">Lot Number</div>
                                                <div>{getDisplayLotNumber(selectedBalance.lotNumber)}</div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-[11px] uppercase text-gray-500">Packing</div>
                                                <div>{selectedBalance.unit?.name || '-'}</div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-[11px] uppercase text-gray-500">Warehouses</div>
                                                <div>{selectedBalance.warehouses?.map(w => w.name).join(', ') || '-'}</div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-[11px] uppercase text-gray-500">Remaining Quantity</div>
                                                <div>{selectedBalance.quantity ?? '-'}</div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-[11px] uppercase text-gray-500">Inward Dates</div>
                                                <div>{selectedBalance.inwardDates.map((date) => date.split('T')[0].split('-').reverse().join('/')).join(', ')}</div>
                                            </div>
                                            {selectedBalance.isNil && selectedBalance.latestEntryAt && (
                                                <div>
                                                    <div className="font-semibold text-[11px] uppercase text-gray-500 text-red-500">Nil Date</div>
                                                    <div className="text-red-500 font-semibold">{new Date(selectedBalance.latestEntryAt).toLocaleDateString('en-GB')}</div>
                                                </div>
                                            )}
                                            {selectedBalance.chargeable && (
                                                <div>
                                                    <div className="font-semibold text-[11px] uppercase text-gray-500">Rate</div>
                                                    <div>₹ {(selectedBalance.unit.rate ?? 0).toFixed(2)}</div>
                                                </div>
                                            )}
                                        </div>
                                        <div className={`responsive-table-wrapper text-xs rounded-md border ${theme.border.primary} ${theme.bg.card}`}>
                                            <table className={`min-w-full divide-y ${theme.border.primary}`}>
                                                <thead className={`bg-gradient-to-r ${theme.bg.secondary} to-${theme.bg.secondary}/80 border-b ${theme.border.secondary}`}>
                                                    <tr className={`hover:${theme.bg.hover} transition-colors duration-150`}>
                                                        <th className={`px-3 py-2 text-left text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide ${theme.border.primary} border-r`}>Date</th>
                                                        <th className={`px-3 py-2 text-left text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide ${theme.border.primary} border-r`}>Type</th>
                                                        <th className={`px-3 py-2 text-right text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide ${theme.border.primary} border-r`}>Vehicle</th>
                                                        <th className={`px-3 py-2 text-right text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide ${theme.border.primary} border-r`}>DO Number</th>
                                                        <th className={`px-3 py-2 text-right text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide ${theme.border.primary} border-r`}>Qty</th>
                                                        <th className={`px-3 py-2 text-right text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide ${theme.border.primary} border-r`}>Shortage</th>
                                                        <th className={`px-3 py-2 text-right text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide ${theme.border.primary} border-r`}>Extra</th>
                                                        <th className={`px-3 py-2 text-right text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide ${theme.border.primary} border-r`}>Remarks</th>
                                                        <th className={`px-3 py-2 text-right text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide`}>Balance</th>
                                                    </tr>
                                                </thead>
                                                <tbody className={`divide-y ${theme.border.primary}`}>
                                                    {selectedBalance.transactions.map((row: any, idx: number) => {
                                                        return (
                                                            <tr key={idx} className={`group hover:${theme.bg.hover} transition-all duration-150 ease-in-out border-b ${theme.border.primary} last:border-0 text-sm`}>
                                                                <td className={`px-3 py-2 ${theme.text.primary} ${theme.border.primary} border-r`}>
                                                                    <div className="whitespace-nowrap">
                                                                        <p>
                                                                            {new Date(row.enteredAt).toLocaleString(
                                                                                "en-GB",
                                                                                {
                                                                                    timeZone: 'UTC',
                                                                                    day: '2-digit', month: '2-digit', year: 'numeric'
                                                                                }
                                                                            ).split(', ')[0]}
                                                                        </p>
                                                                        <p className="text-[10px] opacity-70">
                                                                            {new Date(row.enteredAt).toLocaleTimeString(
                                                                                "en-GB", {
                                                                                timeZone: 'UTC',
                                                                                hour: '2-digit', minute: '2-digit', hour12: true
                                                                            }).toUpperCase()}
                                                                        </p>
                                                                    </div>
                                                                </td>

                                                                <td className={`px-3 py-2 font-semibold ${theme.text.primary} ${theme.border.primary} border-r`}>
                                                                    <span className="inline-flex items-center">
                                                                        <TransactionTypeBadge type={row.type} />
                                                                    </span>
                                                                </td>
                                                                <td className={`px-3 py-2 text-right ${theme.text.secondary} ${theme.border.primary} border-r`}>{row.vehicleNumber || '-'}</td>
                                                                <td className={`px-3 py-2 text-right ${theme.text.secondary} ${theme.border.primary} border-r`}>{row.doNumber || '-'}</td>
                                                                <td className={`px-3 py-2 text-right ${theme.text.primary} ${theme.border.primary} border-r`}>{row.quantity}</td>
                                                                <td className={`px-3 py-2 text-right font-semibold ${theme.border.primary} border-r`}>
                                                                    <span className='text-red-500'>{row.shortage}</span>
                                                                </td>

                                                                <td className={`px-3 py-2 text-right font-semibold ${theme.border.primary}  border-r`}>
                                                                    <span className='text-green-500'>{row.extra}</span>
                                                                </td>
                                                                <td className={`px-3 py-2 text-right ${theme.text.secondary} ${theme.border.primary} border-r`}>{row.remark || '-'}</td>
                                                                <td className={`px-3 py-2 text-right font-semibold`}>
                                                                    <span className='text-accent'>{row.balance}</span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot className={`${theme.bg.secondary} border-t ${theme.border.primary} text-sm`}>
                                                    <tr className={`font-medium`}>
                                                        <td className={`px-3 py-2 ${theme.text.primary}`} colSpan={8}>Total</td>
                                                        <td className={`px-3 py-2 text-right font-bold text-accent`}>
                                                            {selectedBalance.quantity}
                                                        </td>
                                                        <td />
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>

                                        {selectedBalance.transactions.length === 0 && (
                                            <div className="py-6 text-sm opacity-70">No Stock Report available.</div>
                                        )}


                                    </>
                                )}
                            </div>
                        )}
                    </Modal>
                </>
            )}

            {/* Email Report Modal */}
            <EmailReportModal
                isOpen={isEmailModalOpen}
                onClose={() => setIsEmailModalOpen(false)}
                reportType="monthly"
                parties={parties}
            />
        </div>
    );
};

export default StockBalancePage;
