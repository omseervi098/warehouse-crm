import mongoose from 'mongoose';
import { CryptoService, EncryptedData } from './crypto.js';
import { KeyManager } from './keyManager.js';

/**
 * Interface for encryption middleware functionality
 */
export interface EncryptionMiddleware {
    encryptFields(doc: any, schema: any): Promise<void>;
    decryptFields(doc: any, schema: any): Promise<void>;
    setupSchemaMiddleware(schema: mongoose.Schema): void;
}

/**
 * Encryption middleware for Mongoose schemas that automatically encrypts/decrypts
 * fields marked with encrypted: true flag
 */
export class MongooseEncryptionMiddleware implements EncryptionMiddleware {

    /**
     * Encrypts fields marked with encrypted: true in a document
     * @param doc - The document to encrypt fields in
     * @param schema - The schema definition
     */
    async encryptFields(doc: any, schema: any): Promise<void> {
        try {
            const encryptionKey = await KeyManager.getEncryptionKey();
            if (!encryptionKey) {
                // If no encryption key is available, skip encryption
                return;
            }

            const encryptedFields = this.getEncryptedFields(schema);

            for (const fieldPath of encryptedFields) {
                const value = this.getFieldValue(doc, fieldPath);

                if (value !== null && value !== undefined) {
                    const encryptedValue = await this.encryptFieldValue(value, encryptionKey);
                    this.setFieldValue(doc, fieldPath, encryptedValue);
                }
            }
        } catch (error) {
            throw new Error(`Field encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Decrypts fields marked with encrypted: true in a document
     * @param doc - The document to decrypt fields in
     * @param schema - The schema definition
     */
    async decryptFields(doc: any, schema: any): Promise<void> {
        try {
            const encryptionKey = await KeyManager.getEncryptionKey();
            if (!encryptionKey) {
                return;
            }

            const encryptedFields = this.getEncryptedFields(schema);

            for (const fieldPath of encryptedFields) {
                const value = this.getFieldValue(doc, fieldPath);

                if (value !== null && value !== undefined) {
                    try {
                        const decryptedValue = await this.decryptFieldValue(value, encryptionKey);
                        this.setFieldValue(doc, fieldPath, decryptedValue);
                    } catch (fieldError) {
                        console.error(`Failed to decrypt field ${fieldPath}:`, fieldError);
                    }
                }
            }
        } catch (error) {
            // Log error but don't throw to prevent breaking queries
            console.error(`Field decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Sets up pre-save and post-find middleware on a Mongoose schema
     * @param schema - The Mongoose schema to enhance with encryption middleware
     */
    setupSchemaMiddleware(schema: mongoose.Schema): void {
        // Pre-save middleware to encrypt fields before saving
        schema.pre('save', async function (this: any) {
            const middleware = new MongooseEncryptionMiddleware();
            await middleware.encryptFields(this, schema);
        });

        // Pre-update middleware for findOneAndUpdate, updateOne, etc.
        schema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], async function (this: any) {
            const update = this.getUpdate();
            if (update && typeof update === 'object') {
                const middleware = new MongooseEncryptionMiddleware();
                await middleware.encryptFields(update, schema);
                this.setUpdate(update);
            }
        });

        // Post-find middleware to decrypt fields after querying
        schema.post(['find', 'findOne', 'findOneAndUpdate'], async function (docs: any) {
            if (!docs) return;

            const middleware = new MongooseEncryptionMiddleware();
            const docsArray = Array.isArray(docs) ? docs : [docs];

            for (const doc of docsArray) {
                if (doc) {
                    await middleware.decryptFields(doc, schema);
                }
            }
        });

        // Post-init middleware for individual document initialization
        schema.post('init', async function (this: any) {
            const middleware = new MongooseEncryptionMiddleware();
            await middleware.decryptFields(this, schema);
        });
    }

    /**
     * Gets all field paths marked with encrypted: true from a schema
     * @param schema - The Mongoose schema
     * @returns Array of field paths that should be encrypted
     */
    private getEncryptedFields(schema: mongoose.Schema): string[] {
        const encryptedFields: string[] = [];

        schema.eachPath((pathname: string, schemaType: any) => {
            if (schemaType.options && schemaType.options.encrypted === true) {
                encryptedFields.push(pathname);
            }
        });

        return encryptedFields;
    }

    /**
     * Gets the value of a field from a document, handling nested paths
     * @param doc - The document
     * @param fieldPath - The field path (e.g., 'name' or 'nested.field')
     * @returns The field value
     */
    private getFieldValue(doc: any, fieldPath: string): any {
        const pathParts = fieldPath.split('.');
        let value = doc;

        for (const part of pathParts) {
            if (value && typeof value === 'object') {
                value = value[part];
            } else {
                return undefined;
            }
        }

        return value;
    }

    /**
     * Sets the value of a field in a document, handling nested paths
     * @param doc - The document
     * @param fieldPath - The field path (e.g., 'name' or 'nested.field')
     * @param value - The value to set
     */
    private setFieldValue(doc: any, fieldPath: string, value: any): void {
        const pathParts = fieldPath.split('.');
        let current = doc;

        for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            if (!current[part] || typeof current[part] !== 'object') {
                current[part] = {};
            }
            current = current[part];
        }

        current[pathParts[pathParts.length - 1]] = value;
    }

