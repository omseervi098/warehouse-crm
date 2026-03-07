import mongoose from 'mongoose';
import { CryptoService, EncryptedData } from './crypto.js';
import { KeyManager } from './keyManager.js';

/**
 * Interface for migration progress tracking
 */
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

/**
 * Interface for migration errors
 */
export interface MigrationError {
    recordId: string;
    collection: string;
    field: string;
    error: string;
    timestamp: Date;
}

/**
 * Interface for rollback data
 */
export interface RollbackData {
    collection: string;
    recordId: string;
    field: string;
    originalValue: any;
}

/**
 * Key rotation service that handles re-encrypting all encrypted fields
 * when encryption keys are rotated
 */
export class KeyRotationService {
    private static readonly BATCH_SIZE = 100;
    private static readonly MAX_RETRIES = 3;

    private progress: MigrationProgress;
    private rollbackData: RollbackData[] = [];
    private isCancelled = false;

    constructor() {
        this.progress = {
            totalRecords: 0,
            processedRecords: 0,
            failedRecords: 0,
            currentCollection: '',
            status: 'running',
            startTime: new Date(),
            errors: []
        };
    }

    /**
     * Rotates the encryption key and re-encrypts all encrypted data
     * @param newKey - The new encryption key
     * @param progressCallback - Optional callback for progress updates
     * @param keyUpdateCallback - Optional callback to update the key after migration
     * @returns Promise<MigrationProgress> - Final migration progress
     */
    async rotateKeyAndMigrateData(
        newKey: Buffer,
        progressCallback?: (progress: MigrationProgress) => void,
        keyUpdateCallback?: () => Promise<void>
    ): Promise<MigrationProgress> {
        try {
            // Validate new key
            if (!Buffer.isBuffer(newKey) || newKey.length !== 32) {
                throw new Error('Invalid new key: must be a 32-byte Buffer');
            }

            // Get current key for decryption
            const currentKey = await KeyManager.getEncryptionKey();
            if (!currentKey) {
                throw new Error('No current encryption key found');
            }

            // Reset state
            this.progress = {
                totalRecords: 0,
                processedRecords: 0,
                failedRecords: 0,
                currentCollection: '',
                status: 'running',
                startTime: new Date(),
                errors: []
            };
            this.rollbackData = [];
            this.isCancelled = false;

            // Get all models with encrypted fields
            const modelsWithEncryption = this.getModelsWithEncryptedFields();


            // Calculate total records
            this.progress.totalRecords = await this.calculateTotalRecords(modelsWithEncryption);

            if (progressCallback) {
                progressCallback(this.progress);
            }

            // Process each model
            for (const { model, encryptedFields } of modelsWithEncryption) {
                if (this.isCancelled) {
                    this.progress.status = 'cancelled';
                    break;
                }

                this.progress.currentCollection = model.collection.name;

                await this.migrateCollection(
                    model,
                    encryptedFields,
                    currentKey,
                    newKey,
                    progressCallback
                );
            }

            // If migration completed successfully, update the key
            if (this.progress.status === 'running') {
                if (keyUpdateCallback) {
                    await keyUpdateCallback();
                } else {
                    await KeyManager.rotateKey(newKey);
                }
                this.progress.status = 'completed';
                this.progress.endTime = new Date();
            }

            if (progressCallback) {
                progressCallback(this.progress);
            }

            return this.progress;
        } catch (error) {
            this.progress.status = 'failed';
            this.progress.endTime = new Date();
            this.progress.errors.push({
                recordId: 'N/A',
                collection: 'N/A',
                field: 'N/A',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date()
            });

            if (progressCallback) {
                progressCallback(this.progress);
            }

            throw error;
        }
    }

    /**
     * Cancels the ongoing migration process
     */
    cancelMigration(): void {
        this.isCancelled = true;
    }

