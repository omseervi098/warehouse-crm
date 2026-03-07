import React, { useEffect, useMemo, useState } from 'react';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import PageHeader from '../components/common/PageHeader';
import Pagination from '../components/common/Pagination';
import TransactionFilters from '../components/transactions/TransactionFilters';
import TransactionForm from '../components/transactions/TransactionForm';
import TransactionTable from '../components/transactions/TransactionTable';
import { useAppContext } from '../contexts/AppContext';
import { useNotify } from '../hooks/useNotify';
import { useTheme } from '../hooks/useTheme';
import { FlattenedStockTransaction, StockTransactionForm, GatepassData, PaginatedResponse, SortConfig, StockTransaction, StockTransactionType } from '../types';
import { chargesApi, emailApi, stockBalanceApi, transactionsApi } from '../utils/api';
import { downloadChargeReportPdf, downloadGatepassPdf } from '../utils/exportpdf';

const ITEMS_PER_PAGE = 10;

const StockEntriesPage: React.FC = () => {
  const { theme } = useTheme();
  const { parties, items, stockTransactions, setStockTransactions, updateStockTransaction, addStockTransactions, deleteStockTransaction, packagingUnits, galaLocations } = useAppContext();
  const notify = useNotify();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<StockTransaction | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'enteredAt', direction: 'desc' });
  const [filterQuery, setFilterQuery] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const fetchTransactions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let params: any = {
        filters: {},
        rangeFilters: {
          enteredAt: {},
        },
      };
      params.page = currentPage;
      if (ITEMS_PER_PAGE) {
        params.limit = ITEMS_PER_PAGE;
      }
      if (sortConfig) {
        params.sort = sortConfig.key;
        params.order = sortConfig.direction;
      }
      if (filterQuery) {
        params.search = filterQuery;
      }
      if (partyFilter) {
        params.filters['party'] = partyFilter;
      }
      if (itemFilter) {
        params.filters['item'] = itemFilter;
      }
      if (dateRange.startDate) {
        params.rangeFilters.enteredAt.from = dateRange.startDate;
      }
      if (dateRange.endDate) {
        params.rangeFilters.enteredAt.to = dateRange.endDate;
      }
      const response = await transactionsApi.getAll(params);
      const data: PaginatedResponse<StockTransaction> = response.data;
      setStockTransactions(data.transactions);
      setTotal(data.total);

    } catch (err) {
      setError('Failed to fetch transactions');
      notify({ type: 'error', message: 'Failed to fetch transactions' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [sortConfig, currentPage, filterQuery, partyFilter, itemFilter, dateRange,]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const handleEdit = (transactionId: string) => {
    console.log('Edit action for', transactionId);
    openModal(stockTransactions.find(t => t._id === transactionId));
  };

  const handleDeleteRequest = (transactionId: string) => {
    setDeleteTargetId(transactionId);
  };

  const handleDeleteConfirm = async () => {
    if (deleteTargetId) {
      try {
        console.log("Deleting:", deleteTargetId)
        await deleteStockTransaction(deleteTargetId);
        await fetchTransactions();
        setDeleteTargetId(null)
        notify({ type: 'success', message: 'Transaction deleted successfully' });
      } catch (error) {
        notify({ type: 'error', message: 'Failed to delete transaction' });
      }
    }
  };

  const handleFormSubmit = async (transactionData: StockTransactionForm, isEditing: boolean) => {
    try {
      if (isEditing && transactionToEdit) {
        //  make transactionData as FlattenedStockTransaction
        const flattenedTransactionData: FlattenedStockTransaction = {
          type: transactionData.type,
          partyId: transactionData.partyId,
          date: transactionData.date,
          time: transactionData.time,
          doNumber: transactionData.doNumber,
          charge: transactionData.charge,
          batchId: transactionData.batchId,
          lotNumber: transactionData.items[0].lotNumber,
          quantity: transactionData.items[0].quantity,
          shortage: transactionData.items[0].shortage,
          extra: transactionData.items[0].extra,
          unitId: transactionData.items[0].unitId,
          warehouses: transactionData.items[0].warehouses,
          vehicleNumber: transactionData.items[0].vehicleNumber,
          remark: transactionData.items[0].remark,
          itemId: transactionData.items[0].itemId,
        }
        await updateStockTransaction(transactionToEdit._id, flattenedTransactionData);
        notify({ type: 'success', message: 'Transaction updated successfully' });
      } else {
        // transactionData is StockTransactionForm for new additions
        const items = transactionData.items.map((item: any) => ({
          ...item,
          type: transactionData.type,
          partyId: transactionData.partyId,
          date: transactionData.date,
          time: transactionData.time,
          doNumber: transactionData.doNumber,
          charge: transactionData.charge,
          batchId: transactionData.batchId,
        }));

        await addStockTransactions(items);
        notify({ type: 'success', message: 'Transactions added successfully' });

        // Trigger batch-level actions exactly once
        if (transactionData.type === StockTransactionType.OUTWARD && transactionData.batchId) {
          try {
            const response = await transactionsApi.getGatepassData(transactionData.batchId);
            const gatepassData: GatepassData = response.data;
            await downloadGatepassPdf(gatepassData);

            if (transactionData.partyId) {
              emailApi.sendOutwardReport(transactionData.batchId, transactionData.partyId)
                .then(() => {
                  console.log('Outward email sent successfully in background');
                  notify({ type: 'success', message: 'Email sent to party' });
                })
                .catch((emailError) => {
                  console.error('Failed to send outward email:', emailError);
                  notify({ type: 'error', message: 'Failed to send email to party' });
                });
            }
          } catch (pdfError) {
            console.error("Failed to generate gatepass PDF:", pdfError);
            notify({ type: 'error', message: 'Transactions saved, but failed to generate Gatepass PDF.' });
          }

          // Check for NIL stock for each item in the batch
          for (const item of items) {
            try {
              const stockRes = await stockBalanceApi.getAll({ search: item.lotNumber });
              const stockPayload = (stockRes && (stockRes.data || stockRes)) as any;
              const stocks = Array.isArray(stockPayload) ? stockPayload : (stockPayload?.stocks || []);

              // Find exact match just in case search is fuzzy
              const stock = stocks.find((s: any) => s.lotNumber === item.lotNumber);

              if (stock && (stock.isNil === true || stock.quantity === 0)) {
                notify({ type: 'success', message: `Lot ${item.lotNumber} is now NIL. Downloading charge report.` });
                try {
                  const chargesRes = await chargesApi.getById(stock._id);
                  const charge = chargesRes.data;
                  if (charge) {
                    await downloadChargeReportPdf(charge);
                  } else {
                    console.warn(`Nil stock charge data not found for stock ID: ${stock._id}`);
                  }
                } catch (err) {
                  console.error('Failed to download nil-stock report:', err);
                  notify({ type: 'error', message: `Failed to download nil-stock report for ${stock.lotNumber}` });
                }
              }
            } catch (err) {
              console.error(`Error checking stock for lot ${item.lotNumber}:`, err);
            }
          }
        }
      }
      await fetchTransactions();
      closeModal();
    } catch (error: any) {
      notify({ type: 'error', message: isEditing ? 'Failed to update transaction' : (error.message || 'Failed to add transactions') });
    }
  };

  const openModal = (transaction: StockTransaction | null = null) => {
    setTransactionToEdit(transaction);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTransactionToEdit(null);
  };

  const inwardEntries = useMemo(() => stockTransactions.filter(e => e.type === StockTransactionType.INWARD), [stockTransactions]);

  const outwardEntries = useMemo(() => stockTransactions.filter(e => e.type === StockTransactionType.OUTWARD || e.type === StockTransactionType.RETURN), [stockTransactions]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const renderContent = () => {
    if (isLoading) {
      return <div className="flex justify-center items-center h-64"><LoadingSpinner /></div>;
    }

    if (error) {
      return <div className="text-center py-12 text-red-500">Error: {error}</div>;
    }

    if (total === 0) {
      return (
        <div className="text-center py-12 px-6 bg-white rounded-xl border-2 border-dashed border-slate-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
          <h3 className="mt-2 text-sm font-medium text-slate-900">No transactions found</h3>
          <p className="mt-1 text-sm text-slate-500">There are no entries recorded yet for the selected filters.</p>
        </div>
      );
    }

    return (
      <>
        <div className="space-y-12">
          <section>
            <h2 className={`text-xl font-semibold ${theme.text.primary} mb-4`}>Inward Entries</h2>
            {inwardEntries && inwardEntries.length > 0 ? (
              <TransactionTable
                tableType="inward"
                entries={inwardEntries}
                onEdit={handleEdit}
                onDelete={handleDeleteRequest}
                sortConfig={sortConfig}
                requestSort={requestSort}
              />
            ) : (
              <div className={`text-center py-8 px-6 ${theme.bg.card} rounded-xl border-2 border-dashed ${theme.border.primary}`}>
                <p className={`text-sm ${theme.text.secondary}`}>No inward entries found for the current filters.</p>
              </div>
            )}
          </section>
          <section>
            <h2 className={`text-xl font-semibold ${theme.text.primary} mb-4`}>Outward & Return Entries</h2>
            {outwardEntries.length > 0 ? (
              <TransactionTable
                tableType="outward-return"
                entries={outwardEntries}
                onEdit={handleEdit}
                onDelete={handleDeleteRequest}
                sortConfig={sortConfig}
                requestSort={requestSort}
              />
            ) : (
              <div className={`text-center py-8 px-6 ${theme.bg.card} rounded-xl border-2 border-dashed ${theme.border.primary}`}>
                <p className={`text-sm ${theme.text.secondary}`}>No outward or return entries found for the current filters.</p>
              </div>
            )}
          </section>
        </div>
        <div className="mt-8">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={total}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      </>
    );
  }

  return (
    <div>
      <PageHeader title="Stock Entries (Inward/Outward)">
        <div className="flex items-center space-x-2">
          <Button onClick={() => openModal()}>Add New Entry</Button>
        </div>
      </PageHeader>

      <TransactionForm
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleFormSubmit}
        transactionToEdit={transactionToEdit}
        parties={parties}
        items={items}
        packagingUnits={packagingUnits}
        galaLocations={galaLocations}
      />

      <Modal isOpen={!!deleteTargetId} onClose={() => setDeleteTargetId(null)} title="Confirm Deletion" footer={<><Button variant="secondary" onClick={() => setDeleteTargetId(null)}>Cancel</Button><Button variant="danger" onClick={() => handleDeleteConfirm()}>Delete</Button></>}>
        <p className={theme.text.primary}>Are you sure you want to delete this transaction? This action will reverse the stock movement and cannot be undone.</p>
      </Modal>
      <TransactionFilters
        parties={parties}
        items={items}
        filterQuery={filterQuery}
        setFilterQuery={setFilterQuery}
        partyFilter={partyFilter}
        setPartyFilter={setPartyFilter}
        itemFilter={itemFilter}
        setItemFilter={setItemFilter}
        dateRange={dateRange}
        setStartDate={(d) => setDateRange(prev => ({ ...prev, startDate: d }))}
        setEndDate={(d) => setDateRange(prev => ({ ...prev, endDate: d }))}
      />

      {renderContent()}

    </div>
  );
};

export default StockEntriesPage;
