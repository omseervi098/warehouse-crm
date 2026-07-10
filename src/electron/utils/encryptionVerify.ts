import Company from '../models/company.js';
import { CryptoService } from './crypto.js';
import { KeyManager } from './keyManager.js';

export interface EncryptionVerifyResult {
    passed: boolean;
    message: string;
    field?: string;
    selfTestPassed: boolean;
    companyFound: boolean;
}

function tryParse(value: string): any | undefined {
    const t = value.trim();
    if (!(t.startsWith('{') || t.startsWith('['))) return undefined;
    try {
        return JSON.parse(value);
    } catch {
        return undefined;
    }
}

function looksEncrypted(value: any): boolean {
    if (value == null) return false;
    if (CryptoService.isEncryptedData(value)) return true;
    if (Array.isArray(value)) {
        return value.length > 0 && value.every((i) => i == null || looksEncrypted(i));
    }
    if (typeof value === 'string') {
        const p = tryParse(value);
        return p !== undefined ? looksEncrypted(p) : false;
    }
    return false;
}

function decryptStored(value: any, key: Buffer): string {
    if (value == null) throw new Error('Empty value');
    if (typeof value === 'string') {
        const parsed = tryParse(value);
        if (parsed && CryptoService.isEncryptedData(parsed)) {
            return CryptoService.decrypt(parsed, key);
        }
        throw new Error('Field is plain text, not encrypted');
    }
    if (CryptoService.isEncryptedData(value)) return CryptoService.decrypt(value, key);
    throw new Error('Unrecognized field format');
}

export async function verifyEncryptionAgainstCompanyProfile(): Promise<EncryptionVerifyResult> {
    const key = await KeyManager.getEncryptionKey();
    if (!key) {
        return {
            passed: false,
            selfTestPassed: false,
            companyFound: false,
            message: 'No encryption key available.',
        };
    }

    const sample = `warehouse-crm-verify-${Date.now()}`;
    let selfTestPassed = false;
    try {
        selfTestPassed = CryptoService.decrypt(CryptoService.encrypt(sample, key), key) === sample;
    } catch {
        selfTestPassed = false;
    }

    if (!selfTestPassed) {
        return {
            passed: false,
            selfTestPassed: false,
            companyFound: false,
            message: 'Self-test failed: key cannot encrypt/decrypt.',
        };
    }

    const company = await Company.collection.findOne({});
    if (!company) {
        return {
            passed: true,
            selfTestPassed: true,
            companyFound: false,
            message: 'Self-test passed. No company profile to verify.',
        };
    }

    const fields = ['warehouseName', 'address', 'email', 'ownerName', 'gstNo', 'panNo'] as const;
    for (const field of fields) {
        const value = (company as any)[field];
        if (value == null || value === '' || !looksEncrypted(value)) continue;

        try {
            const plain = decryptStored(value, key);
            if (typeof plain === 'string' && plain.length > 0) {
                const preview = plain.length > 40 ? `${plain.slice(0, 40)}…` : plain;
                return {
                    passed: true,
                    selfTestPassed: true,
                    companyFound: true,
                    field,
                    message: `Passed. Decrypted company.${field}\nPreview: ${preview}`,
                };
            }
        } catch (err) {
            return {
                passed: false,
                selfTestPassed: true,
                companyFound: true,
                field,
                message:
                    `Failed decrypting company.${field}\n` +
                    `${err instanceof Error ? err.message : String(err)}\n` +
                    'Wrong password vs existing data. Key was not kept.',
            };
        }
    }

    return {
        passed: true,
        selfTestPassed: true,
        companyFound: true,
        message: 'Self-test passed. No encrypted company fields found yet.',
    };
}
