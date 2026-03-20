export interface CompanyProfileData {
  _id?: string;
  warehouseName: string;
  ownerName: string;
  contactNos: string[];
  email: string;
  address: string;
  gstNo: string;
  panNo: string;
  ifscCode?: string;
  accountNumber?: string;
  bankName?: string;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
}

export interface Party {
  _id: string;
  name: string;
  address: string;
  contactNos: string[];
  businessContactEmail?: string;
  orgEmail?: string;
  gstNo: string;
  panNo: string;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
}

export interface PackagingUnit {
  _id: string;
  name: string;
  rate: number;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
}

export interface GalaLocation {
  _id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
}

export interface Item {
  _id: string;
  name: string;
  category: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
}

export enum StockTransactionType {
  INWARD = 'INWARD',
  OUTWARD = 'OUTWARD',
  RETURN = 'RETURN',
}

export interface StockTransaction {
  _id: string;
  transactionId: string;
  type: StockTransactionType;
  party: Pick<Party, '_id' | 'name'>;
  item: Pick<Item, '_id' | 'name' | 'category'>;
  lotNumber: string;
  quantity: number;
  shortage: number;
  extra: number;
  charge: boolean;
  batchId: string;
  unit: Pick<PackagingUnit, '_id' | 'name'>;
  warehouses: Pick<GalaLocation, '_id' | 'name'>[];
  doNumber: string;
  vehicleNumber: string;
  remark: string;
  enteredAt: string;
  __v?: number;
}

export interface FlattenedStockTransaction {
  type: StockTransactionType;
  batchId: string;
  partyId: string;
  lotNumber: string;
  date: string;
  time: string;
  itemId: string;
  charge: boolean;
  quantity: number;
  shortage: number;
  extra: number;
  unitId: string;
  warehouses: string[];
  doNumber?: string;
  vehicleNumber: string;
  remark?: string;
}

export interface StockTransactionForm {
  type: StockTransactionType;
  partyId: string;
  date: string;
  time: string;
  doNumber: string;
  charge: boolean;
  batchId: string;
  items: {
    itemId: string;
    lotNumber: string;
    quantity: number;
    shortage: number;
    extra: number;
    unitId: string;
    warehouses: string[];
    vehicleNumber: string;
    remark: string;
    category: string;
  }[]
}

export interface StockBalance {
  _id: string;
  item: Pick<Item, '_id' | 'name' | 'category'>
  lotNumber: string;
  inwardDates: Array<string>;
  chargeable: boolean;
  isNil: boolean;
  party: Pick<Party, '_id' | 'name'>;
  warehouses: Pick<GalaLocation, '_id' | 'name'>[]
  quantity: number;
  unit: Pick<PackagingUnit, '_id' | 'name' | 'rate'>
  earliestEntryAt: string;
  latestEntryAt: string;
  transactions: {
    enteredAt: string;
    vehicleNumber: string;
    remark: string;
    doNumber: string;
    quantity: number;
    shortage: number;
    extra: number;
    balance: number;
    type: StockTransactionType;
    _id: string;
  }[]
}


export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export interface MigrationProgress {
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  currentCollection: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  errors: MigrationError[];
}

export interface MigrationError {
  recordId: string;
  collection: string;
  field: string;
  error: string;
  timestamp: Date;
}

export interface DecryptionProgress {
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  currentCollection: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  errors: DecryptionError[];
}

export interface DecryptionError {
  recordId: string;
  collection: string;
  field: string;
  error: string;
  timestamp: Date;
}

// Encryption-related interfaces
export interface EncryptedData {
  data: string;        // Base64 encoded encrypted data
  iv: string;          // Base64 encoded initialization vector
  tag: string;         // Base64 encoded authentication tag
  version: number;     // Encryption version for future compatibility
}

export interface KeyMetadata {
  createdAt: Date;
  lastRotated: Date;
  version: number;
  isRotationRecommended: boolean;
}

