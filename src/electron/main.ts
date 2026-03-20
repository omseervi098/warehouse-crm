import { app, BrowserWindow, dialog, ipcMain, Menu, Tray } from 'electron';
import dotenv from 'dotenv';
import keytar from 'keytar';
import mongoose from 'mongoose';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import Bill from './models/bill.js';
import Company from './models/company.js';
import Item from './models/item.js';
import Party from "./models/party.js";
import Payment from './models/payment.js';
import Stock from './models/stock.js';
import Transaction from './models/transaction.js';
import Unit from './models/unit.js';
import Warehouse from './models/warehouse.js';
import { getAssetsPath, getPdfPreviewPreloadPath, getPreloadPath, getUIPath } from './pathResolver.js';
import { isDev, validateEventFrame } from './utils.js';
import { computeChargesForLot } from './utils/charge.js';
import { ChargeService } from './utils/chargeService.js';
import { create as createDoc, deleteByID, getALL, updateByID } from './utils/common.js';
import { CryptoService } from './utils/crypto.js';
import DataDecryptionService, { DecryptionProgress } from './utils/dataDecryptionService.js';
import EmailConfigManager from './utils/emailConfigManager.js';
import EmailService from './utils/emailService.js';
import MongooseEncryptionMiddleware from './utils/encryptionMiddleware.js';
import { KeyManager } from './utils/keyManager.js';
import { KeyRotationService, type MigrationProgress } from './utils/keyRotationService.js';
import { buildFilterQuery, handleFilteredQuery } from './utils/queryHandler.js';
import ReportGenerator from './utils/reportGenerator.js';
import { recalculateStock } from './utils/stock.js';
const require = createRequire(import.meta.url);
// Use CJS require for modules lacking type declarations
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AdmZip: any = require('adm-zip');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Papa: any = require('papaparse');

if (app.isPackaged) {
    dotenv.config({ path: path.join(process.resourcesPath, '.env') });
} else {
    dotenv.config();
}

let autoUpdater: any;
try {
    // Prefer CJS require which is the canonical export format of electron-updater
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('electron-updater');
    autoUpdater = mod?.autoUpdater || mod?.default?.autoUpdater;
} catch {
    try {
        const mod: any = await import('electron-updater');
        autoUpdater = mod?.autoUpdater || mod?.default?.autoUpdater;
    } catch { }
}

function toPlain<T>(value: T): T {
    return value == null ? (value as T) : JSON.parse(JSON.stringify(value));
}

function setupAutoUpdater(mainWindow: BrowserWindow, tray: Tray) {
    if (!autoUpdater) {
        // Updater module couldn't be loaded; skip wiring and let UI handle messaging
        return;
    }
    // Configure updater behavior
    autoUpdater.autoDownload = false; // ask user before downloading
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('error', (err: any) => {
        dialog.showErrorBox('Auto Update Error', (err && (err as any).message) || String(err));
    });

    autoUpdater.on('checking-for-update', () => {
        // Optional: feedback to user
        mainWindow.webContents.send('autoUpdater:status', { status: 'checking' });
    });

    autoUpdater.on('update-not-available', () => {
        mainWindow.webContents.send('autoUpdater:status', { status: 'no-update' });
    });

    autoUpdater.on('update-available', (info: any) => {
        mainWindow.webContents.send('autoUpdater:status', { status: 'update-available', info });
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            buttons: ['Download', 'Later'],
            defaultId: 0,
            cancelId: 1,
            message: `Version ${info?.version || ''} is available. Download now?`
        }).then(({ response }) => {
            if (response === 0) {
                try { autoUpdater.downloadUpdate().catch(() => { }); } catch { }
            }
        });
    });

    autoUpdater.on('download-progress', (progress: any) => {
        mainWindow.webContents.send('autoUpdater:progress', progress);
    });

    autoUpdater.on('update-downloaded', (info: any) => {
        mainWindow.webContents.send('autoUpdater:status', { status: 'downloaded', info });
        dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['Install and Restart', 'Later'],
            defaultId: 0,
            cancelId: 1,
            message: 'Update downloaded. Do you want to install and restart now?'
        }).then(({ response }) => {
            if (response === 0) {
                setImmediate(() => autoUpdater.quitAndInstall());
            }
        });
    });
}

const KEYTAR_SERVICE = 'warehouse-crm';
const KEYTAR_ACCOUNT_MONGO_URI = 'MONGO_URI';

async function initMongo() {
    // Prefer secure storage via keytar. Fallback to env for development convenience.
    const fromKeytar = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_MONGO_URI);
    const mongoUri = fromKeytar || process.env.MONGO_URI;
    if (!mongoUri) return false;
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(mongoUri);
    }
    return true;
}



