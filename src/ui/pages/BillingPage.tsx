import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BillingHistoryModal from '../components/billing/BillingHistoryModal';
import BillModal from '../components/billing/BillModal';
import PaymentModal from '../components/billing/PaymentModal';
import Button from '../components/common/Button';
import PageHeader from '../components/common/PageHeader';
import Pagination from '../components/common/Pagination';
import { SortIndicator } from '../components/common/Table';
import { useAppContext } from '../contexts/AppContext';
import { useNotify } from '../hooks/useNotify';
import { useTheme } from '../hooks/useTheme';
import { Bill, Party, Payment } from '../types';

const BillingPage: React.FC = () => {
    const { theme } = useTheme();
    const {
        parties,
        financialSummaries,
        loadingFinancialSummaries,
        errorFinancialSummaries,
        fetchFinancialSummaries
    } = useAppContext();
    const notify = useNotify();

    // State for pagination
    const [currentPage, setCurrentPage] = useState(0);
    const itemsPerPage = 25;

    // Modal state
    const [isBillModalOpen, setIsBillModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isBillingHistoryModalOpen, setIsBillingHistoryModalOpen] = useState(false);
    const [selectedPartyId, setSelectedPartyId] = useState<string>('');
    const [selectedParty, setSelectedParty] = useState<Party | null>(null);

    // Sorting state
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
        key: 'outstandingBalance',
        direction: 'desc'
    });

    // Load financial data on component mount
    useEffect(() => {
        fetchFinancialSummaries();
    }, [fetchFinancialSummaries]);

    // Sorting logic
    const sortedData = useMemo(() => {
        if (!sortConfig.key) return financialSummaries;

        return [...financialSummaries].sort((a, b) => {
            let aValue: any;
            let bValue: any;

            if (sortConfig.key === 'party.name') {
                aValue = a.party.name;
                bValue = b.party.name;
            } else {
                aValue = (a as any)[sortConfig.key];
                bValue = (b as any)[sortConfig.key];
            }

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [financialSummaries, sortConfig]);

    // Pagination
    const paginatedData = useMemo(() => {
        const startIndex = currentPage * itemsPerPage;
        return sortedData.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedData, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(sortedData.length / itemsPerPage);

    // Handlers
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

    const handleAddBill = useCallback((partyId: string) => {
        setSelectedPartyId(partyId);
        setIsBillModalOpen(true);
    }, []);

    const handleAddPayment = useCallback((partyId: string) => {
        setSelectedPartyId(partyId);
        setIsPaymentModalOpen(true);
    }, []);

    const handleViewHistory = useCallback((partyId: string) => {
        const party = parties.find(p => p._id === partyId);
        if (party) {
            setSelectedParty(party);
            setIsBillingHistoryModalOpen(true);
        }
    }, [parties]);

    // Handle bill creation
    const handleBillCreated = useCallback((bill: Bill) => {
        // Refresh financial summaries after bill creation
        fetchFinancialSummaries();

        notify({
            type: 'success',
            message: `Bill ${bill.billNumber} created successfully`
        });

        // Close the modal
        setIsBillModalOpen(false);
        setSelectedPartyId('');
    }, [notify, fetchFinancialSummaries]);

    // Handle payment creation
    const handlePaymentCreated = useCallback((payment: Payment) => {
        // Refresh financial summaries after payment creation
        fetchFinancialSummaries();

        notify({
            type: 'success',
            message: `${payment.paymentFor === 'rent' ? 'Rent' : 'Payment'} ${payment.paymentNumber} recorded successfully`
        });

        // Close the modal
        setIsPaymentModalOpen(false);
        setSelectedPartyId('');
    }, [notify, fetchFinancialSummaries]);

    // Handle modal close
    const handleCloseBillModal = useCallback(() => {
        setIsBillModalOpen(false);
        setSelectedPartyId('');
    }, []);

    const handleClosePaymentModal = useCallback(() => {
        setIsPaymentModalOpen(false);
        setSelectedPartyId('');
    }, []);

    const handleCloseBillingHistoryModal = useCallback(() => {
        setIsBillingHistoryModalOpen(false);
        setSelectedParty(null);
    }, []);

    return (
        <div>
            <PageHeader title="Billing Management">
                {/* <div className="flex space-x-2">
                    <Button variant="secondary" size="sm">
                        Export Report
                    </Button>
                </div> */}
            </PageHeader>

            {/* Financial Overview Table */}
            <div className={`responsive-table-wrapper ${theme.bg.card} border ${theme.border.primary} rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200`}>
                <div className="rounded-xl">
                    <table className={`min-w-full divide-y ${theme.border.primary} responsive-table border-collapse border ${theme.border.primary}`}>
                        <thead className={`bg-gradient-to-r ${theme.bg.secondary} to-${theme.bg.secondary}/80 border-b ${theme.border.secondary}`}>
                            <tr className={`hover:${theme.bg.hover} transition-colors duration-150`}>
                                <th
                                    onClick={() => requestSort('party.name')}
                                    className={`px-4 py-3 text-left text-xs font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                                >
                                    <div className="flex items-center">
                                        Party Name
                                        <SortIndicator direction={sortConfig?.key === 'party.name' ? sortConfig.direction : null} />
                                    </div>
                                </th>
                                <th
                                    onClick={() => requestSort('totalCharges')}
                                    className={`px-4 py-3 text-right text-xs font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                                >
                                    <div className="flex items-center justify-end">
                                        Total Charges
                                        <SortIndicator direction={sortConfig?.key === 'totalCharges' ? sortConfig.direction : null} />
                                    </div>
                                </th>
                                <th
                                    onClick={() => requestSort('totalBilled')}
                                    className={`px-4 py-3 text-right text-xs font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                                >
                                    <div className="flex items-center justify-end">
                                        Total Billed
                                        <SortIndicator direction={sortConfig?.key === 'totalBilled' ? sortConfig.direction : null} />
                                    </div>
                                </th>
                                <th
                                    onClick={() => requestSort('totalPaid')}
                                    className={`px-4 py-3 text-right text-xs font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                                >
                                    <div className="flex items-center justify-end">
                                        Total Paid
                                        <SortIndicator direction={sortConfig?.key === 'totalPaid' ? sortConfig.direction : null} />
                                    </div>
                                </th>
                                <th
                                    className={`px-4 py-3 text-right text-xs font-medium ${theme.text.muted} uppercase tracking-wide border-r ${theme.border.primary}`}
                                >
                                    <div className="flex items-center justify-end">
                                        Remaining Charges
                                    </div>
                                </th>
                                <th
                                    onClick={() => requestSort('outstandingBalance')}
                                    className={`px-4 py-3 text-right text-xs font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                                >
                                    <div className="flex items-center justify-end">
                                        Outstanding Balance
                                        <SortIndicator direction={sortConfig?.key === 'outstandingBalance' ? sortConfig.direction : null} />
                                    </div>
                                </th>
                                <th className={`px-4 py-3 text-center text-xs font-medium ${theme.text.muted} uppercase tracking-wide`}>
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${theme.border.primary}`}>
                            {loadingFinancialSummaries ? (
                                <tr>
                                    <td colSpan={6} className={`px-4 py-8 text-center ${theme.text.muted}`}>
                                        Loading financial data...
                                    </td>
                                </tr>
                            ) : errorFinancialSummaries ? (
                                <tr>
                                    <td colSpan={6} className={`px-4 py-8 text-center text-red-500`}>
                                        Error loading financial data: {errorFinancialSummaries}
                                        <br />
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => fetchFinancialSummaries()}
                                            className="mt-2"
                                        >
                                            Retry
                                        </Button>
                                    </td>
                                </tr>
                            ) : paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className={`px-4 py-8 text-center ${theme.text.muted}`}>
                                        No parties found
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((summary, index) => (
                                    <tr
                                        key={summary.party._id?.toString() || `party-${index}`}
                                        className={`group hover:${theme.bg.hover} transition-all duration-150 ease-in-out border-b ${theme.border.primary} last:border-0`}
                                    >
                                        <td className={`px-4 py-3 whitespace-nowrap ${theme.text.primary} font-medium border-r ${theme.border.primary}`}>
                                            <div>
                                                <div className="font-semibold">{summary.party.name}</div>
                                                <div className={`text-xs ${theme.text.muted}`}>
                                                    {summary.billCount} bills • {summary.paymentCount} payments
                                                </div>
                                            </div>
                                        </td>
                                        <td className={`px-4 py-3 whitespace-nowrap text-right ${theme.text.primary} font-medium border-r ${theme.border.primary}`}>
                                            ₹{Math.round(summary.totalCharges)}
                                        </td>
                                        <td className={`px-4 py-3 whitespace-nowrap text-right ${theme.text.primary} font-medium border-r ${theme.border.primary}`}>
                                            ₹{Math.round(summary.totalBilled)}
                                        </td>
                                        <td className={`px-4 py-3 whitespace-nowrap text-right ${theme.text.primary} font-medium border-r ${theme.border.primary}`}>
                                            ₹{Math.round(summary.totalPaid)}
                                        </td>
                                        <td className={`px-4 py-3 whitespace-nowrap text-right ${theme.text.primary} font-medium border-r ${theme.border.primary}`}>
                                            ₹{Math.round(summary.totalCharges - summary.totalPaid)}
                                        </td>
                                        <td className={`px-4 py-3 whitespace-nowrap text-right font-semibold border-r ${theme.border.primary}`}>
                                            <span className={summary.outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'}>
                                                ₹{Math.round(summary.outstandingBalance)}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 whitespace-nowrap text-center`}>
                                            <div className="flex items-center justify-center space-x-2">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleAddBill(String(summary.party._id))}
                                                >
                                                    Add Bill
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleAddPayment(String(summary.party._id))}
                                                >
                                                    Add Payment
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleViewHistory(String(summary.party._id))}
                                                >
                                                    History
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loadingFinancialSummaries && paginatedData.length > 0 && totalPages > 1 && (
                    <div className={`border-t ${theme.border.primary} px-4 py-3`}>
                        <Pagination
                            currentPage={currentPage}
                            totalItems={sortedData.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={handlePageChange}
                            totalPages={totalPages}
                        />
                    </div>
                )}
            </div>

            {/* Bill Creation Modal */}
            <BillModal
                isOpen={isBillModalOpen}
                onClose={handleCloseBillModal}
                onBillCreated={handleBillCreated}
                parties={parties}
                preSelectedPartyId={selectedPartyId}
            />

            {/* Payment Recording Modal */}
            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={handleClosePaymentModal}
                onPaymentCreated={handlePaymentCreated}
                parties={parties}
                preSelectedPartyId={selectedPartyId}
            />

            {/* Billing History Modal */}
            <BillingHistoryModal
                isOpen={isBillingHistoryModalOpen}
                onClose={handleCloseBillingHistoryModal}
                party={selectedParty}
            />
        </div>
    );
};

export default BillingPage;
