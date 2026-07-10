// Electron IPC wrapper that mimics axios-style { data } responses
async function ipcCall<T>(invoker: Promise<{ ok: boolean; data?: T; error?: string }>): Promise<{ data: T }> {
  const res = await invoker;
  if (!res || res.ok !== true) {
    const msg = (res && res.error) || 'IPC call failed';
    throw new Error(msg);
  }
  return { data: res.data as T };
}

// Company API
export const companyApi = {
  get: () => ipcCall(window.electron.company.get()),
  update: (id: string, data: any) => ipcCall(window.electron.company.update(id, data)),
  create: (data: any) => ipcCall(window.electron.company.create(data)),
};

// Items API
export const itemsApi = {
  getAll: () => ipcCall(window.electron.items.getAll()),
  getById: (id: string) => ipcCall(window.electron.items.getById(id)),
  getByName: (name: string) => ipcCall(window.electron.items.getByName(name)),
  create: (data: any) => ipcCall(window.electron.items.create(data)),
  update: (id: string, data: any) => ipcCall(window.electron.items.update(id, data)),
  delete: (id: string) => ipcCall(window.electron.items.delete(id)),
};

// Parties API
export const partiesApi = {
  getAll: () => ipcCall(window.electron.parties.getAll()),
  getById: (id: string) => ipcCall(window.electron.parties.getById(id)),
  getByName: (name: string) => ipcCall(window.electron.parties.getByName(name)),
  create: (data: any) => ipcCall(window.electron.parties.create(data)),
  update: (id: string, data: any) => ipcCall(window.electron.parties.update(id, data)),
  delete: (id: string) => ipcCall(window.electron.parties.delete(id)),
};

// Transactions API
export const transactionsApi = {
  getAll: async (params?: any) => ipcCall(window.electron.transactions.getAll(params)),
  getById: (id: string) => ipcCall(window.electron.transactions.getById(id)),
  create: (data: any) => ipcCall(window.electron.transactions.create(data)),
  createMany: (data: any[]) => ipcCall(window.electron.transactions.createMany(data)),
  update: (id: string, data: any) => ipcCall(window.electron.transactions.update(id, data)),
  delete: (id: string) => ipcCall(window.electron.transactions.delete(id)),
  getLotNumbers: (search?: string) => ipcCall(window.electron.transactions.getLotNumbers(search)),
  getDoNumbers: (search?: string) => ipcCall(window.electron.transactions.getDoNumbers(search)),
  getGatepassData: (batchId: string) => ipcCall(window.electron.transactions.getGatepassData(batchId)),
};

// Units (Packaging) API
export const unitsApi = {
  getAll: () => ipcCall(window.electron.units.getAll()),
  getById: (id: string) => ipcCall(window.electron.units.getById(id)),
  getByName: (name: string) => ipcCall(window.electron.units.getByName(name)),
  create: (data: any) => ipcCall(window.electron.units.create(data)),
  update: (id: string, data: any) => ipcCall(window.electron.units.update(id, data)),
  delete: (id: string) => ipcCall(window.electron.units.delete(id)),
};

// Warehouse (Locations) API
export const warehouseApi = {
  getAll: () => ipcCall(window.electron.warehouse.getAll()),
  create: (data: any) => ipcCall(window.electron.warehouse.create(data)),
};

// Stock Balance API
export const stockBalanceApi = {
  getAll: (params?: any) => ipcCall(window.electron.stocks.getAll(params)),
  getById: (id: string) => ipcCall(window.electron.stocks.getById(id)),
  migrateLotNumbers: () => ipcCall(window.electron.stocks.migrateLotNumbers()),
  migrateChargeRates: () => ipcCall((window.electron.stocks as any).migrateChargeRates()),
};

