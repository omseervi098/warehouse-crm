
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electron', {
    platform: process.platform,
    window: {
        minimize: async () => ipcRenderer.invoke('window:minimize'),
        toggleMaximize: async () => ipcRenderer.invoke('window:toggleMaximize'),
        close: async () => ipcRenderer.invoke('window:close'),
        pdfPreview: async (dataUri: string, fileName: string) => {
            return await ipcRenderer.invoke('window:previewPdf', dataUri, fileName);
        }
    },
    secure: {
        hasMongoUri: async () => {
            return await ipcRenderer.invoke('secure:hasMongoUri');
        },
        setMongoUri: async (uri: string) => {
            return await ipcRenderer.invoke('secure:setMongoUri', uri);
        },
        clearMongoUri: async () => {
            return await ipcRenderer.invoke('secure:clearMongoUri');
        }
    },
    encryption: {
        hasKey: async () => {
            return await ipcRenderer.invoke('encryption:hasKey');
        },
        setKey: async (password: string) => {
            return await ipcRenderer.invoke('encryption:setKey', password);
        },
        rotateKey: async (newPassword: string) => {
            return await ipcRenderer.invoke('encryption:rotateKey', newPassword);
        },
        getMetadata: async () => {
            return await ipcRenderer.invoke('encryption:getMetadata');
        },
        clearKey: async () => {
            return await ipcRenderer.invoke('encryption:clearKey');
        },
        validateKeyStrength: async () => {
            return await ipcRenderer.invoke('encryption:validateKeyStrength');
        },
        rotateKeyWithMigration: async (newPassword: string) => {
            return await ipcRenderer.invoke('encryption:rotateKeyWithMigration', newPassword);
        },
        cancelMigration: async () => {
            return await ipcRenderer.invoke('encryption:cancelMigration');
        },
        rollbackMigration: async () => {
            return await ipcRenderer.invoke('encryption:rollbackMigration');
        },
        getMigrationProgress: async () => {
            return await ipcRenderer.invoke('encryption:getMigrationProgress');
        },
        onMigrationProgress: (callback: (progress: any) => void) => {
            ipcRenderer.on('encryption:migrationProgress', (_event: any, progress: any) => callback(progress));
        },
        offMigrationProgress: () => {
            ipcRenderer.removeAllListeners('encryption:migrationProgress');
        },
        cancelDecryption: async () => {
            return await ipcRenderer.invoke('encryption:cancelDecryption');
        },
        getDecryptionProgress: async () => {
            return await ipcRenderer.invoke('encryption:getDecryptionProgress');
        },
        onDecryptionProgress: (callback: (progress: any) => void) => {
            ipcRenderer.on('encryption:decryptionProgress', (_event: any, progress: any) => callback(progress));
        },
        offDecryptionProgress: () => {
            ipcRenderer.removeAllListeners('encryption:decryptionProgress');
        }
    },
    email: {
        hasConfig: async () => {
            return await ipcRenderer.invoke('email:hasConfig');
        },
        getConfig: async () => {
            return await ipcRenderer.invoke('email:getConfig');
        },
        setConfig: async (config: { gmailAddress: string; appPassword: string; enabled: boolean }) => {
            return await ipcRenderer.invoke('email:setConfig', config);
        },
        setEnabled: async (enabled: boolean) => {
            return await ipcRenderer.invoke('email:setEnabled', enabled);
        },
        testConfig: async (config?: { gmailAddress: string; appPassword: string; enabled: boolean }) => {
            return await ipcRenderer.invoke('email:testConfig', config);
        },
        clearConfig: async () => {
            return await ipcRenderer.invoke('email:clearConfig');
        },
        sendOutwardReport: async (batchId: string, partyId: string) => {
            return await ipcRenderer.invoke('email:sendOutwardReport', { batchId, partyId });
        },
        sendMonthlyReport: async (month: number, year: number, partyId: string) => {
            return await ipcRenderer.invoke('email:sendMonthlyReport', { month, year, partyId });
        }
    },
    autobackup: {
        getConfig: async () => ipcRenderer.invoke('autobackup:getConfig'),
        setConfig: async (config: any) => ipcRenderer.invoke('autobackup:setConfig', config),
        selectDirectory: async () => ipcRenderer.invoke('autobackup:selectDirectory'),
        triggerBackup: async () => ipcRenderer.invoke('autobackup:triggerBackup'),
    },
    db: {
        listCollections: async () => ipcRenderer.invoke('db:listCollections'),
        dropCollections: async (names: string[]) => ipcRenderer.invoke('db:dropCollections', names),
        exportCollections: async (names: string[], format: 'ejson' | 'json' | 'csv') => ipcRenderer.invoke('db:exportCollections', { names, format }),
        importCollections: async () => ipcRenderer.invoke('db:importCollections'),
    },
    company: {
        get: async () => {
            return await ipcRenderer.invoke('company:get');
        },
        update: async (id: string, updates: any) => {
            return await ipcRenderer.invoke('company:update', { id, updates });
        },
        create: async (payload: any) => {
            return await ipcRenderer.invoke('company:create', payload);
        },
    },
    parties: {
        getAll: async () => ipcRenderer.invoke('parties:getAll'),
        getById: async (id: string) => ipcRenderer.invoke('parties:getById', id),
        getByName: async (name: string) => ipcRenderer.invoke('parties:getByName', name),
        create: async (payload: any) => ipcRenderer.invoke('parties:create', payload),
        update: async (id: string, updates: any) => ipcRenderer.invoke('parties:update', { id, updates }),
        delete: async (id: string) => ipcRenderer.invoke('parties:delete', id),
    },
    items: {
        getAll: async () => ipcRenderer.invoke('items:getAll'),
        getById: async (id: string) => ipcRenderer.invoke('items:getById', id),
        getByName: async (name: string) => ipcRenderer.invoke('items:getByName', name),
        create: async (payload: any) => ipcRenderer.invoke('items:create', payload),
        update: async (id: string, updates: any) => ipcRenderer.invoke('items:update', { id, updates }),
        delete: async (id: string) => ipcRenderer.invoke('items:delete', id),
    },
    units: {
        getAll: async () => ipcRenderer.invoke('units:getAll'),
        getById: async (id: string) => ipcRenderer.invoke('units:getById', id),
        getByName: async (name: string) => ipcRenderer.invoke('units:getByName', name),
        create: async (payload: any) => ipcRenderer.invoke('units:create', payload),
        update: async (id: string, updates: any) => ipcRenderer.invoke('units:update', { id, updates }),
        delete: async (id: string) => ipcRenderer.invoke('units:delete', id),
    },
    warehouse: {
        getAll: async () => ipcRenderer.invoke('warehouse:getAll'),
        create: async (payload: any) => ipcRenderer.invoke('warehouse:create', payload),
    },
    transactions: {
        getAll: async (params?: any) => ipcRenderer.invoke('transactions:getAll', params),
        getById: async (id: string) => ipcRenderer.invoke('transactions:getById', id),
        create: async (payload: any) => ipcRenderer.invoke('transactions:create', payload),
        update: async (id: string, body: any) => ipcRenderer.invoke('transactions:update', { id, body }),
        delete: async (id: string) => ipcRenderer.invoke('transactions:delete', id),
        getLotNumbers: async (search?: string) => ipcRenderer.invoke('transactions:lotNumbers', search),
        getDoNumbers: async (search?: string) => ipcRenderer.invoke('transactions:doNumbers', search),
        getGatepassData: async (batchId: string) => ipcRenderer.invoke('transactions:gatepass', batchId),
        createMany: async (payloads: any[]) => ipcRenderer.invoke('transactions:createMany', payloads),
    },
    stocks: {
        getAll: async (params?: any) => ipcRenderer.invoke('stocks:getAll', params),
        getById: async (id: string) => ipcRenderer.invoke('stocks:getById', id),
        migrateLotNumbers: async () => ipcRenderer.invoke('stocks:migrateLotNumbers'),
        migrateChargeRates: async () => ipcRenderer.invoke('stocks:migrateChargeRates'),
    },
    charges: {
        getAll: async (params?: any) => ipcRenderer.invoke('charges:getAll', params),
        getById: async (id: string) => ipcRenderer.invoke('charges:getById', id),
        getByParty: async (partyId: string) => ipcRenderer.invoke('charges:getByParty', partyId),
        getAllParties: async () => ipcRenderer.invoke('charges:getAllParties'),
        migrateExisting: async () => ipcRenderer.invoke('charges:migrateExisting'),
        validateMigration: async (sampleSize?: number) => ipcRenderer.invoke('charges:validateMigration', sampleSize),
        cleanupOrphaned: async () => ipcRenderer.invoke('charges:cleanupOrphaned'),
        batchUpdate: async (lotNumbers: string[], batchSize?: number) => ipcRenderer.invoke('charges:batchUpdate', { lotNumbers, batchSize }),
        backgroundUpdate: async (lotNumbers: string[], options?: any) => ipcRenderer.invoke('charges:backgroundUpdate', { lotNumbers, options }),
        getLotsNeedingRecalculation: async (limit?: number) => ipcRenderer.invoke('charges:getLotsNeedingRecalculation', limit),
        getByPartyPaginated: async (partyId: string, options?: any) => ipcRenderer.invoke('charges:getByPartyPaginated', { partyId, options }),
        getAllPartiesPaginated: async (options?: any) => ipcRenderer.invoke('charges:getAllPartiesPaginated', options),
        getUnbilledCharges: async (partyId: string, quarter: string, year: number) => ipcRenderer.invoke('charges:getUnbilledCharges', { partyId, quarter, year }),
        getQuarterCharges: async (partyId: string, quarter: string, year: number) => ipcRenderer.invoke('charges:getQuarterCharges', { partyId, quarter, year }),
        markChargesAsBilled: async (chargeIds: any[], billId: string, billNumber: string) => ipcRenderer.invoke('charges:markChargesAsBilled', { chargeIds, billId, billNumber }),
        validateChargesForBilling: async (chargeIds: any[]) => ipcRenderer.invoke('charges:validateChargesForBilling', chargeIds),
    },
    bills: {
        getAll: async (params?: any) => ipcRenderer.invoke('bills:getAll', params),
        getById: async (id: string) => ipcRenderer.invoke('bills:getById', id),
        create: async (billData: any) => ipcRenderer.invoke('bills:create', billData),
        update: async (id: string, updates: any) => ipcRenderer.invoke('bills:update', { id, updates }),
        delete: async (id: string) => ipcRenderer.invoke('bills:delete', id),
        generatePdf: async (id: string) => ipcRenderer.invoke('bills:generatePdf', id),
        getFinancialSummary: async (params?: any) => ipcRenderer.invoke('bills:getFinancialSummary', params),
    },
    payments: {
        getAll: async (params?: any) => ipcRenderer.invoke('payments:getAll', params),
        getById: async (id: string) => ipcRenderer.invoke('payments:getById', id),
        create: async (paymentData: any) => ipcRenderer.invoke('payments:create', paymentData),
        update: async (id: string, updates: any) => ipcRenderer.invoke('payments:update', { id, updates }),
        delete: async (id: string) => ipcRenderer.invoke('payments:delete', id),
        getBillingHistory: async (partyId: string, params?: any) => ipcRenderer.invoke('payments:getBillingHistory', { partyId, params }),
    },
});
