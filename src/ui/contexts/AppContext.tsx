
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import {
  Bill,
  BillingHistoryItem,
  Charge,
  ChargesPagination,
  CompanyProfileData,
  FlattenedStockTransaction,
  GalaLocation,
  Item,
  PackagingUnit,
  Party,
  PartyFinancialSummary,
  Payment,
  StockBalance,
  StockTransaction
} from '../types';
import { billsApi, chargesApi, companyApi, itemsApi, partiesApi, paymentsApi, stockBalanceApi, transactionsApi, unitsApi, warehouseApi } from '../utils/api';

interface AppContextType {
  // Company
  companyProfile: CompanyProfileData | null;
  loading: boolean;
  error: string | null;
  updateCompanyProfile: (profile: CompanyProfileData) => Promise<void>;

  // Stock Balance
  stockBalances: any[];
  stockBalancePagination: {
    page: number;
    limit: number;
    total: number;
  };
  loadingStockBalances: boolean;
  errorStockBalances: string | null;
  fetchStockBalances: (params?: any) => Promise<void>;
  searchStockBalances: (query: string) => Promise<void>;

  // Charges
  charges: Charge[];
  chargesPagination: ChargesPagination;
  loadingCharges: boolean;
  errorCharges: string | null;
  fetchCharges: (params?: any) => Promise<void>;

  // Bills
  bills: Bill[];
  billsPagination: {
    page: number;
    limit: number;
    total: number;
  };
  loadingBills: boolean;
  errorBills: string | null;
  fetchBills: (params?: any) => Promise<void>;
  addBill: (billData: Omit<Bill, '_id' | 'createdAt' | 'updatedAt'>) => Promise<Bill>;
  updateBill: (id: string, billData: Partial<Bill>) => Promise<Bill>;
  deleteBill: (billId: string) => Promise<void>;

  // Payments
  payments: Payment[];
  paymentsPagination: {
    page: number;
    limit: number;
    total: number;
  };
  loadingPayments: boolean;
  errorPayments: string | null;
  fetchPayments: (params?: any) => Promise<void>;
  addPayment: (paymentData: Omit<Payment, '_id' | 'createdAt' | 'updatedAt'>) => Promise<Payment>;
  updatePayment: (id: string, paymentData: Partial<Payment>) => Promise<Payment>;
  deletePayment: (paymentId: string) => Promise<void>;

  // Financial Summary
  financialSummaries: PartyFinancialSummary[];
  loadingFinancialSummaries: boolean;
  errorFinancialSummaries: string | null;
  fetchFinancialSummaries: (params?: any) => Promise<void>;
  getBillingHistory: (partyId: string, params?: any) => Promise<BillingHistoryItem[]>;

  // Parties
  parties: Party[];
  addParty: (partyData: Omit<Party, '_id'>) => Promise<Party>;
  updateParty: (id: string, partyData: Partial<Party>) => Promise<Party>;
  deleteParty: (partyId: string) => Promise<void>;

  // Items
  items: Item[];
  addItem: (itemData: Omit<Item, '_id'>) => Promise<Item>;
  updateItem: (id: string, itemData: Partial<Item>) => Promise<Item>;
  deleteItem: (itemId: string) => Promise<void>;

  // Stock Transactions
  stockTransactions: StockTransaction[];
  setStockTransactions: (transactions: StockTransaction[]) => void;
  addStockTransaction: (entryData: FlattenedStockTransaction) => Promise<StockTransaction>;
  addStockTransactions: (entriesData: FlattenedStockTransaction[]) => Promise<StockTransaction[]>;
  updateStockTransaction: (id: string, transactionData: FlattenedStockTransaction) => Promise<StockTransaction>;
  deleteStockTransaction: (transactionId: string) => Promise<void>;
  getLotNumbers: (search?: string) => Promise<string[]>;
  getDoNumbers: (search?: string) => Promise<string[]>;


  // Packaging Units
  packagingUnits: PackagingUnit[];
  addPackagingUnit: (unitData: Omit<PackagingUnit, '_id'>) => Promise<PackagingUnit>;
  updatePackagingUnit: (id: string, unitData: Partial<PackagingUnit>) => Promise<PackagingUnit>;
  deletePackagingUnit: (unitId: string) => Promise<void>;