// Charges API
export const chargesApi = {
  getAll: (params?: any) => ipcCall(window.electron.charges.getAll(params)),
  getById: (id: string) => ipcCall(window.electron.charges.getById(id)),
  getByParty: (partyId: string) => ipcCall((window.electron.charges as any).getByParty(partyId)),
  getAllParties: () => ipcCall((window.electron.charges as any).getAllParties()),

  // Batch processing methods
  batchUpdate: (lotNumbers: string[], batchSize?: number) =>
    ipcCall((window.electron.charges as any).batchUpdate(lotNumbers, batchSize)),
  backgroundUpdate: (lotNumbers: string[], options?: any) =>
    ipcCall((window.electron.charges as any).backgroundUpdate(lotNumbers, options)),
  getLotsNeedingRecalculation: (limit?: number) =>
    ipcCall((window.electron.charges as any).getLotsNeedingRecalculation(limit)),

  // Pagination methods
  getByPartyPaginated: (partyId: string, options?: any) =>
    ipcCall((window.electron.charges as any).getByPartyPaginated(partyId, options)),
  getAllPartiesPaginated: (options?: any) =>
    ipcCall((window.electron.charges as any).getAllPartiesPaginated(options)),

  // Migration methods
  migrateExisting: () =>
    ipcCall((window.electron.charges as any).migrateExisting()),
  validateMigration: (sampleSize?: number) =>
    ipcCall((window.electron.charges as any).validateMigration(sampleSize)),
  cleanupOrphaned: () =>
    ipcCall((window.electron.charges as any).cleanupOrphaned()),

  // Billing integration methods
  getUnbilledCharges: (partyId: string, quarter: string, year: number) =>
    ipcCall((window.electron.charges as any).getUnbilledCharges(partyId, quarter, year)),
  getQuarterCharges: (partyId: string, quarter: string, year: number) =>
    ipcCall((window.electron.charges as any).getQuarterCharges(partyId, quarter, year)),
  markChargesAsBilled: (chargeIds: string[], billId: string, billNumber: string) =>
    ipcCall((window.electron.charges as any).markChargesAsBilled(chargeIds, billId, billNumber)),
  validateChargesForBilling: (chargeIds: string[]) =>
    ipcCall((window.electron.charges as any).validateChargesForBilling(chargeIds)),
};

// Email API
export const emailApi = {
  sendOutwardReport: (batchId: string, partyId: string) => ipcCall<{ messageId?: string }>(window.electron.email.sendOutwardReport(batchId, partyId)),
  sendMonthlyReport: (month: number, year: number, partyId: string) => ipcCall<{ messageId?: string }>(window.electron.email.sendMonthlyReport(month, year, partyId)),
};

// Bills API
export const billsApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    partyId?: string;
    status?: string | string[];
    quarter?: string;
    year?: number;
    sort?: string;
    order?: 'asc' | 'desc';
  }) => ipcCall(window.electron.bills.getAll(params)),

  getById: (id: string) => ipcCall(window.electron.bills.getById(id)),

  create: (billData: any) => ipcCall(window.electron.bills.create(billData)),

  update: (id: string, updates: any) => ipcCall(window.electron.bills.update(id, updates)),

  delete: (id: string) => ipcCall(window.electron.bills.delete(id)),

  generatePdf: (id: string) => ipcCall(window.electron.bills.generatePdf(id)),

  getFinancialSummary: (params?: {
    partyId?: string;
  }) => ipcCall(window.electron.bills.getFinancialSummary(params)),
};

// Payments API
export const paymentsApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    partyId?: string;
    billId?: string;
    paymentMethod?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }) => ipcCall(window.electron.payments.getAll(params)),

  getById: (id: string) => ipcCall(window.electron.payments.getById(id)),

  create: (paymentData: any) => ipcCall(window.electron.payments.create(paymentData)),

  update: (id: string, updates: any) => ipcCall(window.electron.payments.update(id, updates)),

  delete: (id: string) => ipcCall(window.electron.payments.delete(id)),

  getBillingHistory: (partyId: string, params?: {
    startDate?: string;
    endDate?: string;
  }) => ipcCall(window.electron.payments.getBillingHistory(partyId, params)),
};

// No default export; all APIs are IPC-based
export const dbApi = {
  listCollections: () => ipcCall<string[]>(window.electron.db.listCollections()),
  dropCollections: (names: string[]) => ipcCall<{ dropped: string[]; failed: { name: string; error: string }[] }>(window.electron.db.dropCollections(names)),
  exportCollections: (names: string[], format: 'ejson' | 'json' | 'csv') => ipcCall<{ savedTo: string }>(window.electron.db.exportCollections(names, format)),
  importCollections: () => ipcCall<{ imported: { name: string; count: number }[]; skipped: { name: string; reason: string }[]; failed: { name: string; error: string }[] }>(window.electron.db.importCollections()),
};