function registerIpcHandlers() {
    // Secure storage helpers for Mongo URI
    ipcMain.handle('secure:hasMongoUri', async () => {
        const existing = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_MONGO_URI);
        return { ok: true, data: Boolean(existing) };
    });
    ipcMain.handle('secure:setMongoUri', async (_e, uri: string) => {
        try {
            if (typeof uri !== 'string' || !uri.trim()) {
                return { ok: false, error: 'Invalid Mongo URI' };
            }
            validateEventFrame(_e.senderFrame);
            await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_MONGO_URI, uri.trim());
            // Try connecting immediately to validate
            if (mongoose.connection.readyState === 1) {
                await mongoose.disconnect();
            }
            await mongoose.connect(uri.trim());
            return { ok: true };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });
    ipcMain.handle('secure:clearMongoUri', async () => {
        try {
            await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_MONGO_URI);
            if (mongoose.connection.readyState === 1) {
                await mongoose.disconnect();
            }
            return { ok: true };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    // Encryption key management handlers
    ipcMain.handle('encryption:hasKey', async () => {
        try {
            const hasKey = await KeyManager.hasEncryptionKey();
            return { ok: true, data: hasKey };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('encryption:setKey', async (_e, password: string) => {
        try {
            validateEventFrame(_e.senderFrame);

            if (!password || typeof password !== 'string') {
                return { ok: false, error: 'Invalid password provided' };
            }

            if (password.length < 8) {
                return { ok: false, error: 'Password must be at least 8 characters long' };
            }

            await KeyManager.setEncryptionKeyFromPassword(password);
            return { ok: true };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('encryption:rotateKey', async (_e, newPassword: string) => {
        try {
            validateEventFrame(_e.senderFrame);

            if (!newPassword || typeof newPassword !== 'string') {
                return { ok: false, error: 'Invalid new password provided' };
            }

            if (newPassword.length < 8) {
                return { ok: false, error: 'New password must be at least 8 characters long' };
            }

            // Generate new key from password using fixed salt
            const newKey = CryptoService.deriveKey(newPassword);

            await KeyManager.rotateKey(newKey);
            return { ok: true };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('encryption:getMetadata', async () => {
        try {
            const metadata = await KeyManager.getKeyMetadata();
            const isRotationRecommended = await KeyManager.isRotationRecommended();

            return {
                ok: true,
                data: metadata ? {
                    ...metadata,
                    isRotationRecommended
                } : null
            };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    // Data decryption service for clearing encryption
    let currentDecryptionService: DataDecryptionService | null = null;

    ipcMain.handle('encryption:clearKey', async (_e) => {
        try {
            validateEventFrame(_e.senderFrame);

            // First decrypt all data to plain text
            currentDecryptionService = new DataDecryptionService();

            // Set up progress callback to send updates to renderer
            const wrappedProgressCallback = (progress: DecryptionProgress) => {
                _e.sender.send('encryption:decryptionProgress', progress);
            };

            const result = await currentDecryptionService.decryptAllData(wrappedProgressCallback);

            if (result.status === 'completed') {
                // Only clear the key if decryption was successful
                await KeyManager.clearEncryptionKey();
                currentDecryptionService = null;
                return { ok: true, data: result };
            } else {
                currentDecryptionService = null;
                return { ok: false, error: 'Failed to decrypt data before clearing key', data: result };
            }
        } catch (err: any) {
            currentDecryptionService = null;
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('encryption:cancelDecryption', async (_e) => {
        try {
            validateEventFrame(_e.senderFrame);

            if (currentDecryptionService) {
                currentDecryptionService.cancelDecryption();
                return { ok: true };
            }

            return { ok: false, error: 'No decryption in progress' };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('encryption:getDecryptionProgress', async (_e) => {
        try {
            validateEventFrame(_e.senderFrame);

            if (currentDecryptionService) {
                const progress = currentDecryptionService.getProgress();
                return { ok: true, data: progress };
            }

            return { ok: false, error: 'No decryption in progress' };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('encryption:validateKeyStrength', async () => {
        try {
            const isValid = await KeyManager.validateKeyStrength();
            return { ok: true, data: isValid };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    // Key rotation with data migration handlers
    let currentRotationService: KeyRotationService | null = null;

    ipcMain.handle('encryption:rotateKeyWithMigration', async (_e, newPassword: string, progressCallback?: (progress: MigrationProgress) => void) => {
        try {
            validateEventFrame(_e.senderFrame);

            if (!newPassword || typeof newPassword !== 'string') {
                return { ok: false, error: 'Invalid new password provided' };
            }

            if (newPassword.length < 8) {
                return { ok: false, error: 'New password must be at least 8 characters long' };
            }

            // Generate new key from password using fixed salt for multi-device compatibility
            const newKey = CryptoService.deriveKey(newPassword);

            // Create rotation service
            currentRotationService = new KeyRotationService();

            // Set up progress callback to send updates to renderer
            const wrappedProgressCallback = (progress: MigrationProgress) => {
                _e.sender.send('encryption:migrationProgress', progress);
                if (progressCallback) {
                    progressCallback(progress);
                }
            };

            // Start rotation and migration
            const keyUpdateCallback = async () => {
                await KeyManager.rotateKey(newKey);
            };
            const result = await currentRotationService.rotateKeyAndMigrateData(newKey, wrappedProgressCallback, keyUpdateCallback);

            // Clear the service reference
            currentRotationService = null;

            return { ok: true, data: result };
        } catch (err: any) {
            currentRotationService = null;
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('encryption:cancelMigration', async (_e) => {
        try {
            validateEventFrame(_e.senderFrame);

            if (currentRotationService) {
                currentRotationService.cancelMigration();
                return { ok: true };
            }

            return { ok: false, error: 'No migration in progress' };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('encryption:rollbackMigration', async (_e) => {
        try {
            validateEventFrame(_e.senderFrame);

            if (currentRotationService) {
                await currentRotationService.rollbackMigration();
                return { ok: true };
            }

            return { ok: false, error: 'No migration service available for rollback' };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('encryption:getMigrationProgress', async (_e) => {
        try {
            validateEventFrame(_e.senderFrame);

            if (currentRotationService) {
                const progress = currentRotationService.getProgress();
                return { ok: true, data: progress };
            }

            return { ok: false, error: 'No migration in progress' };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    // Email configuration handlers
    ipcMain.handle('email:hasConfig', async () => {
        try {
            const hasConfig = await EmailConfigManager.hasConfig();
            return { ok: true, data: hasConfig };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('email:getConfig', async () => {
        try {
            const config = await EmailConfigManager.getConfig();
            // Don't return the app password for security
            if (config) {
                return {
                    ok: true,
                    data: {
                        gmailAddress: config.gmailAddress,
                        enabled: config.enabled,
                        hasPassword: Boolean(config.appPassword)
                    }
                };
            }
            return { ok: true, data: null };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('email:setConfig', async (_e, config: { gmailAddress: string; appPassword: string; enabled: boolean }) => {
        try {
            validateEventFrame(_e.senderFrame);

            if (!config.gmailAddress || !config.appPassword) {
                return { ok: false, error: 'Gmail address and app password are required' };
            }

            // Validate configuration format
            if (!EmailConfigManager.validateConfigFormat(config)) {
                return { ok: false, error: 'Invalid email configuration format' };
            }

            await EmailConfigManager.setConfig(config);
            return { ok: true };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('email:setEnabled', async (_e, enabled: boolean) => {
        try {
            validateEventFrame(_e.senderFrame);
            await EmailConfigManager.setEnabled(enabled);
            return { ok: true };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('email:testConfig', async (_e, config?: { gmailAddress: string; appPassword: string; enabled: boolean }) => {
        try {
            validateEventFrame(_e.senderFrame);
            const testResult = await EmailConfigManager.testConfig(config);
            return { ok: true, data: testResult };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('email:clearConfig', async (_e) => {
        try {
            validateEventFrame(_e.senderFrame);
            await EmailConfigManager.clearConfig();
            return { ok: true };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    // Email sending handlers
    ipcMain.handle('email:sendOutwardReport', async (_e, { batchId, partyId }: { batchId: string; partyId: string }) => {
        try {
            validateEventFrame(_e.senderFrame);

            if (!batchId || !partyId) {
                return { ok: false, error: 'Batch ID and party ID are required' };
            }
            // Get email configuration
            const emailConfig = await EmailConfigManager.getConfig();
            if (!emailConfig || !emailConfig.enabled) {
                return { ok: false, error: 'Email is not configured or disabled' };
            }

            // Get party information for recipient email
            const party = await Party.findById(partyId).lean() as any;
            if (!party) {
                return { ok: false, error: 'Party not found' };
            }

            if (!party.orgEmail) {
                return { ok: false, error: 'Party does not have an organization email address' };
            }

            // Generate report content
            const reportContent = await ReportGenerator.generateOutwardReport(batchId, partyId);

            // Configure and send email
            const emailService = new EmailService();
            await emailService.configure(emailConfig);
            const emailResult = await emailService.sendEmail({
                to: party.orgEmail,
                subject: reportContent.subject,
                html: reportContent.html,
                attachments: reportContent.attachments
            });
            if (emailResult.success) {
                return { ok: true, data: { messageId: emailResult.messageId } };
            } else {
                return { ok: false, error: emailResult.error || 'Failed to send email' };
            }
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('email:sendMonthlyReport', async (_e, { month, year, partyId }: { month: number; year: number; partyId: string }) => {
        try {
            validateEventFrame(_e.senderFrame);

            if (!month || !year || !partyId) {
                return { ok: false, error: 'Month, year, and party ID are required' };
            }

            if (month < 1 || month > 12) {
                return { ok: false, error: 'Month must be between 1 and 12' };
            }

            // Get email configuration
            const emailConfig = await EmailConfigManager.getConfig();
            if (!emailConfig || !emailConfig.enabled) {
                return { ok: false, error: 'Email is not configured or disabled' };
            }

            // Get party information for recipient email
            const party = await Party.findById(partyId).lean() as any;
            if (!party) {
                return { ok: false, error: 'Party not found' };
            }

            if (!party.orgEmail) {
                return { ok: false, error: 'Party does not have an organization email address' };
            }

            // Generate report content
            const reportContent = await ReportGenerator.generateMonthlyStockReport(month, year, partyId);

            // Configure and send email
            const emailService = new EmailService();
            await emailService.configure(emailConfig);

            const emailResult = await emailService.sendEmail({
                to: party.orgEmail,
                subject: reportContent.subject,
                html: reportContent.html,
                attachments: reportContent.attachments
            });

            if (emailResult.success) {
                return { ok: true, data: { messageId: emailResult.messageId } };
            } else {
                return { ok: false, error: emailResult.error || 'Failed to send email' };
            }
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('db:ensureConnected', async () => {
        try {
            const ok = await initMongo();
            if (!ok) return { ok: false, error: 'Missing MONGO_URI. Use secure.setMongoUri first.' };
            return { ok: true };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('db:listCollections', async () => {
        try {
            const ok = await initMongo();
            if (!ok) return { ok: false, error: 'Missing MONGO_URI. Use secure.setMongoUri first.' };
            const db = mongoose.connection.db;
            if (!db) return { ok: false, error: 'Database not initialized' };
            const collections = await db.listCollections().toArray();
            const names = (collections || [])
                .map((c: any) => c.name)
                .filter((n: string) => n && !n.startsWith('system.'));
            return { ok: true, data: names };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('db:dropCollections', async (_e, names: string[]) => {
        try {
            const ok = await initMongo();
            if (!ok) return { ok: false, error: 'Missing MONGO_URI. Use secure.setMongoUri first.' };
            validateEventFrame(_e.senderFrame);
            if (!Array.isArray(names) || names.length === 0) return { ok: false, error: 'No collections provided' };
            const db = mongoose.connection.db;
            if (!db) return { ok: false, error: 'Database not initialized' };
            const dropped: string[] = [];
            const failed: { name: string; error: string }[] = [];
            for (const name of names) {
                if (!name || typeof name !== 'string' || name.startsWith('system.')) continue;
                try {
                    // If collection does not exist, skip
                    const exists = await db.listCollections({ name }).hasNext();
                    if (!exists) continue;
                    await db.dropCollection(name);
                    dropped.push(name);
                } catch (e: any) {
                    failed.push({ name, error: e?.message || String(e) });
                }
            }
            return { ok: true, data: { dropped, failed } };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });
    // Import collections from a ZIP (JSON or CSV files inside)
    ipcMain.handle('db:importCollections', async (_e) => {
        try {
            const ok = await initMongo();
            if (!ok) return { ok: false, error: 'Missing MONGO_URI. Use secure.setMongoUri first.' };
            validateEventFrame(_e.senderFrame);
            const { canceled, filePaths } = await dialog.showOpenDialog({
                title: 'Select Collections ZIP',
                filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
                properties: ['openFile']
            });
            if (canceled || !filePaths || filePaths.length === 0) return { ok: false, error: 'Import canceled' };
            const zipPath = filePaths[0];

            const db = mongoose.connection.db;
            if (!db) return { ok: false, error: 'Database not initialized' };

            const zip = new AdmZip(zipPath);
            const entries = zip.getEntries() || [];

            const summary: { imported: { name: string; count: number }[]; skipped: { name: string; reason: string }[]; failed: { name: string; error: string }[] } = { imported: [], skipped: [], failed: [] };

            for (const entry of entries) {
                if (entry.isDirectory) continue;
                const base = path.basename(entry.entryName);
                const ext = base.toLowerCase().endsWith('.json') ? 'json' : base.toLowerCase().endsWith('.csv') ? 'csv' : '';
                if (!ext) continue; // unsupported
                const name = base.replace(/\.(json|csv)$/i, '');
                if (!name || name.startsWith('system.')) { summary.skipped.push({ name: base, reason: 'Invalid or system collection' }); continue; }

                try {
                    const content = entry.getData().toString('utf8');
                    let docs: any[] = [];
                    if (ext === 'json') {
                        try { docs = JSON.parse(content); } catch (e: any) { throw new Error('Invalid JSON'); }
                        if (!Array.isArray(docs)) { throw new Error('JSON must be an array of documents'); }
                    } else {
                        const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
                        if (parsed.errors && parsed.errors.length > 0) {
                            // Continue with parsed data but note errors
                        }
                        docs = (parsed.data as any[]) || [];
                    }
                    // Best-effort fixups: convert _id to ObjectId and date-like strings to Date
                    const toObjectIdMaybe = (v: any) => {
                        if (typeof v === 'string' && /^[a-fA-F0-9]{24}$/.test(v)) {
                            try { return new (mongoose as any).Types.ObjectId(v); } catch { return v; }
                        }
                        return v;
                    };
                    const isIsoDateString = (s: string) => /^(\d{4}-\d{2}-\d{2})([Tt ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?)?([Zz]|[+\-]\d{2}:?\d{2})?$/.test(s);
                    const fixDates = (obj: any): any => {
                        if (obj == null) return obj;
                        if (typeof obj === 'string') {
                            return isIsoDateString(obj) ? new Date(obj) : obj;
                        }
                        if (Array.isArray(obj)) return obj.map(fixDates);
                        if (typeof obj === 'object') {
                            const out: any = {};
                            for (const [k, v] of Object.entries(obj)) {
                                if (k === '_id') { out[k] = toObjectIdMaybe(v); continue; }
                                // Heuristic: keys commonly indicating dates or ISO strings
                                if (typeof v === 'string' && (/(date|at)$/i.test(k) || isIsoDateString(v))) {
                                    const d = new Date(v);
                                    out[k] = isNaN(d.getTime()) ? v : d;
                                } else {
                                    out[k] = fixDates(v);
                                }
                            }
                            return out;
                        }
                        return obj;
                    };
                    docs = docs.map((d: any) => fixDates(d));

                    if (!docs || docs.length === 0) { summary.skipped.push({ name, reason: 'No documents' }); continue; }
                    const coll = db.collection(name);
                    const res = await coll.insertMany(docs, { ordered: false });
                    const count = (res && (res as any).insertedCount) || docs.length;
                    summary.imported.push({ name, count });
                } catch (e: any) {
                    summary.failed.push({ name, error: e?.message || String(e) });
                }
            }

            return { ok: true, data: summary };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    // Export selected collections to a ZIP (JSON or CSV)
    ipcMain.handle('db:exportCollections', async (_e, args: { names: string[]; format: 'json' | 'csv' }) => {
        try {
            const ok = await initMongo();
            if (!ok) return { ok: false, error: 'Missing MONGO_URI. Use secure.setMongoUri first.' };
            validateEventFrame(_e.senderFrame);
            const names = Array.isArray(args?.names) ? args.names.filter(n => typeof n === 'string' && !n.startsWith('system.') && n.trim() !== '') : [];
            const format = (args?.format === 'csv' ? 'csv' : 'json') as 'json' | 'csv';
            if (names.length === 0) return { ok: false, error: 'No collections provided' };
            const db = mongoose.connection.db;
            if (!db) return { ok: false, error: 'Database not initialized' };

            const zip = new AdmZip();
            for (const name of names) {
                const exists = await db.listCollections({ name }).hasNext();
                if (!exists) continue;
                const coll = db.collection(name);
                const docs = await coll.find({}).toArray();
                let content = '';
                let fileName = '';
                if (format === 'json') {
                    content = JSON.stringify(docs, null, 2);
                    fileName = `${name}.json`;
                } else {
                    try {
                        // Best-effort CSV: Papa will stringify primitives; nested objects become [object Object]
                        content = Papa.unparse(docs as any);
                    } catch {
                        // Fallback: JSON lines if CSV fails
                        content = docs.map(d => JSON.stringify(d)).join(os.EOL);
                    }
                    fileName = `${name}.csv`;
                }
                zip.addFile(fileName, Buffer.from(content, 'utf8'));
            }

            // Ask user where to save
            const when = new Date();
            const stamp = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}_${String(when.getHours()).padStart(2, '0')}${String(when.getMinutes()).padStart(2, '0')}`;
            const defaultPath = path.join(app.getPath('documents') || app.getPath('downloads'), `collections_export_${stamp}.zip`);
            const { canceled, filePath } = await dialog.showSaveDialog({
                title: 'Save Collections Export',
                defaultPath,
                filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
            });
            if (canceled || !filePath) return { ok: false, error: 'Export canceled' };

            // Write zip
            const tmpPath = path.join(app.getPath('temp'), `export_${Date.now()}.zip`);
            zip.writeZip(tmpPath);
            await fs.promises.copyFile(tmpPath, filePath);
            try { await fs.promises.unlink(tmpPath); } catch { }
            return { ok: true, data: { savedTo: filePath } };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('company:get', async () => {
        try {
            await initMongo();
            const company = await Company.findOne();

            if (company) {
                const middleware = new MongooseEncryptionMiddleware();
                await middleware.decryptFields(company, Company.schema);
            }

            return { ok: true, data: toPlain(company) || null };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('company:update', async (_e, args: { id: string; updates: any }) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);
            const { id, updates } = args || {} as any;
            const updated = await Company.findOneAndUpdate({ _id: new mongoose.Types.ObjectId(id) }, updates, { new: true });
            if (!updated) return { ok: false, error: 'Company not found' };

            const middleware = new MongooseEncryptionMiddleware();
            await middleware.decryptFields(updated, Company.schema);

            return { ok: true, data: toPlain(updated) };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('company:create', async (_e, payload: any) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);
            const doc = new Company(payload);
            await doc.save();

            const middleware = new MongooseEncryptionMiddleware();
            await middleware.decryptFields(doc, Company.schema);

            return { ok: true, data: toPlain(doc) };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    });

    // Helper function to decrypt Party data in aggregation results
    async function decryptPartyInAggregationResult(result: any): Promise<void> {
        if (!result || !result.party) return;

        const middleware = new MongooseEncryptionMiddleware();
        await middleware.decryptFields(result.party, Party.schema);
    }

    // Helper function to decrypt Party data in array of aggregation results
    async function decryptPartiesInAggregationResults(results: any[]): Promise<void> {
        if (!Array.isArray(results)) return;

        for (const result of results) {
            await decryptPartyInAggregationResult(result);
        }
    }

    // Parties CRUD
    ipcMain.handle('parties:getAll', async () => {
        try {
            await initMongo();
            const data = await Party.find();

            // Manual decryption to ensure it works
            const middleware = new MongooseEncryptionMiddleware();
            for (const doc of data) {
                await middleware.decryptFields(doc, Party.schema);
            }

            return { ok: true, data: toPlain(data) };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });
    ipcMain.handle('parties:getById', async (_e, id: string) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);
            const data = await Party.findById(id);

            if (data) {
                const middleware = new MongooseEncryptionMiddleware();
                await middleware.decryptFields(data, Party.schema);
            }

            return { ok: true, data: toPlain(data) };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });
    ipcMain.handle('parties:getByName', async (_e, name: string) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);
            const data = await Party.findOne({ name });

            if (data) {
                const middleware = new MongooseEncryptionMiddleware();
                await middleware.decryptFields(data, Party.schema);
            }

            return { ok: true, data: toPlain(data) };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });
    ipcMain.handle('parties:create', async (_e, payload: any) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);
            const data = await createDoc(Party, payload);

            if (data) {
                const middleware = new MongooseEncryptionMiddleware();
                await middleware.decryptFields(data, Party.schema);
            }

            return { ok: true, data: toPlain(data) };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });
    ipcMain.handle('parties:update', async (_e, args: { id: string, updates: any }) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);
            const data = await updateByID(Party, args.id, args.updates);

            if (data) {
                const middleware = new MongooseEncryptionMiddleware();
                await middleware.decryptFields(data, Party.schema);
            }

            return { ok: true, data: toPlain(data) };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });
    ipcMain.handle('parties:delete', async (_e, id: string) => {
        try { await initMongo(); validateEventFrame(_e.senderFrame); const data = await deleteByID(Party, id); return { ok: true, data: toPlain(data) }; } catch (e: any) { return { ok: false, error: e.message }; }
    });

    // Items CRUD
    ipcMain.handle('items:getAll', async () => {
        try { await initMongo(); const data = await Item.find(); return { ok: true, data: toPlain(data) }; } catch (e: any) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('items:getById', async (_e, id: string) => {
        try { await initMongo(); validateEventFrame(_e.senderFrame); const data = await Item.findById(id); return { ok: true, data: toPlain(data) }; } catch (e: any) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('items:getByName', async (_e, name: string) => {
        try { await initMongo(); validateEventFrame(_e.senderFrame); const data = await Item.findOne({ name }); return { ok: true, data: toPlain(data) }; } catch (e: any) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('items:create', async (_e, payload: any) => {
        try { await initMongo(); validateEventFrame(_e.senderFrame); const data = await createDoc(Item, payload); return { ok: true, data: toPlain(data) }; } catch (e: any) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('items:update', async (_e, args: { id: string, updates: any }) => {
        try { await initMongo(); validateEventFrame(_e.senderFrame); const data = await updateByID(Item, args.id, args.updates); return { ok: true, data: toPlain(data) }; } catch (e: any) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('items:delete', async (_e, id: string) => {
        try { await initMongo(); validateEventFrame(_e.senderFrame); const data = await deleteByID(Item, id); return { ok: true, data: toPlain(data) }; } catch (e: any) { return { ok: false, error: e.message }; }
    });

    // Units CRUD
    ipcMain.handle('units:getAll', async () => {
        try { await initMongo(); const data = await Unit.find(); return { ok: true, data: toPlain(data) }; } catch (e: any) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('units:getById', async (_e, id: string) => {
        try { await initMongo(); validateEventFrame(_e.senderFrame); const data = await Unit.findById(id); return { ok: true, data: toPlain(data) }; } catch (e: any) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('units:getByName', async (_e, name: string) => {
        try { await initMongo(); validateEventFrame(_e.senderFrame); const data = await Unit.findOne({ name }); return { ok: true, data: toPlain(data) }; } catch (e: any) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('units:create', async (_e, payload: any) => {
        try { await initMongo(); validateEventFrame(_e.senderFrame); const data = await createDoc(Unit, payload); return { ok: true, data: toPlain(data) }; } catch (e: any) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('units:update', async (_e, args: { id: string, updates: any }) => {
        try { await initMongo(); validateEventFrame(_e.senderFrame); const data = await updateByID(Unit, args.id, args.updates); return { ok: true, data: toPlain(data) }; } catch (e: any) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('units:delete', async (_e, id: string) => {
        try { await initMongo(); validateEventFrame(_e.senderFrame); const data = await deleteByID(Unit, id); return { ok: true, data: toPlain(data) }; } catch (e: any) { return { ok: false, error: e.message }; }
    });

    // Warehouses
    ipcMain.handle('warehouse:getAll', async () => {
        try { await initMongo(); const data = await getALL(Warehouse); return { ok: true, data: toPlain(data) }; } catch (e: any) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('warehouse:create', async (_e, payload: any) => {
        try { await initMongo(); validateEventFrame(_e.senderFrame); const data = await createDoc(Warehouse, payload); return { ok: true, data: toPlain(data) }; } catch (e: any) { return { ok: false, error: e.message }; }
    });

    // Transactions
    ipcMain.handle('transactions:create', async (_e, body: any) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);
            const { date, time, lotNumber, quantity } = body;
            const actualQuantity = quantity - (body.shortage || 0) + (body.extra || 0);
            if (actualQuantity <= 0) return { ok: false, error: 'Actual quantity must be greater than zero.' };
            const warehouses = body.warehouses ? body.warehouses.map((id: string) => new mongoose.Types.ObjectId(id)) : [];
            const tx = await Transaction.create({
                ...body,
                quantity: actualQuantity,
                enteredAt: new Date(`${date}T${time}:00Z`),
                party: new mongoose.Types.ObjectId(body.partyId),
                item: new mongoose.Types.ObjectId(body.itemId),
                unit: new mongoose.Types.ObjectId(body.unitId),
                warehouses,
            });
            await recalculateStock(lotNumber);

            const response = await Transaction.populate(tx, [
                { path: 'party', select: 'name _id' },
                { path: 'item', select: 'name category _id' },
                { path: 'unit', select: 'name _id' },
                { path: 'warehouses', select: 'name _id' },
            ]);

            return { ok: true, data: toPlain(response) };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('transactions:update', async (_e, args: { id: string, body: any }) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);
            const { id, body } = args;
            const { date, time, lotNumber } = body;
            const oldTx = await Transaction.findById(id);
            if (!oldTx) return { ok: false, error: 'Transaction not found' };
            const oldLotNumber = (oldTx as any).lotNumber;
            const oldQuantity = (oldTx as any).quantity + ((oldTx as any).shortage || 0) - ((oldTx as any).extra || 0);
            const baseQuantity = body.quantity !== undefined ? Number(body.quantity) : oldQuantity;
            const newQuantity = baseQuantity - (body.shortage || 0) + (body.extra || 0);
            if (newQuantity <= 0) return { ok: false, error: 'Actual quantity must be greater than zero.' };
            const newData = {
                ...body,
                quantity: newQuantity,
                enteredAt: date && time ? new Date(`${date}T${time}:00Z`) : (oldTx as any).enteredAt,
                party: body.partyId ? new mongoose.Types.ObjectId(body.partyId) : (oldTx as any).party,
                item: body.itemId ? new mongoose.Types.ObjectId(body.itemId) : (oldTx as any).item,
                unit: body.unitId ? new mongoose.Types.ObjectId(body.unitId) : (oldTx as any).unit,
                warehouses: body.warehouses ? body.warehouses.map((id: string) => new mongoose.Types.ObjectId(id)) : (oldTx as any).warehouses,
            };
            const updatedTx = await Transaction.findByIdAndUpdate(id, newData, { new: true });
            await recalculateStock(lotNumber);

            if (oldLotNumber !== lotNumber) {
                await recalculateStock(oldLotNumber);

            }
            const response = await Transaction.populate(updatedTx, [
                { path: 'party', select: 'name _id' },
                { path: 'item', select: 'name category _id' },
                { path: 'unit', select: 'name _id' },
                { path: 'warehouses', select: 'name _id' },
            ]);
            return { ok: true, data: toPlain(response) };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('transactions:delete', async (_e, id: string) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);
            const tx = await Transaction.findById(id);
            if (!tx) return { ok: false, error: 'Transaction not found' };
            const lotNumber = (tx as any).lotNumber;
            const deleted = await deleteByID(Transaction, id);
            await recalculateStock(lotNumber);

            return { ok: true, data: toPlain(deleted) };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('transactions:getAll', async (_e, params: any) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);
            const pipeline = [
                { $lookup: { from: 'parties', localField: 'party', foreignField: '_id', as: 'party' } },
                { $unwind: '$party' },
                { $lookup: { from: 'items', localField: 'item', foreignField: '_id', as: 'item' } },
                { $unwind: '$item' },
                { $lookup: { from: 'units', localField: 'unit', foreignField: '_id', as: 'unit' } },
                { $unwind: '$unit' },
                { $lookup: { from: 'warehouses', localField: 'warehouses', foreignField: '_id', as: 'warehouses' } },
                { $project: { _id: 1, type: 1, date: 1, time: 1, party: { name: 1, _id: 1 }, item: { name: 1, category: 1, _id: 1 }, batchId: 1, lotNumber: 1, vehicleNumber: 1, doNumber: 1, quantity: 1, shortage: 1, extra: 1, charge: 1, unit: { name: 1, _id: 1 }, warehouses: { $map: { input: '$warehouses', as: 'w', in: { name: '$$w.name', _id: '$$w._id' } } }, remark: 1, enteredAt: 1 } }
            ];
            const { results: transactions, page, limit, total } = await handleFilteredQuery(params || {}, { model: Transaction, pipeline, dateFields: ['enteredAt', 'createdAt', 'updatedAt'] });

            // Decrypt Party data in aggregation results
            await decryptPartiesInAggregationResults(transactions);

            return { ok: true, data: { transactions: toPlain(transactions), page, limit, total } };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('transactions:getById', async (_e, id: string) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);
            const data = await Transaction.findById(id);
            return { ok: true, data: toPlain(data) };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('transactions:lotNumbers', async (_e, search?: string) => {
        try { await initMongo(); validateEventFrame(_e.senderFrame); if (!search) { const lotNumbers = await Transaction.distinct('lotNumber'); return { ok: true, data: lotNumbers }; } const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const regex = new RegExp(escaped, 'i'); const lotNumbers = await Transaction.distinct('lotNumber', { lotNumber: regex }); return { ok: true, data: lotNumbers }; } catch (e: any) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('transactions:doNumbers', async (_e, search?: string) => {
        try { await initMongo(); validateEventFrame(_e.senderFrame); if (!search) { const arr = await Transaction.distinct('doNumber'); return { ok: true, data: arr.filter((n: any) => n && n.trim() !== '') }; } const regex = new RegExp((search || '').trim(), 'i'); const arr = await Transaction.distinct('doNumber', { doNumber: regex }); return { ok: true, data: arr.filter((n: any) => n && n.trim() !== '') }; } catch (e: any) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('transactions:gatepass', async (_e, batchId: string) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);
            if (!batchId) return { ok: false, error: 'Batch ID is required' };
            const transactions = await Transaction.find({ batchId })
                .populate('party', 'name')
                .populate('item', 'name')
                .populate('unit', 'name')
                .populate('warehouses', 'name')
                .sort({ enteredAt: 1, createdAt: 1 }).lean();
            if (transactions.length === 0) return { ok: false, error: 'No transactions found for this Batch ID' };

            // Manually decrypt Party data since .lean() bypasses middleware
            const middleware = new MongooseEncryptionMiddleware();
            for (const transaction of transactions) {
                if (transaction.party) {
                    await middleware.decryptFields(transaction.party, Party.schema);
                }
            }

            const first = transactions[0];
            const uniqueVehicleNumbers = [...new Set(transactions.map((t: any) => t.vehicleNumber))];
            const stocks = await Stock.find({ lotNumber: { $in: transactions.map((t: any) => t.lotNumber) } }).lean();
            const gatepassData = {
                batchId: first.batchId,
                doNumber: first.doNumber,
                date: first.enteredAt,
                party: first.party,
                vehicleNumber: uniqueVehicleNumbers.join(', '),
                items: transactions.map((t: any) => ({
                    lotNumber: t.lotNumber,
                    itemName: (t.item as any)?.name,
                    quantity: t.quantity,
                    balance: stocks.find((s: any) => s.lotNumber === t.lotNumber)?.quantity || 0,
                    unitName: (t.unit as any)?.name,
                    warehouses: (t.warehouses as any[]).map((w: any) => w.name).join(', '),
                }))
            };
            return { ok: true, data: toPlain(gatepassData) };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('transactions:createMany', async (_e, bodies: any[]) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);
            if (!Array.isArray(bodies) || bodies.length === 0) {
                return { ok: false, error: 'At least one transaction is required.' };
            }

            const results: any[] = [];
            const affectedLotNumbers = new Set<string>();

            for (const body of bodies) {
                const { date, time, lotNumber, quantity } = body;
                const actualQuantity = quantity - (body.shortage || 0) + (body.extra || 0);
                if (actualQuantity <= 0) {
                    return { ok: false, error: `Actual quantity for lot ${lotNumber} must be greater than zero.` };
                }
                const warehouses = body.warehouses ? body.warehouses.map((id: string) => new mongoose.Types.ObjectId(id)) : [];
                const tx = await Transaction.create({
                    ...body,
                    quantity: actualQuantity,
                    enteredAt: new Date(`${date}T${time}:00Z`),
                    party: new mongoose.Types.ObjectId(body.partyId),
                    item: new mongoose.Types.ObjectId(body.itemId),
                    unit: new mongoose.Types.ObjectId(body.unitId),
                    warehouses,
                });

                results.push(tx);
                affectedLotNumbers.add(lotNumber);
            }

            // Recalculate stock for all affected lot numbers
            for (const lotNumber of affectedLotNumbers) {
                await recalculateStock(lotNumber);
            }
            const populatedResults = await Transaction.populate(results, [
                { path: 'party', select: 'name _id' },
                { path: 'item', select: 'name category _id' },
                { path: 'unit', select: 'name _id' },
                { path: 'warehouses', select: 'name _id' },
            ]);

            return { ok: true, data: toPlain(populatedResults) };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });

    // Stocks
    ipcMain.handle('stocks:getAll', async (_e, params: any) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);
            const pipeline = [
                { $lookup: { from: 'parties', localField: 'party', foreignField: '_id', as: 'party' } },
                { $unwind: '$party' },
                { $lookup: { from: 'items', localField: 'item', foreignField: '_id', as: 'item' } },
                { $unwind: '$item' },
                { $lookup: { from: 'units', localField: 'unit', foreignField: '_id', as: 'unit' } },
                { $unwind: '$unit' },
                { $lookup: { from: 'warehouses', localField: 'warehouses', foreignField: '_id', as: 'warehouses' } },
                { $project: { _id: 1, party: { name: 1, _id: 1 }, item: { name: 1, category: 1, _id: 1 }, isNil: 1, chargeable: 1, earliestEntryAt: 1, latestEntryAt: 1, lotNumber: 1, quantity: 1, unit: { name: 1, rate: 1, _id: 1 }, warehouses: { $map: { input: '$warehouses', as: 'w', in: { name: '$$w.name', _id: '$$w._id' } } }, transactions: 1, createdAt: 1, updatedAt: 1, inwardDates: 1 } }
            ];
            const { results: stocks, page, limit, total } = await handleFilteredQuery(params || {}, { model: Stock, pipeline, dateFields: ['earliestEntryAt', 'latestEntryAt', 'createdAt', 'updatedAt'] });

            // Decrypt Party data in aggregation results
            await decryptPartiesInAggregationResults(stocks);

            return { ok: true, data: { stocks: toPlain(stocks), page, limit, total } };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('stocks:migrateLotNumbers', async (_e) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            // Get all stocks populated with items and party
            const stocks = await Stock.find().populate('item').populate('party');
            let updatedCount = 0;

            for (const stock of stocks) {
                if (!stock.lotNumber || !stock.item || !stock.party) continue;

                const parts = stock.lotNumber.split('|');
                if (parts.length >= 3) {
                    // Reconstruct lotNumber using the new format
                    // generateAbbreviation logic for the full name format:
                    const itemFullNameAbbrev = stock.item.name.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '-').toUpperCase();

                    // partyAbbr | year | newItemAbbr | suffix
                    const partyAbbr = parts[0];
                    const finYear = parts[1];
                    const suffix = parts.slice(3).join('|');

                    const newLotNumber = `${partyAbbr}|${finYear}|${itemFullNameAbbrev}${suffix ? '|' + suffix : ''}`;

                    if (stock.lotNumber !== newLotNumber) {
                        const oldLotNumber = stock.lotNumber;

                        // Update transactions linked to this old lotNumber
                        await Transaction.updateMany(
                            { lotNumber: oldLotNumber },
                            { $set: { lotNumber: newLotNumber } }
                        );

                        // Update stock itself
                        stock.lotNumber = newLotNumber;
                        await stock.save();
                        updatedCount++;
                    }
                }
            }

            return { ok: true, message: `Successfully migrated ${updatedCount} lot numbers!` };
        } catch (e: any) {
            console.error("Migration Error:", e);
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('stocks:getById', async (_e, id: string) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);
            const pipeline = [
                { $match: { _id: new mongoose.Types.ObjectId(id) } },
                { $lookup: { from: 'parties', localField: 'party', foreignField: '_id', as: 'party' } },
                { $unwind: '$party' },
                { $lookup: { from: 'items', localField: 'item', foreignField: '_id', as: 'item' } },
                { $unwind: '$item' },
                { $lookup: { from: 'units', localField: 'unit', foreignField: '_id', as: 'unit' } },
                { $unwind: '$unit' },
                { $lookup: { from: 'warehouses', localField: 'warehouses', foreignField: '_id', as: 'warehouses' } },
                { $lookup: { from: 'transactions', localField: 'lotNumber', foreignField: 'lotNumber', as: 'transactions' } },
                { $addFields: { transactions: { $sortArray: { input: '$transactions', sortBy: { enteredAt: 1 } } } } },
                { $project: { _id: 1, party: { name: 1, _id: 1 }, item: { name: 1, category: 1, _id: 1 }, chargeable: 1, isNil: 1, earliestEntryAt: 1, latestEntryAt: 1, lotNumber: 1, quantity: 1, unit: { name: 1, rate: 1, _id: 1 }, warehouses: { $map: { input: '$warehouses', as: 'w', in: { name: '$$w.name', _id: '$$w._id' } } }, transactions: { enteredAt: 1, type: 1, quantity: 1, shortage: 1, extra: 1, remark: 1, doNumber: 1, vehicleNumber: 1 }, createdAt: 1, updatedAt: 1, inwardDates: 1 } }
            ];
            const stock = await Stock.aggregate(pipeline);
            if (stock.length === 0) return { ok: false, error: 'Stock not found' };

            // Decrypt Party data in aggregation result
            await decryptPartyInAggregationResult(stock[0]);

            // add balance column
            const transactions: any[] = stock[0].transactions as any[];
            let balance = 0;
            for (let i = 0; i < transactions.length; i++) {
                if (transactions[i].type === 'INWARD' || transactions[i].type === 'RETURN') balance += transactions[i].quantity; else balance -= transactions[i].quantity;
                (transactions[i] as any).balance = balance;
            }
            return { ok: true, data: toPlain(stock[0]) };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });

    // Charges
    ipcMain.handle('charges:getAll', async (_e, params: any) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);
            const pipeline = [
                { $lookup: { from: 'parties', localField: 'party', foreignField: '_id', as: 'party' } },
                { $unwind: '$party' },
                { $lookup: { from: 'items', localField: 'item', foreignField: '_id', as: 'item' } },
                { $unwind: '$item' },
                { $lookup: { from: 'units', localField: 'unit', foreignField: '_id', as: 'unit' } },
                { $unwind: '$unit' },
                { $lookup: { from: 'warehouses', localField: 'warehouses', foreignField: '_id', as: 'warehouses' } },
                { $lookup: { from: 'transactions', localField: 'transactions', foreignField: '_id', as: 'transactions' } },
                { $project: { _id: 1, lotNumber: 1, quantity: 1, earliestEntryAt: 1, inwardDates: 1, latestEntryAt: 1, chargeable: 1, isNil: 1, party: { name: 1, _id: 1 }, item: { name: 1, category: 1, _id: 1 }, unit: { name: 1, rate: 1, _id: 1 }, warehouses: { $map: { input: '$warehouses', as: 'w', in: { name: '$$w.name', _id: '$$w._id' } } }, transactions: { $map: { input: '$transactions', as: 't', in: { _id: '$$t._id', type: '$$t.type', enteredAt: '$$t.enteredAt', quantity: '$$t.quantity' } } }, createdAt: 1, updatedAt: 1 } }
            ];
            // Ensure data consistency by refreshing stale charges before querying
            // Find all chargeable stocks that haven't been calculated in the last 24 hours
            const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

            const refreshFilterQuery = await buildFilterQuery(
                { ...params, page: undefined, limit: undefined },
                Stock,
                ['earliestEntryAt', 'latestEntryAt', 'createdAt', 'updatedAt']
            );

            const staleStocks = await Stock.find({
                ...refreshFilterQuery,
                chargeable: true,
                $or: [
                    { lastCalculatedAt: { $lt: staleThreshold } },
                    { lastCalculatedAt: { $exists: false } }
                ]
            }).select('lotNumber').lean();

            if (staleStocks.length > 0) {

                // Process in chunks
                const chunk = (arr: any[], size: number) =>
                    Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
                        arr.slice(i * size, i * size + size)
                    );

                const batches = chunk(staleStocks, 50);
                for (const batch of batches) {
                    await Promise.all(batch.map((s: any) => ChargeService.calculateAndStore(s.lotNumber)));
                }

            }

            const { results, page, limit, total } = await handleFilteredQuery(params || {}, { model: Stock, pipeline, dateFields: ['earliestEntryAt', 'latestEntryAt', 'createdAt', 'updatedAt'] });

            // Decrypt Party data in aggregation results
            await decryptPartiesInAggregationResults(results);

            const finalResults: any[] = [];
            for (const stock of results) {
                if (stock.chargeable === false) {
                    finalResults.push({ ...stock, totalCharge: 0, charge: 0 });
                } else {
                    try {
                        // Try to get from ChargeService with fallback
                        const chargeData = await ChargeService.getChargeWithFallback(stock.lotNumber);
                        // Merge populated stock data with charge data
                        const compatibleData = {
                            ...stock, // Keep populated party, item, unit data from stock
                            ...chargeData, // Override with charge calculation data
                            charge: chargeData.totalCharge || chargeData.charge || 0,
                            totalCharge: chargeData.totalCharge || chargeData.charge || 0,
                            // Ensure we keep the populated references from stock
                            party: stock.party,
                            item: stock.item,
                            unit: stock.unit,
                            warehouses: stock.warehouses
                        };
                        finalResults.push(compatibleData);
                    } catch (error) {
                        // Final fallback to dynamic calculation
                        const fallbackData = await computeChargesForLot(stock, true);
                        const compatibleFallback = {
                            ...stock, // Keep populated data from stock
                            ...fallbackData, // Override with charge calculation data
                            charge: fallbackData.totalCharge || fallbackData.charge || 0,
                            totalCharge: fallbackData.totalCharge || fallbackData.charge || 0,
                            // Ensure we keep the populated references from stock
                            party: stock.party,
                            item: stock.item,
                            unit: stock.unit,
                            warehouses: stock.warehouses
                        };
                        finalResults.push(compatibleFallback);
                    }
                }
            }
            // Calculate aggregation data for all matching records using MongoDB aggregation
            const filterQuery = await buildFilterQuery(
                { ...params, page: undefined, limit: undefined },
                Stock,
                ['earliestEntryAt', 'latestEntryAt', 'createdAt', 'updatedAt']
            );

            const aggregationPipeline = [
                {
                    $match: {
                        ...filterQuery,
                        chargeable: true // Only count chargeable items
                    }
                },
                {
                    $group: {
                        _id: null,
                        grandTotal: { $sum: '$totalCharge' },
                        chargeableCount: { $sum: 1 },
                        totalRecords: { $sum: 1 }
                    }
                }
            ];

            const aggregationResult = await Stock.aggregate(aggregationPipeline);
            const aggregationData = aggregationResult.length > 0 ? aggregationResult[0] : { grandTotal: 0, chargeableCount: 0, totalRecords: 0 };

            return {
                ok: true,
                data: {
                    results: toPlain(finalResults),
                    page,
                    limit,
                    total,
                    aggregation: {
                        grandTotal: aggregationData.grandTotal || 0,
                        chargeableCount: aggregationData.chargeableCount || 0,
                        totalRecords: total // Use total from filtered query count
                    }
                }
            };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('charges:getById', async (_e, stockId: string) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);


            // Try to find stock by ID first
            let matchCondition;
            try {
                matchCondition = { _id: new mongoose.Types.ObjectId(stockId) };
            } catch (error) {
                // If not a valid ObjectId, treat as lot number
                matchCondition = { lotNumber: stockId };
            }

            const pipeline = [
                { $match: matchCondition },
                { $lookup: { from: 'parties', localField: 'party', foreignField: '_id', as: 'party' } },
                { $unwind: '$party' },
                { $lookup: { from: 'items', localField: 'item', foreignField: '_id', as: 'item' } },
                { $unwind: '$item' },
                { $lookup: { from: 'units', localField: 'unit', foreignField: '_id', as: 'unit' } },
                { $unwind: '$unit' },
                { $lookup: { from: 'warehouses', localField: 'warehouses', foreignField: '_id', as: 'warehouses' } },
                { $lookup: { from: 'transactions', localField: 'transactions', foreignField: '_id', as: 'transactions' } },
                { $project: { _id: 1, lotNumber: 1, quantity: 1, earliestEntryAt: 1, inwardDates: 1, latestEntryAt: 1, chargeable: 1, isNil: 1, party: { name: 1, _id: 1 }, item: { name: 1, category: 1, _id: 1 }, unit: { name: 1, rate: 1, _id: 1 }, warehouses: { $map: { input: '$warehouses', as: 'w', in: { name: '$$w.name', _id: '$$w._id' } } }, transactions: { $map: { input: '$transactions', as: 't', in: { _id: '$$t._id', type: '$$t.type', enteredAt: '$$t.enteredAt', quantity: '$$t.quantity' } } }, createdAt: 1, updatedAt: 1 } }
            ];
            const { results } = await handleFilteredQuery({}, { model: Stock, pipeline, dateFields: ['earliestEntryAt', 'latestEntryAt', 'createdAt', 'updatedAt'] });
            if (!results || results.length === 0) return { ok: false, error: 'Stock not found' };

            const stock = results[0];

            // Decrypt Party data in aggregation result
            await decryptPartyInAggregationResult(stock);


            // If not chargeable, return with zero charge
            if (stock.chargeable === false) {
                return { ok: true, data: toPlain({ ...stock, totalCharge: 0, charge: 0 }) };
            }

            // Try to get stored charge data from stock record first
            try {
                // Check if stock record has charge data
                if (stock.chargeCalculated && stock.totalCharge !== undefined) {
                    // For getById, we need breakdown data, so let's generate it using dynamic calculation
                    try {
                        const computed = await computeChargesForLot(stock, true);

                        // Merge stock data with computed breakdown
                        const result = {
                            ...stock,
                            totalCharge: stock.totalCharge,
                            charge: stock.totalCharge,
                            breakdown: computed.breakdown || [],
                            anchorDate: stock.anchorDate,
                            anniversaryDay: stock.anniversaryDay,
                            firstMonth: stock.firstMonth,
                            monthlyCharges: stock.monthlyCharges || []
                        };

                        await decryptPartyInAggregationResult(result);
                        return { ok: true, data: toPlain(result) };
                    } catch (breakdownError) {
                        // Fall through to dynamic calculation
                    }
                }

                // No stored charge data found, fall back to dynamic calculation
                const computed = await computeChargesForLot(stock, true);

                const compatibleComputed = {
                    ...stock, // Keep populated data from stock
                    ...computed, // Override with charge calculation data
                    charge: computed.totalCharge || computed.charge || 0,
                    totalCharge: computed.totalCharge || computed.charge || 0,
                    // Ensure we keep the populated references from stock
                    party: stock.party,
                    item: stock.item,
                    unit: stock.unit,
                    warehouses: stock.warehouses
                };

                return { ok: true, data: toPlain(compatibleComputed) };
            } catch (error) {
                return { ok: false, error: `Failed to compute charges for lot ${stock.lotNumber}` };
            }
        } catch (e: any) { return { ok: false, error: e.message }; }
    });

    // Party aggregation endpoints
    ipcMain.handle('charges:getByParty', async (_e, partyId: any) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            // Convert to string if it's an ObjectId or object
            let actualPartyId: string;
            if (typeof partyId === 'object' && partyId !== null) {
                if (partyId.toString && typeof partyId.toString === 'function') {
                    actualPartyId = partyId.toString();
                } else if ((partyId as any)._id) {
                    actualPartyId = (partyId as any)._id.toString();
                } else {
                    return { ok: false, error: 'Invalid partyId format' };
                }
            } else {
                actualPartyId = String(partyId);
            }

            const summary = await ChargeService.aggregateByParty(actualPartyId);
            if (!summary) {
                return { ok: false, error: 'No charges found for party' };
            }

            return { ok: true, data: toPlain(summary) };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('charges:getAllParties', async (_e) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            const summaries = await ChargeService.aggregateAllParties();
            return { ok: true, data: toPlain(summaries) };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });

    // Batch processing endpoints
    ipcMain.handle('charges:batchUpdate', async (_e, args: { lotNumbers: string[]; batchSize?: number }) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            const { lotNumbers, batchSize } = args;
            const result = await ChargeService.batchUpdateCharges(lotNumbers, batchSize);
            return { ok: true, data: toPlain(result) };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('charges:backgroundUpdate', async (_e, args: { lotNumbers: string[]; options?: any }) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            const { lotNumbers, options } = args;
            const result = await ChargeService.backgroundUpdateCharges(lotNumbers, options);
            return { ok: true, data: toPlain(result) };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('charges:getLotsNeedingRecalculation', async (_e, limit?: number) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            const lotNumbers = await ChargeService.getLotsNeedingRecalculation(limit);
            return { ok: true, data: lotNumbers };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });

    // Pagination endpoints
    ipcMain.handle('charges:getByPartyPaginated', async (_e, args: { partyId: string; options?: any }) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            const { partyId, options } = args;
            const result = await ChargeService.getByPartyPaginated(partyId, options);
            return { ok: true, data: toPlain(result) };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('charges:getAllPartiesPaginated', async (_e, options?: any) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            const result = await ChargeService.aggregateAllPartiesPaginated(options);
            return { ok: true, data: toPlain(result) };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });

    // Migration endpoints
    ipcMain.handle('charges:migrateExisting', async (_e) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            const { migrateExistingCharges } = await import('./utils/migration.js');
            const result = await migrateExistingCharges();
            return { ok: true, data: result };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('charges:validateMigration', async (_e, sampleSize?: number) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            const { validateMigratedCharges } = await import('./utils/migration.js');
            const result = await validateMigratedCharges(sampleSize);
            return { ok: true, data: result };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('charges:cleanupOrphaned', async (_e) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            const { cleanupOrphanedCharges } = await import('./utils/migration.js');
            const result = await cleanupOrphanedCharges();
            return { ok: true, data: result };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });

    // Billing integration endpoints
    ipcMain.handle('charges:getUnbilledCharges', async (_e, args: { partyId: string; quarter: string; year: number }) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            const { partyId, quarter, year } = args;

            // Get charges by party
            const charges = await ChargeService.getByParty(partyId);

            // Filter charges by quarter and year (Financial Year)
            // FY starts in April. Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar (next year)
            const quarterMonths = {
                Q1: [4, 5, 6],
                Q2: [7, 8, 9],
                Q3: [10, 11, 12],
                Q4: [1, 2, 3]
            };

            const relevantCharges = charges.filter((charge: any) => {
                const chargeDate = new Date(charge.anchorDate);
                const chargeYear = chargeDate.getFullYear();
                const chargeMonth = chargeDate.getMonth() + 1;

                // For Q1, Q2, Q3: logic is same year
                // For Q4: logic is next year
                const targetYear = quarter === 'Q4' ? year + 1 : year;

                const isInQuarter = chargeYear === targetYear && quarterMonths[quarter as keyof typeof quarterMonths].includes(chargeMonth);
                const isUnbilled = !charge.billingStatus || charge.billingStatus === 'unbilled';

                return isInQuarter && isUnbilled;
            });

            return { ok: true, data: toPlain(relevantCharges) };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('charges:markChargesAsBilled', async (_e, args: { chargeIds: any[]; billId: string; billNumber: string }) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            const { chargeIds, billId, billNumber } = args;

            // Update charges to mark them as billed
            // Convert chargeIds to ObjectIds with validation
            const objectIds = chargeIds.map((id: any) => {
                // Handle different input types: string, ObjectId, or object with _id
                let stringId: string;

                if (typeof id === 'string') {
                    stringId = id;
                } else if (id && typeof id === 'object') {
                    // Handle ObjectId objects or objects with _id property
                    if (id._id) {
                        stringId = String(id._id);
                    } else if (id.toString && typeof id.toString === 'function') {
                        stringId = id.toString();
                    } else {
                        stringId = String(id);
                    }
                } else {
                    stringId = String(id);
                }

                if (!mongoose.Types.ObjectId.isValid(stringId)) {
                    throw new Error(`Invalid charge ID format: ${stringId} (original: ${JSON.stringify(id)})`);
                }
                return new mongoose.Types.ObjectId(stringId);
            });
            const updateResult = await Stock.updateMany(
                {
                    _id: { $in: objectIds },
                    isNil: true,
                    chargeable: true
                },
                {
                    $set: {
                        billingStatus: 'billed',
                        billedAmount: { $ifNull: ['$totalCharge', 0] }
                    },
                    $push: {
                        associatedBills: {
                            billId,
                            billNumber,
                            amount: { $ifNull: ['$totalCharge', 0] },
                            billedAt: new Date().toISOString()
                        }
                    }
                }
            );

            return { ok: true, data: updateResult.modifiedCount > 0 };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('charges:validateChargesForBilling', async (_e, chargeIds: any[]) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            // Check if charges exist and are not already fully billed
            // Convert chargeIds to ObjectIds with validation
            const objectIds = chargeIds.map((id: any) => {
                // Handle different input types: string, ObjectId, or object with _id
                let stringId: string;

                if (typeof id === 'string') {
                    stringId = id;
                } else if (id && typeof id === 'object') {
                    // Handle ObjectId objects or objects with _id property
                    if (id._id) {
                        stringId = String(id._id);
                    } else if (id.toString && typeof id.toString === 'function') {
                        stringId = id.toString();
                    } else {
                        stringId = String(id);
                    }
                } else {
                    stringId = String(id);
                }

                if (!mongoose.Types.ObjectId.isValid(stringId)) {
                    throw new Error(`Invalid charge ID format: ${stringId} (original: ${JSON.stringify(id)})`);
                }
                return new mongoose.Types.ObjectId(stringId);
            });
            const charges = await Stock.find({
                _id: { $in: objectIds },
                isNil: true,
                chargeable: true
            });
            const errors: string[] = [];

            if (charges.length !== chargeIds.length) {
                errors.push('Some charges not found');
            }

            for (const charge of charges) {
                if (charge.billingStatus === 'billed') {
                    errors.push(`Charge for lot ${charge.lotNumber} is already fully billed`);
                }
            }

            return {
                ok: true,
                data: {
                    valid: errors.length === 0,
                    errors: errors.length > 0 ? errors : undefined
                }
            };
        } catch (e: any) { return { ok: false, error: e.message }; }
    });

    // Bills CRUD handlers
    ipcMain.handle('bills:getAll', async (_e, params?: any) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            const {
                page = 1,
                limit = 10,
                partyId,
                status,
                quarter,
                year,
                sort = 'billDate',
                order = 'desc'
            } = params || {};

            // Build query filters
            const query: any = {};

            if (partyId) {
                query.party = new mongoose.Types.ObjectId(partyId);
            }

            if (status) {
                if (Array.isArray(status)) {
                    query.status = { $in: status };
                } else {
                    query.status = status;
                }
            }

            if (quarter) {
                query.quarter = quarter;
            }

            if (year) {
                query.year = year;
            }

            // Build sort object
            const sortObj: any = {};
            sortObj[sort] = order === 'asc' ? 1 : -1;

            // Calculate pagination
            const skip = (page - 1) * limit;

            // Execute query with pagination
            const [bills, total] = await Promise.all([
                Bill.find(query)
                    .sort(sortObj)
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Bill.countDocuments(query)
            ]);



            return {
                ok: true,
                data: {
                    bills: toPlain(bills),
                    pagination: {
                        page,
                        limit,
                        total
                    }
                }
            };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('bills:getById', async (_e, id: string) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            const bill = await Bill.findById(id).populate('party', 'name address').lean();
            if (!bill) {
                return { ok: false, error: 'Bill not found' };
            }

            return { ok: true, data: toPlain(bill) };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('bills:create', async (_e, billData: any) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            // Validate required fields
            if (!billData.billNumber || !billData.party || !billData.quarter || !billData.year || !billData.amount || !billData.billDate) {
                return { ok: false, error: 'Missing required bill fields' };
            }

            // Validate bill amount is positive
            if (billData.amount <= 0) {
                return { ok: false, error: 'Bill amount must be greater than zero' };
            }

            // Validate quarter and year
            if (!['Q1', 'Q2', 'Q3', 'Q4'].includes(billData.quarter)) {
                return { ok: false, error: 'Invalid quarter. Must be Q1, Q2, Q3, or Q4' };
            }

            if (billData.year < 2000 || billData.year > 2100) {
                return { ok: false, error: 'Invalid year' };
            }

            // Check if bill number already exists
            const existingBill = await Bill.findOne({ billNumber: billData.billNumber });
            if (existingBill) {
                return { ok: false, error: 'Bill number already exists' };
            }

            // Create the bill
            const bill = new Bill({
                billNumber: billData.billNumber,
                party: billData.party,
                quarter: billData.quarter,
                year: billData.year,
                amount: billData.amount,
                billDate: new Date(billData.billDate),
                status: billData.status || 'unpaid',
                paidAmount: billData.paidAmount || 0,
                outstandingAmount: billData.outstandingAmount || billData.amount,
                description: billData.description || undefined,
                includedCharges: billData.includedCharges || undefined,
                chargesSnapshot: billData.chargesSnapshot || undefined,
                isSplit: billData.isSplit || false
            });

            await bill.save();

            // Populate party details for immediate use (e.g., PDF generation)
            await bill.populate('party', 'name address');

            return { ok: true, data: toPlain(bill) };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('bills:update', async (_e, args: { id: string; updates: any }) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            const { id, updates } = args;

            // Find the existing bill
            const existingBill = await Bill.findById(id);
            if (!existingBill) {
                return { ok: false, error: 'Bill not found' };
            }

            // Validate updates if provided
            if (updates.amount !== undefined && updates.amount <= 0) {
                return { ok: false, error: 'Bill amount must be greater than zero' };
            }

            if (updates.quarter && !['Q1', 'Q2', 'Q3', 'Q4'].includes(updates.quarter)) {
                return { ok: false, error: 'Invalid quarter. Must be Q1, Q2, Q3, or Q4' };
            }

            if (updates.year && (updates.year < 2000 || updates.year > 2100)) {
                return { ok: false, error: 'Invalid year' };
            }

            // Check if bill number is being changed and if it already exists
            if (updates.billNumber && updates.billNumber !== existingBill.billNumber) {
                const duplicateBill = await Bill.findOne({ billNumber: updates.billNumber });
                if (duplicateBill) {
                    return { ok: false, error: 'Bill number already exists' };
                }
            }

            // Update the bill
            const updatedBill = await Bill.findByIdAndUpdate(
                id,
                {
                    ...updates,
                    billDate: updates.billDate ? new Date(updates.billDate) : existingBill.billDate
                },
                { new: true }
            );

            if (!updatedBill) {
                return { ok: false, error: 'Failed to update bill' };
            }

            return { ok: true, data: toPlain(updatedBill) };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('bills:delete', async (_e, id: string) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            // Check if bill exists
            const bill = await Bill.findById(id);
            if (!bill) {
                return { ok: false, error: 'Bill not found' };
            }

            // Check if there are any payments associated with this bill
            const paymentsCount = await Payment.countDocuments({ bill: id });
            if (paymentsCount > 0) {
                return { ok: false, error: 'Cannot delete bill with existing payments. Delete payments first.' };
            }

            // If the bill has associated charges, unmark them as billed
            const billData = bill as any;
            if (billData.includedCharges && billData.includedCharges.length > 0) {
                const chargeIds = billData.includedCharges.map((charge: any) => charge.chargeId);
                await Stock.updateMany(
                    { _id: { $in: chargeIds } },
                    {
                        $set: {
                            billingStatus: 'unbilled'
                        },
                        $unset: {
                            billedAmount: 1
                        },
                        $pull: {
                            associatedBills: { billId: id }
                        }
                    }
                );
            }

            // Delete the bill
            await Bill.findByIdAndDelete(id);

            return { ok: true, data: { success: true } };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('bills:generatePdf', async (_e, id: string) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            // Find the bill
            const bill = await Bill.findById(id).lean();
            if (!bill) {
                return { ok: false, error: 'Bill not found' };
            }

            // Generate PDF file path
            const billData = bill as any;
            const fileName = `Bill_${billData.billNumber}_${billData.party.name.replace(/\s+/g, '_')}.pdf`;
            const pdfDir = path.join(app.getPath('documents'), 'Warehouse_Bills');

            // Ensure directory exists
            try {
                await fs.promises.mkdir(pdfDir, { recursive: true });
            } catch (error) {
                // Directory might already exist, ignore error
            }

            const pdfPath = path.join(pdfDir, fileName);

            // Store PDF path in bill record
            await Bill.findByIdAndUpdate(id, { pdfPath });

            return { ok: true, data: { pdfPath } };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('bills:getFinancialSummary', async (_e, params?: any) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            const { partyId } = params || {};

            // Build aggregation pipeline to calculate financial summaries
            const matchStage: any = {};
            if (partyId) {
                matchStage._id = new mongoose.Types.ObjectId(partyId);
            }

            // Get all parties
            const parties = await Party.find(matchStage).lean();

            // Decrypt party data
            const middleware = new MongooseEncryptionMiddleware();
            for (const party of parties) {
                await middleware.decryptFields(party, Party.schema);
            }

            const financialSummaries = [];

            for (const party of parties) {
                // Get bills for this party
                const bills = await Bill.find({ party: party._id as any }).lean();

                // Get payments for this party
                const payments = await Payment.find({ party: party._id as any }).lean();

                // Calculate totals
                const totalBilled = bills.reduce((sum, bill) => sum + bill.amount, 0);
                const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
                const outstandingBalance = totalBilled - totalPaid;

                // Get charges for this party (for total charges calculation)
                let totalCharges = 0;
                try {
                    const charges = await ChargeService.getByParty((party._id as any).toString());
                    totalCharges = charges.reduce((sum: number, charge: any) => sum + (charge.totalCharge || 0), 0);
                } catch (error) {
                    console.warn('Could not fetch charges for party:', party._id as any, error);
                }

                // Find latest dates
                const lastBillDate = bills.length > 0
                    ? bills.sort((a, b) => new Date(b.billDate).getTime() - new Date(a.billDate).getTime())[0].billDate
                    : undefined;

                const lastPaymentDate = payments.length > 0
                    ? payments.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0].paymentDate
                    : undefined;

                financialSummaries.push({
                    party: {
                        _id: (party._id as any).toString(),
                        name: party.name as any
                    },
                    totalCharges,
                    totalBilled,
                    totalPaid,
                    outstandingBalance,
                    lastBillDate,
                    lastPaymentDate,
                    billCount: bills.length,
                    paymentCount: payments.length
                });
            }

            return { ok: true, data: financialSummaries };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });

    // Payments CRUD handlers
    ipcMain.handle('payments:getAll', async (_e, params?: any) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            const {
                page = 1,
                limit = 10,
                partyId,
                billId,
                paymentMethod,
                sort = 'paymentDate',
                order = 'desc'
            } = params || {};

            // Build query filters
            const query: any = {};

            if (partyId) {
                query.party = new mongoose.Types.ObjectId(partyId);
            }

            if (billId) {
                query.bill = new mongoose.Types.ObjectId(billId);
            }

            if (paymentMethod) {
                query.paymentMethod = paymentMethod;
            }

            // Build sort object
            const sortObj: any = {};
            sortObj[sort] = order === 'asc' ? 1 : -1;

            // Calculate pagination
            const skip = (page - 1) * limit;

            // Execute query with pagination
            const [payments, total] = await Promise.all([
                Payment.find(query)
                    .sort(sortObj)
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Payment.countDocuments(query)
            ]);



            return {
                ok: true,
                data: {
                    payments: toPlain(payments),
                    pagination: {
                        page,
                        limit,
                        total
                    }
                }
            };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('payments:getById', async (_e, id: string) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            const payment = await Payment.findById(id).lean();
            if (!payment) {
                return { ok: false, error: 'Payment not found' };
            }

            return { ok: true, data: toPlain(payment) };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('payments:create', async (_e, paymentData: any) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            // Validate required fields
            if (!paymentData.paymentNumber || !paymentData.bill || !paymentData.party || !paymentData.amount || !paymentData.paymentMethod || !paymentData.paymentDate) {
                return { ok: false, error: 'Missing required payment fields' };
            }

            // Validate payment amount is positive
            if (paymentData.amount <= 0) {
                return { ok: false, error: 'Payment amount must be greater than zero' };
            }

            // Find the bill to validate payment amount
            const bill = await Bill.findById(paymentData.bill);
            if (!bill) {
                return { ok: false, error: 'Bill not found' };
            }

            // Validate payment amount doesn't exceed outstanding amount
            if (paymentData.amount > bill.outstandingAmount) {
                return { ok: false, error: `Payment amount (₹${paymentData.amount}) exceeds outstanding amount (₹${bill.outstandingAmount})` };
            }

            // Validate payment date is not in future
            const paymentDate = new Date(paymentData.paymentDate);
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            if (paymentDate > today) {
                return { ok: false, error: 'Payment date cannot be in the future' };
            }

            // Create the payment record
            const payment = new Payment({
                paymentNumber: paymentData.paymentNumber,
                bill: bill._id,
                party: paymentData.party,
                amount: paymentData.amount,
                paymentMethod: paymentData.paymentMethod,
                paymentDate: paymentDate,
                bankDetails: paymentData.bankDetails || undefined,
                notes: paymentData.notes || undefined
            });

            await payment.save();

            // Update bill status and amounts
            const newPaidAmount = bill.paidAmount + paymentData.amount;
            const newOutstandingAmount = bill.amount - newPaidAmount;

            let newStatus = 'unpaid';
            if (newOutstandingAmount === 0) {
                newStatus = 'paid';
            } else if (newPaidAmount > 0) {
                newStatus = 'partial';
            }

            await Bill.findByIdAndUpdate(
                bill._id,
                {
                    paidAmount: newPaidAmount,
                    outstandingAmount: newOutstandingAmount,
                    status: newStatus
                },
                { new: true }
            );

            return { ok: true, data: toPlain(payment) };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('payments:update', async (_e, args: { id: string; updates: any }) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            const { id, updates } = args;

            // Find the existing payment
            const existingPayment = await Payment.findById(id);
            if (!existingPayment) {
                return { ok: false, error: 'Payment not found' };
            }

            // Validate updates if provided
            if (updates.amount !== undefined && updates.amount <= 0) {
                return { ok: false, error: 'Payment amount must be greater than zero' };
            }

            // Validate payment date is not in future if being updated
            if (updates.paymentDate) {
                const paymentDate = new Date(updates.paymentDate);
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                if (paymentDate > today) {
                    return { ok: false, error: 'Payment date cannot be in the future' };
                }
            }

            // If amount is being changed, we need to update the related bill
            if (updates.amount !== undefined && updates.amount !== existingPayment.amount) {
                const bill = await Bill.findById(existingPayment.bill);
                if (!bill) {
                    return { ok: false, error: 'Associated bill not found' };
                }

                // Calculate new bill amounts
                const amountDifference = updates.amount - existingPayment.amount;
                const newPaidAmount = bill.paidAmount + amountDifference;
                const newOutstandingAmount = bill.amount - newPaidAmount;

                // Validate that new payment amount doesn't exceed bill amount
                if (newPaidAmount > bill.amount) {
                    return { ok: false, error: 'Updated payment amount would exceed bill amount' };
                }

                // Determine new bill status
                let newStatus = 'unpaid';
                if (newOutstandingAmount === 0) {
                    newStatus = 'paid';
                } else if (newPaidAmount > 0) {
                    newStatus = 'partial';
                }

                // Update the payment
                const updatedPayment = await Payment.findByIdAndUpdate(
                    id,
                    {
                        ...updates,
                        paymentDate: updates.paymentDate ? new Date(updates.paymentDate) : existingPayment.paymentDate
                    },
                    { new: true }
                );

                // Update the bill
                await Bill.findByIdAndUpdate(
                    bill._id,
                    {
                        paidAmount: newPaidAmount,
                        outstandingAmount: newOutstandingAmount,
                        status: newStatus
                    }
                );

                return { ok: true, data: toPlain(updatedPayment) };
            } else {
                // Simple update without amount change
                const updatedPayment = await Payment.findByIdAndUpdate(
                    id,
                    {
                        ...updates,
                        paymentDate: updates.paymentDate ? new Date(updates.paymentDate) : existingPayment.paymentDate
                    },
                    { new: true }
                );

                if (!updatedPayment) {
                    return { ok: false, error: 'Failed to update payment' };
                }

                return { ok: true, data: toPlain(updatedPayment) };
            }
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('payments:delete', async (_e, id: string) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            // Find the payment
            const payment = await Payment.findById(id);
            if (!payment) {
                return { ok: false, error: 'Payment not found' };
            }

            // Find the associated bill
            const bill = await Bill.findById(payment.bill);
            if (!bill) {
                return { ok: false, error: 'Associated bill not found' };
            }

            // Calculate new bill amounts after removing this payment
            const newPaidAmount = bill.paidAmount - payment.amount;
            const newOutstandingAmount = bill.amount - newPaidAmount;

            // Determine new bill status
            let newStatus = 'unpaid';
            if (newOutstandingAmount === 0) {
                newStatus = 'paid';
            } else if (newPaidAmount > 0) {
                newStatus = 'partial';
            }

            // Delete the payment
            await Payment.findByIdAndDelete(id);

            // Update the bill
            await Bill.findByIdAndUpdate(
                bill._id,
                {
                    paidAmount: newPaidAmount,
                    outstandingAmount: newOutstandingAmount,
                    status: newStatus
                }
            );

            return { ok: true, data: { success: true } };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('payments:getBillingHistory', async (_e, args: { partyId: string; params?: any }) => {
        try {
            await initMongo();
            validateEventFrame(_e.senderFrame);

            const { partyId, params } = args;
            const { startDate, endDate } = params || {};

            // Build date filter
            const dateFilter: any = {};
            if (startDate) {
                dateFilter.$gte = new Date(startDate);
            }
            if (endDate) {
                const endDateTime = new Date(endDate);
                endDateTime.setHours(23, 59, 59, 999); // End of day
                dateFilter.$lte = endDateTime;
            }

            // Get bills for the party (simple query now)
            const billQuery: any = { party: new mongoose.Types.ObjectId(partyId) };
            if (Object.keys(dateFilter).length > 0) {
                billQuery.billDate = dateFilter;
            }

            const bills = await Bill.find(billQuery)
                .populate('party', 'name')
                .sort({ billDate: -1 })
                .lean();

            // Get payments for the party (simple query now)
            const paymentQuery: any = { party: new mongoose.Types.ObjectId(partyId) };
            if (Object.keys(dateFilter).length > 0) {
                paymentQuery.paymentDate = dateFilter;
            }

            const payments = await Payment.find(paymentQuery)
                .populate('party', 'name')
                .populate('bill', 'billNumber')
                .sort({ paymentDate: -1 })
                .lean();





            // Combine and format the history items
            const historyItems: any[] = [];

            // Add bills to history
            bills.forEach((bill: any) => {
                historyItems.push({
                    _id: bill._id.toString(),
                    type: 'bill',
                    date: bill.billDate,
                    amount: bill.amount,
                    description: `Bill for ${bill.quarter} ${bill.year}-${(bill.year + 1).toString().slice(-2)}`,
                    billNumber: bill.billNumber,
                    runningBalance: 0 // Will be calculated below
                });
            });

            // Add payments to history
            payments.forEach((payment: any) => {
                historyItems.push({
                    _id: payment._id.toString(),
                    type: 'payment',
                    date: payment.paymentDate,
                    amount: payment.amount,
                    description: `Payment for Bill ${payment.bill?.billNumber.split('|')[1] + ' - ' + payment.bill?.billNumber.split('|')[2]}`,
                    paymentNumber: payment.paymentNumber,
                    paymentMethod: payment.paymentMethod,
                    runningBalance: 0 // Will be calculated below
                });
            });

            // Sort by date (oldest first for running balance calculation)
            historyItems.sort((a, b) => {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                if (dateA !== dateB) return dateA - dateB;

                // If dates are equal, bills come before payments (bill generated, then paid)
                if (a.type !== b.type) return a.type === 'bill' ? -1 : 1;

                // Fallback to ID for stability
                return a._id.localeCompare(b._id);
            });

            // Calculate running balance
            let runningBalance = 0;
            historyItems.forEach(item => {
                if (item.type === 'bill') {
                    runningBalance += item.amount;
                } else {
                    runningBalance -= item.amount;
                }
                item.runningBalance = runningBalance;
            });

            // Sort by date (newest first for display)
            historyItems.sort((a, b) => {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                if (dateA !== dateB) return dateB - dateA; // Descending

                // If dates are equal, payments come before bills (Display: Payment on top of Bill)
                if (a.type !== b.type) return a.type === 'payment' ? -1 : 1;

                return b._id.localeCompare(a._id);
            });

            return { ok: true, data: historyItems };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    });
}

app.on("ready", async () => {
    // Don't fail hard on missing URI; allow UI to prompt user to set it.
    try { await initMongo(); } catch (e) { /* ignore at startup */ }
    registerIpcHandlers();

    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,

        icon: path.join(getAssetsPath() + '/icon@5x.png'),
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
        webPreferences: {
            preload: getPreloadPath(),
            // Disable DevTools in production
            devTools: isDev(),
        }
    });
    // mainWindow.maximize();
    // Remove and hide the menu bar across platforms
    if (!isDev()) {
        try {
            Menu.setApplicationMenu(null);
        } catch { }
        mainWindow.setMenuBarVisibility(false);
        try { mainWindow.setMenu(null); } catch { }
    }

    if (isDev()) {
        mainWindow.loadURL("http://localhost:5123")
    } else {
        mainWindow.loadFile(getUIPath());
    }
    // Window control IPC handlers
    ipcMain.handle('window:minimize', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) win.minimize();
        return { ok: true };
    });
    ipcMain.handle('window:toggleMaximize', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (!win) return { ok: false };
        if (win.isMaximized()) {
            win.unmaximize();
            return { ok: true, maximized: false };
        } else {
            win.maximize();
            return { ok: true, maximized: true };
        }
    });
    ipcMain.handle('window:close', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) win.close();
        return { ok: true };
    });
    ipcMain.handle('pdf:download', async (_e, dataURL: string, sanitizedFileName: string) => {
        const currentWindow = BrowserWindow.getFocusedWindow();
        if (!currentWindow) return { ok: false };
        if (currentWindow && !currentWindow.isDestroyed()) {
            const { filePath } = await dialog.showSaveDialog(currentWindow, {
                defaultPath: sanitizedFileName,
                filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
            });

            if (filePath) {
                let storedPdfBuffer = Buffer.from(dataURL.split(',')[1], 'base64');
                await fs.promises.writeFile(filePath, storedPdfBuffer);
                return { ok: true, filePath };
            }
        }
        return { ok: false };
    })

    ipcMain.handle('window:previewPdf', async (_e, dataURL: string, fileName: string) => {
        try {
            validateEventFrame(_e.senderFrame);
            if (!dataURL || !dataURL.startsWith('data:application/pdf;')) {
                throw new Error('Invalid PDF data');
            }
            const sanitizedFileName = fileName.replace(/[<>:"/\\|?*]/g, '_');

            //chek if a preview window is already open for same file name, if so focus it and return
            //check if no filename, check window with starting PDF Preview and use that one as win
            const allWindows = BrowserWindow.getAllWindows();
            const existingWindow = allWindows.find(w => w.getTitle() === ('PDF Preview - ' + sanitizedFileName));
            if (existingWindow) {
                if (existingWindow.isMinimized()) existingWindow.restore();
                existingWindow.focus();
                return { ok: true };
            }

            const win = new BrowserWindow({
                width: 800,
                height: 600,
                title: 'PDF Preview - ' + sanitizedFileName,
                frame: false,
                alwaysOnTop: true,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    preload: getPdfPreviewPreloadPath(),
                },
            })

            const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-src data:;">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        width: 100vw; 
                        height: 100vh; 
                        overflow: hidden;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                        background: #1e1e1e;
                    }
                    #titlebar {
                        height: 40px;
                        background: #2c3e50;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 0 12px;
                        -webkit-app-region: drag;
                        user-select: none;
                        z-index: 10;
                    }
                    #titlebar-left {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        color: #ecf0f1;
                        font-size: 13px;
                        font-weight: 500;
                    }
                    #titlebar-right {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        -webkit-app-region: no-drag;
                    }
                    .titlebar-button {
                        width: 36px;
                        height: 28px;
                        border: none;
                        background: transparent;
                        color: #ecf0f1;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 4px;
                        transition: background 0.2s;
                        font-size: 16px;
                    }
                    .titlebar-button:hover {
                        background: rgba(255, 255, 255, 0.1);
                    }
                    .titlebar-button.close:hover {
                        background: #e74c3c;
                    }
                    #download-btn {
                        background: #3498db;
                        color: white;
                        padding: 6px 16px;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 500;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        transition: background 0.2s;
                        margin-right: 8px;
                    }
                    #download-btn:hover {
                        background: #2980b9;
                    }
                    #download-btn:active {
                        transform: scale(0.98);
                    }
                    #pdf-container {
                        width: 100%;
                        height: calc(100vh - 40px);
                        border: none;
                    }
                    @media (max-width: 600px) {
                        #titlebar-left {
                            display: none;
                        }
                </style>
            </head>
            <body>
                <div id="titlebar">
                    <div id="titlebar-left">
                        <span>📄</span>
                        <span id="filename">${sanitizedFileName}</span>
                    </div>
                    <div id="titlebar-right">
                        <button class="titlebar-button download" id="download-btn" title="Download PDF">⬇</button>
                        <button class="titlebar-button" id="minimize-btn">─</button>
                        <button class="titlebar-button" id="maximize-btn">☐</button>
                        <button class="titlebar-button close" id="close-btn">✕</button>
                    </div>
                </div>
                <iframe id="pdf-container" src="${dataURL}" frameborder="0" ></iframe>
                
                <script>
                    document.getElementById('download-btn').addEventListener('click', async () => {
                        const result = await window.pdfPreview.download(${JSON.stringify(dataURL)}, ${JSON.stringify(sanitizedFileName)});
                        if (result && result.ok) {
                            const btn = document.getElementById('download-btn');
                            const originalIcon = btn.innerHTML;
                            btn.innerHTML = '✓';
                            btn.classList.add('success');
                            setTimeout(() => {
                                btn.innerHTML = originalIcon;
                                btn.classList.remove('success');
                            }, 2000);
                        }
                    });
                    document.getElementById('maximize-btn').addEventListener('click', async () => {
                        const result = await window.pdfPreview.toggleMaximize();
                        if (result && result.ok) {
                            const btn = document.getElementById('maximize-btn');
                            btn.innerHTML = result.maximized ? '🗗' : '☐';
                        }
                    });
                    document.getElementById('minimize-btn').addEventListener('click', () => {
                        window.pdfPreview.minimize();
                    });
                    
                    document.getElementById('close-btn').addEventListener('click', () => {
                        window.pdfPreview.close();
                    });
                </script>
            </body>
            </html>
        `;

            await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

            return { ok: true };
        } catch (error) {
            console.error('Error previewing PDF:', error);
            return { ok: false, error: (error as Error).message };
        }
    });


    const tray = createTray(mainWindow);
    // Setup auto-updater only in production builds
    if (!isDev()) {
        if (autoUpdater) {
            setupAutoUpdater(mainWindow, tray);
        } else {
            // Optionally log or notify once that updater is unavailable
            try { dialog.showMessageBox({ type: 'warning', message: 'Auto-updater module not available. Update checks will be disabled.' }); } catch { }
        }
        // If UPDATE_URL is provided, use it as a generic provider
        try {
            if (autoUpdater) {
                const feed = process.env.UPDATE_URL;
                if (feed && typeof feed === 'string' && feed.startsWith('http')) {
                    autoUpdater.setFeedURL({ provider: 'generic', url: feed });
                }
            }
        } catch { }
        // Optional: immediately check for updates on startup
        try { autoUpdater && autoUpdater.checkForUpdatesAndNotify().catch(() => { }); } catch { }
    }
    handleCloseEvent(mainWindow);
});

function createTray(mainWindow: BrowserWindow) {
    const tray = new Tray(path.join(getAssetsPath() + '/icon@5x.png'));
    tray.setToolTip(process.env.VITE_APP_NAME || 'Warehouse CRM');
    tray.on('click', () => mainWindow.show());
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Show', click: () => mainWindow.show() },
        {
            label: 'Check for updates', click: () => {
                if (isDev()) {
                    dialog.showMessageBox({ type: 'info', message: 'Auto-update is disabled in development.' });
                    return;
                }
                if (!autoUpdater) {
                    dialog.showErrorBox('Update check failed', 'Auto-updater module is not available. Ensure "electron-updater" is installed and included in dependencies.');
                    return;
                }
                try {
                    autoUpdater.checkForUpdates().catch((err: any) => {
                        dialog.showErrorBox('Update check failed', (err && err.message) || String(err));
                    });
                } catch (err: any) {
                    dialog.showErrorBox('Update check failed', err?.message || String(err));
                }
            }
        },
        { type: 'separator' },
        { role: 'quit', label: 'Quit', click: () => app.quit() }
    ]));
    return tray;
}

function handleCloseEvent(mainWindow: BrowserWindow) {
    let willClose = false;
    mainWindow.on('close', (e) => {
        if (!willClose) {
            e.preventDefault();
            mainWindow.hide();
        }
    });
    app.on('before-quit', () => willClose = true);
    mainWindow.on('show', () => willClose = false);
    return willClose;
}
