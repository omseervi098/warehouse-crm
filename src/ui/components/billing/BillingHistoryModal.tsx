import React, { useCallback, useEffect, useState } from 'react';
import { useNotify } from '../../hooks/useNotify';
import { useTheme } from '../../hooks/useTheme';
import { BillingHistoryItem, Party } from '../../types';
import { additionalDebitsApi, billsApi, paymentsApi } from '../../utils/api';
import { downloadBillPdf, downloadBillingHistoryPdf } from '../../utils/exportpdf';
import Button from '../common/Button';
import Modal from '../common/Modal';

interface BillingHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    party: Party | null;
}

interface FilterOptions {
    startDate: string;
    endDate: string;
    transactionType: 'all' | 'bills' | 'payments' | 'additional_debits';
}

const BillingHistoryModal: React.FC<BillingHistoryModalProps> = ({
    isOpen,
    onClose,
    party
}) => {
    const { theme } = useTheme();
    const notify = useNotify();

    // State
    const [loading, setLoading] = useState(false);
    const [historyItems, setHistoryItems] = useState<BillingHistoryItem[]>([]);
    const [filteredItems, setFilteredItems] = useState<BillingHistoryItem[]>([]);
    const [filters, setFilters] = useState<FilterOptions>({
        startDate: '',
        endDate: '',
        transactionType: 'all'
    });
    const [exporting, setExporting] = useState(false);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen && party) {
            // Set default date range to last 6 months
            const endDate = new Date();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 6);

            setFilters({
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                transactionType: 'all'
            });
            setHistoryItems([]);
            setFilteredItems([]);
            loadBillingHistory(party._id);
        }
    }, [isOpen, party]);

    // Apply filters when filters or history items change
    useEffect(() => {
        applyFilters();
    }, [historyItems, filters]);

    // Load billing history for the party
    const loadBillingHistory = useCallback(async (partyId: string) => {
        setLoading(true);
        try {
            const { data } = await paymentsApi.getBillingHistory(partyId, {
                startDate: filters.startDate,
                endDate: filters.endDate
            });



            setHistoryItems(data || []);
        } catch (error) {
            console.error('Error loading billing history:', error);
            notify({
                type: 'error',
                message: 'Failed to load billing history'
            });
            setHistoryItems([]);
        } finally {
            setLoading(false);
        }
    }, [filters.startDate, filters.endDate, notify]);

    // Apply filters to history items
    const applyFilters = useCallback(() => {
        let filtered = [...historyItems];



        // Filter by date range
        if (filters.startDate && filters.startDate.trim() !== '') {
            filtered = filtered.filter(item => {
                const itemDate = new Date(item.date);
                const startDate = new Date(filters.startDate);
                return itemDate >= startDate;
            });

        }
        if (filters.endDate && filters.endDate.trim() !== '') {
            filtered = filtered.filter(item => {
                const itemDate = new Date(item.date);
                const endDate = new Date(filters.endDate);
                endDate.setHours(23, 59, 59, 999); // End of day
                return itemDate <= endDate;
            });

        }

        // Filter by transaction type
        if (filters.transactionType !== 'all') {
            if (filters.transactionType === 'bills') {
                filtered = filtered.filter(item => item.type === 'bill');
            } else if (filters.transactionType === 'payments') {
                filtered = filtered.filter(item => item.type === 'payment');
            } else if (filters.transactionType === 'additional_debits') {
                filtered = filtered.filter(item => item.type === 'additional_debit');
            }

        }

        // Sort by date (newest first)
        // Sort by date (newest first)
        filtered.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateB - dateA;

            if (a.type !== b.type) {
                const typeOrder: Record<string, number> = {
                    payment: 0,
                    additional_debit: 1,
                    bill: 2
                };
                return (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
            }

            return 0;
        });



        setFilteredItems(filtered);
    }, [historyItems, filters]);

    // Handle filter changes
    const handleFilterChange = useCallback((field: keyof FilterOptions, value: string) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    }, []);

    // Refresh data with current filters
    const handleRefresh = useCallback(() => {
        if (party) {
            loadBillingHistory(party._id);
        }
    }, [party, loadBillingHistory]);

    // Export billing history as PDF
    const handleExport = useCallback(async () => {
        if (!party) return;

        setExporting(true);
        try {
            await downloadBillingHistoryPdf(party.name, filteredItems, filters);
            notify({
                type: 'success',
                message: 'Billing history exported successfully'
            });
        } catch (error) {
            console.error('Error exporting billing history:', error);
            notify({
                type: 'error',
                message: 'Failed to export billing history'
            });
        } finally {
            setExporting(false);
        }
    }, [party, filteredItems, filters, notify]);

    // Download Bill PDF
    const handleDownloadBillPdf = useCallback(async (e: React.MouseEvent, billId: string) => {
        e.stopPropagation();
        try {
            const { data: bill } = await billsApi.getById(billId);
            if (bill) {
                // Ensure party details are present (backend populate might be confirmed missing if not restarted)
                // If bill.party is just an ID string, or missing name, use the party from props
                const billWithParty = {
                    ...bill,
                    party: (bill.party && typeof bill.party !== 'string' && 'name' in bill.party && 'address' in bill.party)
                        ? bill.party
                        : (party || { name: 'Unknown Party', _id: '' })
                };

                await downloadBillPdf(billWithParty as any);
                notify({ type: 'success', message: 'Bill PDF generated' });
            }
        } catch (error) {
            console.error('Error downloading bill PDF:', error);
            notify({ type: 'error', message: 'Failed to download bill PDF' });
        }
    }, [notify, party]);

    // Handle Delete
    const handleDelete = useCallback(async (e: React.MouseEvent, item: BillingHistoryItem) => {
        e.stopPropagation();
        if (!window.confirm(`Are you sure you want to delete this ${item.type}? This action cannot be undone.`)) {
            return;
        }

        try {
            if (item.type === 'bill') {
                await billsApi.delete(item._id);
            } else if (item.type === 'additional_debit') {
                await additionalDebitsApi.delete(item._id);
            } else {
                await paymentsApi.delete(item._id);
            }
            notify({
                type: 'success',
                message: `${item.type === 'bill' ? 'Bill' : item.type === 'payment' ? 'Payment' : 'Additional debit'} deleted successfully`
            });
            handleRefresh();
        } catch (error: any) {
            console.error('Error deleting transaction:', error);
            notify({ type: 'error', message: error.message || 'Delete failed' });
        }
    }, [notify, handleRefresh]);

    // Format currency
    const formatCurrency = useCallback((amount: number) => {
        return `₹ ${Math.round(amount)}`;
    }, []);

    // Format date
    const formatDate = useCallback((dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }, []);

    // Get transaction type badge
    const getTransactionTypeBadge = useCallback((type: string) => {
        const baseClasses = "px-2 py-1 text-xs font-medium rounded-full";
        if (type === 'bill') {
            return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`;
        } else if (type === 'payment') {
            return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`;
        }
        return `${baseClasses} bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200`;
    }, []);

    // Get payment method display
    const getPaymentMethodDisplay = useCallback((method?: string) => {
        if (!method) return '';
        return method.replace('_', ' ').toUpperCase();
    }, []);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Billing History - ${party?.name || ''}`}
            size="xl"
            footer={
                <div className="flex justify-between items-center w-full">
                    <div className="flex space-x-3">
                        <Button
                            variant="secondary"
                            onClick={handleRefresh}
                            disabled={loading}
                        >
                            {loading ? 'Loading...' : 'Refresh'}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handleExport}
                            disabled={exporting || filteredItems.length === 0}
                        >
                            {exporting ? 'Exporting...' : 'Export PDF'}
                        </Button>
                    </div>
                    <Button
                        variant="primary"
                        onClick={onClose}
                    >
                        Close
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
                {/* Filters */}
                <div className={`p-4 rounded-lg ${theme.bg.secondary} border ${theme.border.primary}`}>
                    <h4 className={`text-sm font-medium ${theme.text.primary} mb-3`}>
                        Filters
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Start Date */}
                        <div>
                            <label className={`block text-xs font-medium ${theme.text.secondary} mb-1`}>
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                                className={`
                                    w-full px-3 py-2 text-sm border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                                    ${theme.border.primary} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                `}
                            />
                        </div>

                        {/* End Date */}
                        <div>
                            <label className={`block text-xs font-medium ${theme.text.secondary} mb-1`}>
                                End Date
                            </label>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                className={`
                                    w-full px-3 py-2 text-sm border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                                    ${theme.border.primary} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                `}
                            />
                        </div>

                        {/* Transaction Type */}
                        <div>
                            <label className={`block text-xs font-medium ${theme.text.secondary} mb-1`}>
                                Transaction Type
                            </label>
                            <select
                                value={filters.transactionType}
                                onChange={(e) => handleFilterChange('transactionType', e.target.value)}
                                className={`
                                    w-full px-3 py-2 text-sm border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                                    ${theme.border.primary} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                `}
                            >
                                <option value="all">All Transactions</option>
                                <option value="bills">Bills Only</option>
                                <option value="payments">Payments Only</option>
                                <option value="additional_debits">Additional Debits Only</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Summary */}
                {filteredItems.length > 0 && (
                    <div className={`p-4 rounded-lg ${theme.bg.tertiary} border ${theme.border.primary}`}>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                            <div>
                                <div className={`text-2xl font-bold ${theme.text.primary}`}>
                                    {filteredItems.length}
                                </div>
                                <div className={`text-sm ${theme.text.secondary}`}>
                                    Total Transactions
                                </div>
                            </div>
                            <div>
                                <div className={`text-2xl font-bold ${theme.text.primary}`}>
                                    {filteredItems.filter(item => item.type === 'bill').length}
                                </div>
                                <div className={`text-sm ${theme.text.secondary}`}>
                                    Bills Generated
                                </div>
                            </div>
                            <div>
                                <div className={`text-2xl font-bold ${theme.text.primary}`}>
                                    {filteredItems.filter(item => item.type === 'payment').length}
                                </div>
                                <div className={`text-sm ${theme.text.secondary}`}>
                                    Payments Received
                                </div>
                            </div>
                            <div>
                                <div className={`text-2xl font-bold ${theme.text.primary}`}>
                                    {filteredItems.filter(item => item.type === 'additional_debit').length}
                                </div>
                                <div className={`text-sm ${theme.text.secondary}`}>
                                    Additional Debits
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Transaction History */}
                <div className={`border rounded-lg ${theme.border.primary} overflow-hidden`}>
                    <div className={`px-4 py-3 ${theme.bg.secondary} border-b ${theme.border.primary}`}>
                        <h4 className={`text-sm font-medium ${theme.text.primary}`}>
                            Transaction History
                        </h4>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-12">
                            <div className={`text-sm ${theme.text.secondary}`}>
                                No transactions found for the selected filters
                            </div>
                        </div>
                    ) : (
                        <div className="max-h-96 overflow-y-auto">
                            {filteredItems.map((item, index) => (
                                <div
                                    key={`${item.type}-${item._id}-${index}`}
                                    className={`
                                        px-4 py-4 border-b ${theme.border.primary} last:border-b-0
                                        hover:${theme.bg.secondary} transition-colors
                                    `}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-3 mb-1">
                                                <span className={getTransactionTypeBadge(item.type)}>
                                                    {item.type === 'additional_debit' ? 'ADDITIONAL DEBIT' : item.type.toUpperCase()}
                                                </span>
                                                <span className={`text-lg font-bold ${theme.text.primary} flex items-center`}>
                                                    {item.type === 'bill' && item.billNumber
                                                        ? (item.billNumber.split('|').length === 3 ? item.billNumber.split('|')[2] : item.billNumber)
                                                        : item.type === 'payment'
                                                            ? item.paymentNumber
                                                            : item.periodType === 'quarterly' ? 'QTR' : 'MTH'}
                                                </span>
                                                <div className="flex items-center space-x-1 border-l pl-2 border-gray-200 dark:border-gray-700">
                                                    {item.type === 'bill' && (
                                                        <button
                                                            onClick={(e) => handleDownloadBillPdf(e, item._id)}
                                                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                                            title="Download Bill PDF"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => handleDelete(e, item)}
                                                        className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                                        title={`Delete ${item.type === 'bill' ? 'Bill' : item.type === 'payment' ? 'Payment' : 'Additional Debit'}`}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className={`text-sm ${theme.text.secondary} flex items-center space-x-2`}>
                                                <span className={`${theme.text.muted}`}>{formatDate(item.date)}</span>
                                                <span className={`${theme.text.muted}`}>•</span>
                                                <span>{item.description}</span>
                                            </div>

                                            {item.type === 'payment' && item.paymentMethod && (
                                                <div className={`text-xs ${theme.text.muted}`}>
                                                    Payment Method: {getPaymentMethodDisplay(item.paymentMethod)}
                                                </div>
                                            )}
                                            {item.type === 'additional_debit' && item.periodType && (
                                                <div className={`text-xs ${theme.text.muted}`}>
                                                    Period: {item.periodType === 'quarterly' ? 'Quarterly' : 'Monthly'}
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-right">
                                            <div className={`text-lg font-semibold ${item.type === 'bill'
                                                ? 'text-red-600 dark:text-red-400'
                                                : item.type === 'payment'
                                                    ? 'text-green-600 dark:text-green-400'
                                                    : 'text-amber-600 dark:text-amber-400'
                                                }`}>
                                                {item.type === 'bill' ? '+' : '-'}{formatCurrency(item.amount)}
                                            </div>
                                            <div className={`text-sm ${theme.text.secondary}`}>
                                                Balance: {formatCurrency(item.runningBalance)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Current Balance */}
                {filteredItems.length > 0 && (
                    <div className={`p-4 rounded-lg ${theme.bg.secondary} border ${theme.border.primary}`}>
                        <div className="flex justify-between items-center">
                            <span className={`text-sm font-medium ${theme.text.primary}`}>
                                Current Outstanding Balance
                            </span>
                            <span className={`text-lg font-bold ${filteredItems[0]?.runningBalance > 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-green-600 dark:text-green-400'
                                }`}>
                                {filteredItems[0] ? formatCurrency(filteredItems[0].runningBalance) : formatCurrency(0)}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default BillingHistoryModal;