  // Gala Locations
  galaLocations: GalaLocation[];
  addGalaLocation: (locationData: Omit<GalaLocation, '_id'>) => Promise<GalaLocation>;
  updateGalaLocation: (id: string, locationData: Partial<GalaLocation>) => Promise<GalaLocation>;
  deleteGalaLocation: (locationId: string) => Promise<void>;

  // Refresh data
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);


export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State for data
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileData | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([]);
  const [stockBalances, setStockBalances] = useState<StockBalance[]>([]);
  const [stockBalancePagination, setStockBalancePagination] = useState({
    page: 0,
    limit: 25,
    total: 0,
  });
  const [loadingStockBalances, setLoadingStockBalances] = useState<boolean>(false);
  const [errorStockBalances, setErrorStockBalances] = useState<string | null>(null);

  // Charges state
  const [charges, setCharges] = useState<any[]>([]);
  const [chargesPagination, setChargesPagination] = useState<ChargesPagination>({
    page: 0,
    limit: 25,
    total: 0,
  });
  const [loadingCharges, setLoadingCharges] = useState<boolean>(false);
  const [errorCharges, setErrorCharges] = useState<string | null>(null);

  // Bills state
  const [bills, setBills] = useState<Bill[]>([]);
  const [billsPagination, setBillsPagination] = useState({
    page: 0,
    limit: 25,
    total: 0,
  });
  const [loadingBills, setLoadingBills] = useState<boolean>(false);
  const [errorBills, setErrorBills] = useState<string | null>(null);

  // Payments state
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsPagination, setPaymentsPagination] = useState({
    page: 0,
    limit: 25,
    total: 0,
  });
  const [loadingPayments, setLoadingPayments] = useState<boolean>(false);
  const [errorPayments, setErrorPayments] = useState<string | null>(null);

  // Financial summaries state
  const [financialSummaries, setFinancialSummaries] = useState<PartyFinancialSummary[]>([]);
  const [loadingFinancialSummaries, setLoadingFinancialSummaries] = useState<boolean>(false);
  const [errorFinancialSummaries, setErrorFinancialSummaries] = useState<string | null>(null);

  // Stock Balance Actions
  const fetchStockBalances = useCallback(async (params?: any) => {
    try {
      setLoadingStockBalances(true);
      setErrorStockBalances(null);
      const response = await stockBalanceApi.getAll(params);
      setStockBalances(response.data.stocks);
      setStockBalancePagination({
        page: response.data.page || 0,
        limit: response.data.limit || 25,
        total: response.data.total || 0,
      });
    } catch (err) {
      setErrorStockBalances('Failed to fetch stock balances');
      console.error('Error fetching stock balances:', err);
      throw err;
    } finally {
      setLoadingStockBalances(false);
    }
  }, []);

  const searchStockBalances = useCallback(async (query: string) => {
    try {
      setLoadingStockBalances(true);
      setErrorStockBalances(null);
      const response = await stockBalanceApi.getAll({ search: query });
      setStockBalances(response.data.stocks);
      setStockBalancePagination({
        page: response.data.page || 0,
        limit: response.data.limit || 25,
        total: response.data.total || 0,
      });
    } catch (err) {
      setErrorStockBalances('Failed to search stock balances');
      console.error('Error searching stock balances:', err);
      throw err;
    } finally {
      setLoadingStockBalances(false);
    }
  }, []);

  // Charges Actions
  const fetchCharges = useCallback(async (params?: any) => {
    try {
      setLoadingCharges(true);
      setErrorCharges(null);
      const response = await chargesApi.getAll(params);
      setCharges(response.data.results || []);
      setChargesPagination({
        page: response.data.page || 0,
        limit: response.data.limit || 25,
        total: response.data.total || 0,
        aggregation: (response.data as any).aggregation,
      });
    } catch (err) {
      setErrorCharges('Failed to fetch charges');
      console.error('Error fetching charges:', err);
    } finally {
      setLoadingCharges(false);
    }
  }, []);

  // Bills Actions
  const fetchBills = useCallback(async (params?: any) => {
    try {
      setLoadingBills(true);
      setErrorBills(null);
      const response = await billsApi.getAll(params);
      setBills(response.data.bills || []);
      setBillsPagination({
        page: response.data.pagination?.page || 0,
        limit: response.data.pagination?.limit || 25,
        total: response.data.pagination?.total || 0,
      });
    } catch (err) {
      setErrorBills('Failed to fetch bills');
      console.error('Error fetching bills:', err);
    } finally {
      setLoadingBills(false);
    }
  }, []);

  const addBill = useCallback(async (billData: Omit<Bill, '_id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoadingBills(true);
      const response = await billsApi.create(billData);
      setBills(prev => [response.data, ...prev]);
      return response.data;
    } catch (err) {
      console.error('Failed to add bill:', err);
      throw err;
    } finally {
      setLoadingBills(false);
    }
  }, []);

  const updateBill = useCallback(async (id: string, billData: Partial<Bill>) => {
    try {
      setLoadingBills(true);
      const response = await billsApi.update(id, billData);
      setBills(prev => prev.map(b => b._id === id ? response.data : b));
      return response.data;
    } catch (err) {
      console.error('Failed to update bill:', err);
      throw err;
    } finally {
      setLoadingBills(false);
    }
  }, []);

  const deleteBill = useCallback(async (id: string) => {
    try {
      setLoadingBills(true);
      await billsApi.delete(id);
      setBills(prev => prev.filter(b => b._id !== id));
    } catch (err) {
      console.error('Failed to delete bill:', err);
      throw err;
    } finally {
      setLoadingBills(false);
    }
  }, []);

  // Payments Actions
  const fetchPayments = useCallback(async (params?: any) => {
    try {
      setLoadingPayments(true);
      setErrorPayments(null);
      const response = await paymentsApi.getAll(params);
      setPayments(response.data.payments || []);
      setPaymentsPagination({
        page: response.data.pagination?.page || 0,
        limit: response.data.pagination?.limit || 25,
        total: response.data.pagination?.total || 0,
      });
    } catch (err) {
      setErrorPayments('Failed to fetch payments');
      console.error('Error fetching payments:', err);
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  const addPayment = useCallback(async (paymentData: Omit<Payment, '_id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoadingPayments(true);
      const response = await paymentsApi.create(paymentData);
      setPayments(prev => [response.data, ...prev]);

      // Update the related bill in the bills state
      if (response.data.bill?._id) {
        setBills(prev => prev.map(bill => {
          if (bill._id === response.data.bill?._id) {
            const newPaidAmount = bill.paidAmount + response.data.amount;
            const newOutstandingAmount = bill.amount - newPaidAmount;
            let newStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid';

            if (newOutstandingAmount === 0) {
              newStatus = 'paid';
            } else if (newPaidAmount > 0) {
              newStatus = 'partial';
            }

            return {
              ...bill,
              paidAmount: newPaidAmount,
              outstandingAmount: newOutstandingAmount,
              status: newStatus
            };
          }
          return bill;
        }));
      }

      return response.data;
    } catch (err) {
      console.error('Failed to add payment:', err);
      throw err;
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  const updatePayment = useCallback(async (id: string, paymentData: Partial<Payment>) => {
    try {
      setLoadingPayments(true);
      const response = await paymentsApi.update(id, paymentData);
      setPayments(prev => prev.map(p => p._id === id ? response.data : p));
      return response.data;
    } catch (err) {
      console.error('Failed to update payment:', err);
      throw err;
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  const deletePayment = useCallback(async (id: string) => {
    try {
      setLoadingPayments(true);
      await paymentsApi.delete(id);
      setPayments(prev => prev.filter(p => p._id !== id));
    } catch (err) {
      console.error('Failed to delete payment:', err);
      throw err;
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  // Financial Summary Actions
  const fetchFinancialSummaries = useCallback(async (params?: any) => {
    try {
      setLoadingFinancialSummaries(true);
      setErrorFinancialSummaries(null);
      const response = await billsApi.getFinancialSummary(params);
      setFinancialSummaries(response.data || []);
    } catch (err) {
      setErrorFinancialSummaries('Failed to fetch financial summaries');
      console.error('Error fetching financial summaries:', err);
    } finally {
      setLoadingFinancialSummaries(false);
    }
  }, []);

  const getBillingHistory = useCallback(async (partyId: string, params?: any) => {
    try {
      const response = await paymentsApi.getBillingHistory(partyId, params);
      return response.data || [];
    } catch (err) {
      console.error('Error fetching billing history:', err);
      throw err;
    }
  }, []);

  const [packagingUnits, setPackagingUnits] = useState<PackagingUnit[]>([]);
  const [galaLocations, setGalaLocations] = useState<GalaLocation[]>([]);

  // State for loading and error handling
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [
        companyRes,
        partiesRes,
        itemsRes,
        transactionsRes,
        stockBalanceRes,
        unitsRes,
        locationsRes
      ] = await Promise.all([
        companyApi.get().catch(() => undefined),
        partiesApi.getAll(),
        itemsApi.getAll(),
        transactionsApi.getAll({
          page: 0,
          limit: 25,
          sort: 'enteredAt',
          order: 'desc'
        }),
        stockBalanceApi.getAll({
          page: 0,
          limit: 25,
          sort: 'earliestEntryAt',
          order: 'desc'
        }),
        unitsApi.getAll(),
        warehouseApi.getAll()
      ]);

      // Update state with fetched data
      if (companyRes?.data) setCompanyProfile(companyRes.data);
      if (partiesRes?.data) setParties(partiesRes.data);
      if (itemsRes?.data) setItems(itemsRes.data);
      if (transactionsRes?.data) setStockTransactions(transactionsRes.data.transactions);
      if (stockBalanceRes?.data) setStockBalances(stockBalanceRes.data.stocks)
      if (unitsRes?.data) setPackagingUnits(unitsRes.data);
      if (locationsRes?.data) setGalaLocations(locationsRes.data);

    } catch (err) {
      console.error('Failed to load initial data:', err);
      setError('Failed to load application data. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data on component mount
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    await loadInitialData();
  }, [loadInitialData]);

  // Company operations
  const updateCompanyProfile = useCallback(async (profile: CompanyProfileData) => {
    try {
      setLoading(true);
      let response;

      if (profile._id && profile._id.length > 0) {
        // Update existing profile
        response = await companyApi.update(profile._id, profile);
      } else {
        // Create new profile
        delete profile._id;
        response = await companyApi.create(profile);
      }

      setCompanyProfile(response.data);
      return response.data;
    } catch (err) {
      console.error('Failed to update company profile:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Party operations
  const addParty = useCallback(async (partyData: Omit<Party, '_id'>) => {
    try {
      setLoading(true);
      const response = await partiesApi.create(partyData);
      setParties(prev => [...prev, response.data]);
      return response.data;
    } catch (err) {
      console.error('Failed to add party:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateParty = useCallback(async (_id: string, partyData: Partial<Omit<Party, '_id'>>) => {
    try {
      setLoading(true);
      const response = await partiesApi.update(_id, partyData);
      setParties(prev => prev.map(p => p._id === _id ? response.data : p));
      return response.data;
    } catch (err) {
      console.error('Failed to update party:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteParty = useCallback(async (_id: string) => {
    try {
      setLoading(true);
      await partiesApi.delete(_id);
      setParties(prev => prev.filter(p => p._id !== _id));
    } catch (err) {
      console.error('Failed to delete party:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Item operations
  const addItem = useCallback(async (itemData: Omit<Item, '_id'>) => {
    try {
      setLoading(true);
      const response = await itemsApi.create({
        ...itemData,
        category: itemData.category || 'Uncategorized'
      });
      setItems(prev => [...prev, response.data]);
      return response.data;
    } catch (err) {
      console.error('Failed to add item:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateItem = useCallback(async (_id: string, itemData: Partial<Item>) => {
    try {
      setLoading(true);
      const response = await itemsApi.update(_id, itemData);
      setItems(prev => prev.map(i => i._id === _id ? response.data : i));
      return response.data;
    } catch (err) {
      console.error('Failed to update item:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteItem = useCallback(async (_id: string) => {
    try {
      setLoading(true);
      await itemsApi.delete(_id);
      setItems(prev => prev.filter(i => i._id !== _id));
    } catch (err) {
      console.error('Failed to delete item:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  // Stock Transaction operations
  const addStockTransaction = useCallback(async (entryData: FlattenedStockTransaction) => {
    try {
      setLoading(true);
      const response = await transactionsApi.create(entryData);
      return response.data;
    } catch (err) {
      console.error('Failed to add stock transaction:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addStockTransactions = useCallback(async (entriesData: FlattenedStockTransaction[]) => {
    try {
      setLoading(true);
      const response = await transactionsApi.createMany(entriesData);
      return response.data;
    } catch (err) {
      console.error('Failed to add stock transactions:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStockTransaction = useCallback(async (_id: string, transactionData: FlattenedStockTransaction) => {
    try {
      setLoading(true);
      const response = await transactionsApi.update(_id, transactionData);
      setStockTransactions((prev) => prev.map(t => t._id === _id ? response.data : t));
      return response.data;
    } catch (err) {
      console.error('Failed to update stock transaction:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteStockTransaction = useCallback(async (transactionId: string) => {
    try {
      setLoading(true);
      await transactionsApi.delete(transactionId);
      setStockTransactions(prev => prev.filter(t => t._id !== transactionId));
    } catch (err) {
      console.error('Failed to delete stock transaction:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getLotNumbers = useCallback(async (search?: string) => {
    try {
      setLoading(true);
      const response = await transactionsApi.getLotNumbers(search);
      return response.data;
    } catch (err) {
      console.error('Failed to get lot numbers:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getDoNumbers = useCallback(async (search?: string) => {
    try {
      setLoading(true);
      const response = await transactionsApi.getDoNumbers(search);
      return response.data;
    } catch (err) {
      console.error('Failed to get do numbers:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Packaging Unit operations
  const addPackagingUnit = useCallback(async (unitData: Omit<PackagingUnit, '_id'>) => {
    try {
      setLoading(true);
      const response = await unitsApi.create(unitData);
      setPackagingUnits(prev => [...prev, response.data]);
      return response.data;
    } catch (err) {
      console.error('Failed to add packaging unit:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePackagingUnit = useCallback(async (_id: string, unitData: Partial<PackagingUnit>) => {
    try {
      setLoading(true);
      const response = await unitsApi.update(_id, unitData);
      setPackagingUnits(prev => prev.map(u => u._id === _id ? response.data : u));
      return response.data;
    } catch (err) {
      console.error('Failed to update packaging unit:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deletePackagingUnit = useCallback(async (_id: string) => {
    try {
      setLoading(true);
      await unitsApi.delete(_id);
      setPackagingUnits(prev => prev.filter(u => u._id !== _id));
    } catch (err) {
      console.error('Failed to delete packaging unit:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Gala Location operations
  const addGalaLocation = useCallback(async (locationData: Omit<GalaLocation, '_id'>) => {
    try {
      setLoading(true);
      const response = await warehouseApi.create(locationData);
      setGalaLocations(prev => [...prev, response.data]);
      return response.data;
    } catch (err) {
      console.error('Failed to add gala location:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateGalaLocation = useCallback(async (_id: string, locationData: Partial<GalaLocation>) => {
    try {
      setLoading(true);
      // Note: For now, we'll simulate an update since the API might not have update/delete endpoints
      // In a real implementation, this would be: await warehouseApi.update(id, locationData);
      const updatedLocation = { ...locationData, _id } as GalaLocation;
      setGalaLocations(prev => prev.map(l => l._id === _id ? updatedLocation : l));
      return updatedLocation;
    } catch (err) {
      console.error('Failed to update gala location:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteGalaLocation = useCallback(async (_id: string) => {
    try {
      setLoading(true);
      // Note: For now, we'll simulate a delete since the API might not have update/delete endpoints
      // In a real implementation, this would be: await warehouseApi.delete(locationId);
      setGalaLocations(prev => prev.filter(l => l._id !== _id));
    } catch (err) {
      console.error('Failed to delete gala location:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);


  const value = {
    companyProfile,
    loading,
    error,
    updateCompanyProfile,
    parties,
    addParty,
    updateParty,
    deleteParty,
    items,
    addItem,
    updateItem,
    deleteItem,
    stockTransactions,
    setStockTransactions,
    addStockTransaction,
    addStockTransactions,
    updateStockTransaction,
    deleteStockTransaction,
    getLotNumbers,
    getDoNumbers,
    stockBalances,
    stockBalancePagination,
    loadingStockBalances,
    errorStockBalances,
    fetchStockBalances,
    searchStockBalances,
    charges,
    chargesPagination,
    loadingCharges,
    errorCharges,
    fetchCharges,
    bills,
    billsPagination,
    loadingBills,
    errorBills,
    fetchBills,
    addBill,
    updateBill,
    deleteBill,
    payments,
    paymentsPagination,
    loadingPayments,
    errorPayments,
    fetchPayments,
    addPayment,
    updatePayment,
    deletePayment,
    financialSummaries,
    loadingFinancialSummaries,
    errorFinancialSummaries,
    fetchFinancialSummaries,
    getBillingHistory,
    packagingUnits,
    addPackagingUnit,
    updatePackagingUnit,
    deletePackagingUnit,
    galaLocations,
    addGalaLocation,
    updateGalaLocation,
    deleteGalaLocation,
    refreshData
  };

  return (
    <AppContext.Provider value={value as AppContextType}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