    /**
     * Encrypts a field value, handling different data types
     * @param value - The value to encrypt
     * @param key - The encryption key
     * @returns The encrypted value as a JSON string
     */
    private async encryptFieldValue(value: any, key: Buffer): Promise<string> {
        try {
            // Handle null/undefined values
            if (value === null || value === undefined) {
                return value;
            }

            // Check if value is already encrypted
            if (this.isAlreadyEncrypted(value)) {
                return value;
            }

            // Handle arrays
            if (Array.isArray(value)) {
                const encryptedArray: EncryptedData[] = [];
                for (const item of value) {
                    if (item !== null && item !== undefined) {
                        const itemStr = typeof item === 'string' ? item : JSON.stringify(item);
                        const encryptedItem = CryptoService.encrypt(itemStr, key);
                        encryptedArray.push(encryptedItem);
                    } else {
                        encryptedArray.push(item);
                    }
                }
                return JSON.stringify(encryptedArray);
            }

            // Handle objects and primitives
            const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
            const encryptedData = CryptoService.encrypt(valueStr, key);
            return JSON.stringify(encryptedData);
        } catch (error) {
            throw new Error(`Failed to encrypt field value: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Decrypts a field value, handling different data types
     * @param value - The encrypted value to decrypt
     * @param key - The decryption key
     * @returns The decrypted value in its original type
     */
    private async decryptFieldValue(value: any, key: Buffer): Promise<any> {
        try {
            // Handle null/undefined values
            if (value === null || value === undefined) {
                return value;
            }

            // Handle arrays where each element might be an encrypted JSON string
            if (Array.isArray(value)) {
                const decryptedArray: any[] = [];
                for (const item of value) {
                    if (typeof item === 'string' && this.looksLikeEncryptedData(item)) {
                        // This is a JSON string containing encrypted data
                        try {
                            const parsedItem = JSON.parse(item);
                            if (Array.isArray(parsedItem)) {
                                // Handle array of encrypted objects
                                const itemDecryptedArray: any[] = [];
                                for (const encItem of parsedItem) {
                                    if (encItem && CryptoService.isEncryptedData(encItem)) {
                                        const decryptedItem = CryptoService.decrypt(encItem, key);
                                        try {
                                            itemDecryptedArray.push(JSON.parse(decryptedItem));
                                        } catch {
                                            itemDecryptedArray.push(decryptedItem);
                                        }
                                    } else {
                                        itemDecryptedArray.push(encItem);
                                    }
                                }
                                decryptedArray.push(...itemDecryptedArray);
                            } else if (CryptoService.isEncryptedData(parsedItem)) {
                                // Single encrypted object
                                const decryptedItem = CryptoService.decrypt(parsedItem, key);
                                try {
                                    decryptedArray.push(JSON.parse(decryptedItem));
                                } catch {
                                    decryptedArray.push(decryptedItem);
                                }
                            } else {
                                decryptedArray.push(parsedItem);
                            }
                        } catch {
                            // If parsing fails, treat as regular string
                            decryptedArray.push(item);
                        }
                    } else {
                        // Not encrypted or not a string, keep as-is
                        decryptedArray.push(item);
                    }
                }
                return decryptedArray;
            }

            // If value is not a string, it's likely not encrypted
            if (typeof value !== 'string') {
                return value;
            }

            // Check if it's already decrypted (plain text)
            if (!this.looksLikeEncryptedData(value)) {
                return value;
            }

            try {
                const parsedValue = JSON.parse(value);

                // Handle arrays of encrypted data
                if (Array.isArray(parsedValue)) {
                    const decryptedArray: any[] = [];
                    for (const item of parsedValue) {
                        if (item && CryptoService.isEncryptedData(item)) {
                            const decryptedItem = CryptoService.decrypt(item, key);
                            // Try to parse as JSON, fallback to string
                            try {
                                decryptedArray.push(JSON.parse(decryptedItem));
                            } catch {
                                decryptedArray.push(decryptedItem);
                            }
                        } else {
                            decryptedArray.push(item);
                        }
                    }
                    return decryptedArray;
                }

                // Handle single encrypted data object
                if (CryptoService.isEncryptedData(parsedValue)) {
                    const decryptedStr = CryptoService.decrypt(parsedValue, key);
                    // Try to parse as JSON, fallback to string
                    try {
                        return JSON.parse(decryptedStr);
                    } catch {
                        return decryptedStr;
                    }
                }

                // If parsed but not encrypted data, return as-is
                return parsedValue;
            } catch (parseError) {
                // If JSON parsing fails, treat as plain text
                return value;
            }
        } catch (error) {
            // If decryption fails, return original value to prevent data loss
            console.error(`Failed to decrypt field value: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return value;
        }
    }

    /**
     * Checks if a value is already encrypted by looking for encrypted data structure
     * @param value - The value to check
     * @returns True if the value appears to be already encrypted
     */
    private isAlreadyEncrypted(value: any): boolean {
        if (typeof value !== 'string') {
            return false;
        }

        return this.looksLikeEncryptedData(value);
    }

    /**
     * Checks if a string looks like encrypted data (JSON with encrypted structure)
     * @param value - The string to check
     * @returns True if the string looks like encrypted data
     */
    private looksLikeEncryptedData(value: string): boolean {
        try {
            const parsed = JSON.parse(value);

            // Check if it's an array of encrypted data
            if (Array.isArray(parsed)) {
                return parsed.some(item => CryptoService.isEncryptedData(item));
            }

            // Check if it's a single encrypted data object
            return CryptoService.isEncryptedData(parsed);
        } catch {
            return false;
        }
    }
}

/**
 * Convenience function to set up encryption middleware on a schema
 * @param schema - The Mongoose schema to enhance with encryption
 */
export function setupEncryption(schema: mongoose.Schema): void {
    const middleware = new MongooseEncryptionMiddleware();
    middleware.setupSchemaMiddleware(schema);
}

/**
 * Default export for the middleware class
 */
export default MongooseEncryptionMiddleware;