// Email-related interfaces
export interface EmailConfig {
  gmailAddress: string;
  appPassword: string;
  enabled: boolean;
}

export interface EmailConfigDisplay {
  gmailAddress: string;
  enabled: boolean;
  hasPassword: boolean;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailContent {
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

// Migration interfaces
export interface ChargeMigrationResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{
    lotNumber: string;
    error: string;
  }>;
  duration: number;
}

export interface ChargeMigrationValidation {
  validated: number;
  mismatches: Array<{
    lotNumber: string;
    storedCharge: number;
    dynamicCharge: number;
    difference: number;
  }>;
}

// Pagination with aggregation interface
export interface ChargesPagination {
  page: number;
  limit: number;
  total: number;
  aggregation?: {
    grandTotal: number;
    chargeableCount: number;
    totalRecords: number;
  };
}

export interface PaginatedResponse<T> {
  transactions: T[];
  page: number;
  limit: number;
  total: number;
}


export interface GatepassData {
  doNumber: string;
  date: string;
  party: Pick<Party, 'name'>;
  vehicleNumber: string;
  items: {
    balance: number;
    lotNumber: string;
    itemName: string;
    quantity: number;
    unitName: string;
    warehouses: string;
  }[];
}


// src/types/index.ts

export interface Charge {
  _id: string;
  party: Pick<Party, '_id' | 'name'>;
  item: Pick<Item, '_id' | 'name' | 'category'>;
  lotNumber: string;
  unit: Pick<PackagingUnit, '_id' | 'name' | 'rate'>;
  quantity: number;
  shortage: number;
  extra: number;
  chargeable: boolean;
  isNil?: boolean;
  warehouses: Pick<GalaLocation, '_id' | 'name'>[];
  inwardDates: Array<string>;
  earliestEntryAt: string;
  latestEntryAt: string;
  anchorDate: string;
  anniversaryDay: number;
  firstMonth: object;
  charge: number;
  totalCharge: number;
  billingStatus?: 'unbilled' | 'billed' | 'partially_billed';
  billedAmount?: number;
  associatedBills?: Array<{
    billId: string;
    billNumber: string;
    amount: number;
    billedAt: string;
  }>;
  breakdown: Array<{
    kind: string;
    _id?: string;
    date: string;
    label?: string;
    type?: string;
    quantity?: number;
    shortage?: number;
    extra?: number;
    doNumber?: string;
    vehicleNumber?: string;
    remark?: string;
    balance?: number;
    balanceAtBoundary?: number;
    rateApplied?: number;
    amount?: number;
  }>
}

// Billing-related interfaces
export interface Bill {
  _id: string;
  billNumber: string;          // Auto-generated unique identifier
  party: Pick<Party, '_id' | 'name'>;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  year: number;
  amount: number;
  billDate: string;           // ISO date string
  status: 'unpaid' | 'partial' | 'paid';
  paidAmount: number;         // Sum of all payments
  outstandingAmount: number;  // amount - paidAmount
  description?: string;
  pdfPath?: string;          // Path to generated PDF
  isSplit?: boolean;
  particulars?: string;
  includedCharges?: Array<{
    chargeId: string;
    lotNumber: string;
    amount: number;
    totalCharge: number;
  }>;
  chargesSnapshot?: {
    totalChargesAmount: number;
    chargeCount: number;
    calculatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  _id: string;
  paymentNumber: string;      // Auto-generated unique identifier
  bill: Pick<Bill, '_id' | 'billNumber'>;
  party: Pick<Party, '_id' | 'name'>;
  amount: number;
  paymentMethod: 'cash' | 'cheque' | 'ecs' | 'bank_transfer';
  paymentDate: string;        // ISO date string
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    chequeNumber?: string;
    transactionId?: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PartyFinancialSummary {
  party: Pick<Party, '_id' | 'name'>;
  totalCharges: number;       // From charges system
  totalBilled: number;        // Sum of all bills
  totalPaid: number;          // Sum of all payments
  outstandingBalance: number; // totalBilled - totalPaid
  lastBillDate?: string;
  lastPaymentDate?: string;
  billCount: number;
  paymentCount: number;
}

export interface BillingHistoryItem {
  _id: string;
  type: 'bill' | 'payment';
  date: string;
  amount: number;
  description: string;
  billNumber?: string;
  paymentNumber?: string;
  paymentMethod?: string;
  runningBalance: number;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
}

declare global {
  interface Window {
    electron: {
      window?: {
        minimize?: () => Promise<{ ok: boolean }>;
        toggleMaximize?: () => Promise<{ ok: boolean; maximized?: boolean }>;
        close?: () => Promise<{ ok: boolean }>;
        pdfPreview?: (dataUri: string, fileName: string) => Promise<{ ok: boolean; error?: string }>;
      };
      secure: {
        hasMongoUri: () => Promise<{ ok: boolean; data?: boolean; error?: string }>;
        setMongoUri: (uri: string) => Promise<{ ok: boolean; error?: string }>;
        clearMongoUri: () => Promise<{ ok: boolean; error?: string }>;
      };
      encryption: {
        hasKey: () => Promise<{ ok: boolean; data?: boolean; error?: string }>;
        setKey: (password: string) => Promise<{ ok: boolean; error?: string }>;
        rotateKey: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
        getMetadata: () => Promise<{ ok: boolean; data?: { createdAt: Date; lastRotated: Date; version: number; isRotationRecommended: boolean } | null; error?: string }>;
        clearKey: () => Promise<{ ok: boolean; error?: string }>;
        validateKeyStrength: () => Promise<{ ok: boolean; data?: boolean; error?: string }>;
        rotateKeyWithMigration: (newPassword: string) => Promise<{ ok: boolean; data?: MigrationProgress; error?: string }>;
        cancelMigration: () => Promise<{ ok: boolean; error?: string }>;
        rollbackMigration: () => Promise<{ ok: boolean; error?: string }>;
        getMigrationProgress: () => Promise<{ ok: boolean; data?: MigrationProgress; error?: string }>;
        onMigrationProgress: (callback: (progress: MigrationProgress) => void) => void;
        offMigrationProgress: () => void;
        cancelDecryption: () => Promise<{ ok: boolean; error?: string }>;
        getDecryptionProgress: () => Promise<{ ok: boolean; data?: DecryptionProgress; error?: string }>;
        onDecryptionProgress: (callback: (progress: DecryptionProgress) => void) => void;
        offDecryptionProgress: () => void;
      };
      email: {
        hasConfig: () => Promise<{ ok: boolean; data?: boolean; error?: string }>;
        getConfig: () => Promise<{ ok: boolean; data?: EmailConfigDisplay | null; error?: string }>;
        setConfig: (config: EmailConfig) => Promise<{ ok: boolean; error?: string }>;
        setEnabled: (enabled: boolean) => Promise<{ ok: boolean; error?: string }>;
        testConfig: (config?: EmailConfig) => Promise<{ ok: boolean; data?: boolean; error?: string }>;
        clearConfig: () => Promise<{ ok: boolean; error?: string }>;
        sendOutwardReport: (batchId: string, partyId: string) => Promise<{ ok: boolean; data?: { messageId?: string }; error?: string }>;
        sendMonthlyReport: (month: number, year: number, partyId: string) => Promise<{ ok: boolean; data?: { messageId?: string }; error?: string }>;
      };
      company: {
        get: () => Promise<{ ok: boolean; data?: any; error?: string }>;
        update: (id: string, updates: any) => Promise<{ ok: boolean; data?: any; error?: string }>;
        create: (payload: any) => Promise<{ ok: boolean; data?: any; error?: string }>;
      };
      parties: {
        getAll: () => Promise<{ ok: boolean; data?: any[]; error?: string }>;
        getById: (id: string) => Promise<{ ok: boolean; data?: any; error?: string }>;
        getByName: (name: string) => Promise<{ ok: boolean; data?: any; error?: string }>;
        create: (payload: any) => Promise<{ ok: boolean; data?: any; error?: string }>;
        update: (id: string, updates: any) => Promise<{ ok: boolean; data?: any; error?: string }>;
        delete: (id: string) => Promise<{ ok: boolean; data?: any; error?: string }>;
      };
      items: {
        getAll: () => Promise<{ ok: boolean; data?: any[]; error?: string }>;
        getById: (id: string) => Promise<{ ok: boolean; data?: any; error?: string }>;
        getByName: (name: string) => Promise<{ ok: boolean; data?: any; error?: string }>;
        create: (payload: any) => Promise<{ ok: boolean; data?: any; error?: string }>;
        update: (id: string, updates: any) => Promise<{ ok: boolean; data?: any; error?: string }>;
        delete: (id: string) => Promise<{ ok: boolean; data?: any; error?: string }>;
      };
      units: {
        getAll: () => Promise<{ ok: boolean; data?: any[]; error?: string }>;
        getById: (id: string) => Promise<{ ok: boolean; data?: any; error?: string }>;
        getByName: (name: string) => Promise<{ ok: boolean; data?: any; error?: string }>;
        create: (payload: any) => Promise<{ ok: boolean; data?: any; error?: string }>;
        update: (id: string, updates: any) => Promise<{ ok: boolean; data?: any; error?: string }>;
        delete: (id: string) => Promise<{ ok: boolean; data?: any; error?: string }>;
      };
      warehouse: {
        getAll: () => Promise<{ ok: boolean; data?: any[]; error?: string }>;
        create: (payload: any) => Promise<{ ok: boolean; data?: any; error?: string }>;
      };
      transactions: {
        getAll: (params?: any) => Promise<{ ok: boolean; data?: { transactions: any[]; page: number; limit: number; total: number }; error?: string }>;
        getById: (id: string) => Promise<{ ok: boolean; data?: any; error?: string }>;
        create: (payload: any) => Promise<{ ok: boolean; data?: any; error?: string }>;
        update: (id: string, body: any) => Promise<{ ok: boolean; data?: any; error?: string }>;
        delete: (id: string) => Promise<{ ok: boolean; data?: any; error?: string }>;
        getLotNumbers: (search?: string) => Promise<{ ok: boolean; data?: string[]; error?: string }>;
        getDoNumbers: (search?: string) => Promise<{ ok: boolean; data?: string[]; error?: string }>;
        getGatepassData: (batchId: string) => Promise<{ ok: boolean; data?: any; error?: string }>;
        createMany: (payloads: any[]) => Promise<{ ok: boolean; data?: any; error?: string }>;
      };
      stocks: {
        getAll: (params?: any) => Promise<{ ok: boolean; data?: { stocks: any[]; page: number; limit: number; total: number }; error?: string }>;
        getById: (id: string) => Promise<{ ok: boolean; data?: any; error?: string }>;
        migrateLotNumbers: () => Promise<{ ok: boolean; data?: any; error?: string }>;
      };
      download: {
        getDirectory: () => Promise<{ ok: boolean; data?: string; error?: string }>;
        setDirectory: (dirPath: string) => Promise<{ ok: boolean; data?: string; error?: string }>;
        openDirectory: () => Promise<{ ok: boolean; error?: string }>;
        start: (url: string) => Promise<{ ok: boolean; error?: string }>;
      };
      charges: {
        getAll: (params?: any) => Promise<{ ok: boolean; data?: { results: any[]; page: number; limit: number; total: number }; error?: string }>;
        getById: (id: string) => Promise<{ ok: boolean; data?: any; error?: string }>;
        migrateExisting: () => Promise<{ ok: boolean; data?: ChargeMigrationResult; error?: string }>;
        validateMigration: (sampleSize?: number) => Promise<{ ok: boolean; data?: ChargeMigrationValidation; error?: string }>;
        cleanupOrphaned: () => Promise<{ ok: boolean; data?: number; error?: string }>;
        getByParty: (partyId: string) => Promise<{ ok: boolean; data?: Charge[]; error?: string }>;
        getUnbilledCharges: (partyId: string, quarter: string, year: number) => Promise<{ ok: boolean; data?: Charge[]; error?: string }>;
        markChargesAsBilled: (chargeIds: string[], billId: string, billNumber: string) => Promise<{ ok: boolean; data?: boolean; error?: string }>;
        validateChargesForBilling: (chargeIds: string[]) => Promise<{ ok: boolean; data?: { valid: boolean; errors?: string[] }; error?: string }>;
      };
      bills: {
        getAll: (params?: {
          page?: number;
          limit?: number;
          partyId?: string;
          status?: string | string[];
          quarter?: string;
          year?: number;
          sort?: string;
          order?: 'asc' | 'desc';
        }) => Promise<{ ok: boolean; data?: { bills: Bill[]; pagination: PaginationInfo }; error?: string }>;
        getById: (id: string) => Promise<{ ok: boolean; data?: Bill; error?: string }>;
        create: (billData: Omit<Bill, '_id' | 'createdAt' | 'updatedAt'>) => Promise<{ ok: boolean; data?: Bill; error?: string }>;
        update: (id: string, updates: Partial<Bill>) => Promise<{ ok: boolean; data?: Bill; error?: string }>;
        delete: (id: string) => Promise<{ ok: boolean; data?: { success: boolean }; error?: string }>;
        generatePdf: (id: string) => Promise<{ ok: boolean; data?: { pdfPath: string }; error?: string }>;
        getFinancialSummary: (params?: {
          partyId?: string;
        }) => Promise<{ ok: boolean; data?: PartyFinancialSummary[]; error?: string }>;
      };
      payments: {
        getAll: (params?: {
          page?: number;
          limit?: number;
          partyId?: string;
          billId?: string;
          paymentMethod?: string;
          sort?: string;
          order?: 'asc' | 'desc';
        }) => Promise<{ ok: boolean; data?: { payments: Payment[]; pagination: PaginationInfo }; error?: string }>;
        getById: (id: string) => Promise<{ ok: boolean; data?: Payment; error?: string }>;
        create: (paymentData: Omit<Payment, '_id' | 'createdAt' | 'updatedAt'>) => Promise<{ ok: boolean; data?: Payment; error?: string }>;
        update: (id: string, updates: Partial<Payment>) => Promise<{ ok: boolean; data?: Payment; error?: string }>;
        delete: (id: string) => Promise<{ ok: boolean; data?: { success: boolean }; error?: string }>;
        getBillingHistory: (partyId: string, params?: {
          startDate?: string;
          endDate?: string;
        }) => Promise<{ ok: boolean; data?: BillingHistoryItem[]; error?: string }>;
      };
      autobackup: {
        getConfig: () => Promise<{ ok: boolean; data?: { frequency: string; directory: string } | null; error?: string }>;
        setConfig: (config: { frequency: string; directory: string }) => Promise<{ ok: boolean; error?: string }>;
        selectDirectory: () => Promise<{ ok: boolean; data?: string; error?: string }>;
        triggerBackup: () => Promise<{ ok: boolean; data?: string; error?: string }>;
      };
      db: {
        listCollections: () => Promise<{ ok: boolean; data?: string[]; error?: string }>;
        dropCollections: (names: string[]) => Promise<{ ok: boolean; data?: { dropped: string[]; failed: { name: string; error: string }[] }; error?: string }>;
        exportCollections: (names: string[], format: 'json' | 'csv') => Promise<{ ok: boolean; data?: { savedTo: string }; error?: string }>;
        importCollections: () => Promise<{ ok: boolean; data?: { imported: { name: string; count: number }[]; skipped: { name: string; reason: string }[]; failed: { name: string; error: string }[] }; error?: string }>;
      };
    };
  }
}