    /**
     * Rolls back the migration by restoring original values
     * @returns Promise<void>
     */
    async rollbackMigration(): Promise<void> {
        try {
            console.log(`Rolling back ${this.rollbackData.length} records...`);

            for (const rollback of this.rollbackData) {
                try {
                    const Model = mongoose.model(rollback.collection);
                    await Model.updateOne(
                        { _id: rollback.recordId },
                        { [rollback.field]: rollback.originalValue }
                    );
                } catch (error) {
                    console.error(`Failed to rollback record ${rollback.recordId} in ${rollback.collection}:`, error);
                }
            }

            // Clear rollback data
            this.rollbackData = [];
            console.log('Rollback completed');
        } catch (error) {
            throw new Error(`Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Gets the current migration progress
     * @returns MigrationProgress
     */
    getProgress(): MigrationProgress {
        return { ...this.progress };
    }

    /**
     * Gets models that have encrypted fields
     * @returns Array of models with their encrypted field names
     */
    private getModelsWithEncryptedFields(): Array<{ model: mongoose.Model<any>, encryptedFields: string[] }> {
        const modelsWithEncryption: Array<{ model: mongoose.Model<any>, encryptedFields: string[] }> = [];

        // Get all registered models
        const modelNames = mongoose.modelNames();

        for (const modelName of modelNames) {
            const model = mongoose.model(modelName);
            const encryptedFields = this.getEncryptedFieldsFromSchema(model.schema);

            if (encryptedFields.length > 0) {
                modelsWithEncryption.push({ model, encryptedFields });
            }
        }
        return modelsWithEncryption;
    }

    /**
     * Gets encrypted field names from a schema
     * @param schema - The Mongoose schema
     * @returns Array of encrypted field names
     */
    private getEncryptedFieldsFromSchema(schema: mongoose.Schema): string[] {
        const encryptedFields: string[] = [];

        schema.eachPath((pathname: string, schemaType: any) => {
            if (schemaType.options && schemaType.options.encrypted === true) {
                encryptedFields.push(pathname);
            }
        });

        return encryptedFields;
    }

    /**
     * Calculates total number of records to process
     * @param modelsWithEncryption - Models with encrypted fields
     * @returns Promise<number> - Total record count
     */
    private async calculateTotalRecords(
        modelsWithEncryption: Array<{ model: mongoose.Model<any>, encryptedFields: string[] }>
    ): Promise<number> {
        let total = 0;

        for (const { model } of modelsWithEncryption) {
            const count = await model.countDocuments();
            total += count;
        }

        return total;
    }

    /**
     * Migrates a single collection by re-encrypting all encrypted fields
     * @param model - The Mongoose model
     * @param encryptedFields - Array of encrypted field names
     * @param currentKey - Current encryption key for decryption
     * @param newKey - New encryption key for encryption
     * @param progressCallback - Optional progress callback
     */
    private async migrateCollection(
        model: mongoose.Model<any>,
        encryptedFields: string[],
        currentKey: Buffer,
        newKey: Buffer,
        progressCallback?: (progress: MigrationProgress) => void
    ): Promise<void> {
        let skip = 0;
        let hasMore = true;

        while (hasMore && !this.isCancelled) {
            // Fetch batch of records
            const records = await model.find({})
                .skip(skip)
                .limit(KeyRotationService.BATCH_SIZE)
                .lean();

            if (records.length === 0) {
                hasMore = false;
                break;
            }

            // Process each record in the batch
            for (const record of records) {
                if (this.isCancelled) {
                    break;
                }


                await this.migrateRecord(
                    model,
                    record,
                    encryptedFields,
                    currentKey,
                    newKey
                );

                this.progress.processedRecords++;

                if (progressCallback && this.progress.processedRecords % 10 === 0) {
                    progressCallback(this.progress);
                }
            }

            skip += KeyRotationService.BATCH_SIZE;
        }
    }

    /**
     * Migrates a single record by re-encrypting its encrypted fields
     * @param model - The Mongoose model
     * @param record - The record to migrate
     * @param encryptedFields - Array of encrypted field names
     * @param currentKey - Current encryption key for decryption
     * @param newKey - New encryption key for encryption
     */
    private async migrateRecord(
        model: mongoose.Model<any>,
        record: any,
        encryptedFields: string[],
        currentKey: Buffer,
        newKey: Buffer
    ): Promise<void> {
        const updates: any = {};
        let hasUpdates = false;

        for (const fieldName of encryptedFields) {
            try {
                const fieldValue = this.getFieldValue(record, fieldName);


                if (fieldValue !== null && fieldValue !== undefined) {
                    // Store original value for rollback
                    this.rollbackData.push({
                        collection: model.collection.name,
                        recordId: record._id.toString(),
                        field: fieldName,
                        originalValue: fieldValue
                    });

                    // Decrypt with current key and re-encrypt with new key
                    const reencryptedValue = await this.reencryptFieldValue(
                        fieldValue,
                        currentKey,
                        newKey
                    );


                    if (reencryptedValue !== fieldValue) {
                        updates[fieldName] = reencryptedValue;
                        hasUpdates = true;
                    }
                }
            } catch (error) {
                this.progress.failedRecords++;
                this.progress.errors.push({
                    recordId: record._id.toString(),
                    collection: model.collection.name,
                    field: fieldName,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date()
                });

                // Continue with other fields
                continue;
            }
        }

        // Update the record if there are changes
        if (hasUpdates) {
            await model.updateOne({ _id: record._id }, updates);
        }
    }

    /**
     * Re-encrypts a field value with a new key
     * @param encryptedValue - The current encrypted value
     * @param currentKey - Current decryption key
     * @param newKey - New encryption key
     * @returns Promise<any> - The re-encrypted value
     */
    private async reencryptFieldValue(
        encryptedValue: any,
        currentKey: Buffer,
        newKey: Buffer
    ): Promise<any> {
        try {
            // If the value is not encrypted (plain text), encrypt it with new key
            if (!this.looksLikeEncryptedData(encryptedValue)) {
                return await this.encryptFieldValue(encryptedValue, newKey);
            }

            // Decrypt with current key
            const decryptedValue = await this.decryptFieldValue(encryptedValue, currentKey);

            // Re-encrypt with new key
            return await this.encryptFieldValue(decryptedValue, newKey);
        } catch (error) {
            throw new Error(`Failed to re-encrypt field: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Encrypts a field value using the same logic as the encryption middleware
     * @param value - The value to encrypt
     * @param key - The encryption key
     * @returns The encrypted value as a JSON string
     */
    private async encryptFieldValue(value: any, key: Buffer): Promise<string> {
        try {
            if (value === null || value === undefined) {
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
     * Decrypts a field value using the same logic as the encryption middleware
     * @param encryptedValue - The encrypted value to decrypt
     * @param key - The decryption key
     * @returns The decrypted value in its original type
     */
    private async decryptFieldValue(encryptedValue: any, key: Buffer): Promise<any> {
        try {
            if (encryptedValue === null || encryptedValue === undefined) {
                return encryptedValue;
            }

            if (typeof encryptedValue !== 'string') {
                return encryptedValue;
            }

            if (!this.looksLikeEncryptedData(encryptedValue)) {
                return encryptedValue;
            }

            const parsedValue = JSON.parse(encryptedValue);

            // Handle arrays of encrypted data
            if (Array.isArray(parsedValue)) {
                const decryptedArray: any[] = [];
                for (const item of parsedValue) {
                    if (item && CryptoService.isEncryptedData(item)) {
                        const decryptedItem = CryptoService.decrypt(item, key);
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
                try {
                    return JSON.parse(decryptedStr);
                } catch {
                    return decryptedStr;
                }
            }

            return parsedValue;
        } catch (error) {
            throw new Error(`Failed to decrypt field value: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Gets the value of a field from a record, handling nested paths
     * @param record - The record
     * @param fieldPath - The field path
     * @returns The field value
     */
    private getFieldValue(record: any, fieldPath: string): any {
        const pathParts = fieldPath.split('.');
        let value = record;

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
     * Checks if a string looks like encrypted data
     * @param value - The string to check
     * @returns True if the string looks like encrypted data
     */
    private looksLikeEncryptedData(value: any): boolean {
        if (typeof value !== 'string') {
            return false;
        }

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
 * Convenience function to rotate key and migrate data
 * @param newKey - The new encryption key
 * @param progressCallback - Optional progress callback
 * @returns Promise<MigrationProgress> - Migration progress
 */
export async function rotateEncryptionKey(
    newKey: Buffer,
    progressCallback?: (progress: MigrationProgress) => void
): Promise<MigrationProgress> {
    const service = new KeyRotationService();
    return await service.rotateKeyAndMigrateData(newKey, progressCallback);
}

export default KeyRotationService;