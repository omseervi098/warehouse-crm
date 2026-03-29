import mongoose from 'mongoose';
import { CryptoService } from './crypto.js';
import { KeyManager } from './keyManager.js';

/**
 * Interface for decryption progress tracking
 */
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

/**
 * Interface for decryption errors
 */
export interface DecryptionError {
    recordId: string;
    collection: string;
    field: string;
    error: string;
    timestamp: Date;
}

/**
 * Service that decrypts all encrypted data and stores it as plain text
 * Used when disabling encryption to prevent data loss
 */
export class DataDecryptionService {
    private static readonly BATCH_SIZE = 100;

    private progress: DecryptionProgress;
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
     * Decrypts all encrypted data and stores it as plain text
     * @param progressCallback - Optional callback for progress updates
     * @returns Promise<DecryptionProgress> - Final decryption progress
     */
    async decryptAllData(
        progressCallback?: (progress: DecryptionProgress) => void
    ): Promise<DecryptionProgress> {
        try {
            // Get current key for decryption
            const currentKey = await KeyManager.getEncryptionKey();
            if (!currentKey) {
                throw new Error('No encryption key found');
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

                await this.decryptCollection(
                    model,
                    encryptedFields,
                    currentKey,
                    progressCallback
                );
            }

            // Mark as completed if not cancelled
            if (this.progress.status === 'running') {
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
     * Cancels the ongoing decryption process
     */
    cancelDecryption(): void {
        this.isCancelled = true;
    }

    /**
     * Gets the current decryption progress
     * @returns DecryptionProgress
     */
    getProgress(): DecryptionProgress {
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
            const collection = model.collection;
            const count = await collection.countDocuments();
            total += count;
        }

        return total;
    }

    /**
     * Decrypts a single collection by converting all encrypted fields to plain text
     * @param model - The Mongoose model
     * @param encryptedFields - Array of encrypted field names
     * @param currentKey - Current encryption key for decryption
     * @param progressCallback - Optional progress callback
     */
    private async decryptCollection(
        model: mongoose.Model<any>,
        encryptedFields: string[],
        currentKey: Buffer,
        progressCallback?: (progress: DecryptionProgress) => void
    ): Promise<void> {
        let skip = 0;
        let hasMore = true;

        while (hasMore && !this.isCancelled) {
            // Fetch batch of records using raw MongoDB collection to avoid automatic decryption
            const collection = model.collection;
            const records = await collection.find({})
                .skip(skip)
                .limit(DataDecryptionService.BATCH_SIZE)
                .toArray();

            if (records.length === 0) {
                hasMore = false;
                break;
            }

            // Process each record in the batch
            for (const record of records) {
                if (this.isCancelled) {
                    break;
                }

                await this.decryptRecord(
                    model,
                    record,
                    encryptedFields,
                    currentKey
                );

                this.progress.processedRecords++;

                if (progressCallback && this.progress.processedRecords % 10 === 0) {
                    progressCallback(this.progress);
                }
            }

            skip += DataDecryptionService.BATCH_SIZE;
        }
    }

    /**
     * Decrypts a single record by converting its encrypted fields to plain text
     * @param model - The Mongoose model
     * @param record - The record to decrypt
     * @param encryptedFields - Array of encrypted field names
     * @param currentKey - Current encryption key for decryption
     */
    private async decryptRecord(
        model: mongoose.Model<any>,
        record: any,
        encryptedFields: string[],
        currentKey: Buffer
    ): Promise<void> {
        const updates: any = {};
        let hasUpdates = false;

        for (const fieldName of encryptedFields) {
            try {
                const fieldValue = this.getFieldValue(record, fieldName);

                if (fieldValue !== null && fieldValue !== undefined) {
                    // Decrypt the field value
                    const decryptedValue = this.normalizeDecryptedValueForSchema(
                        await this.decryptFieldValue(fieldValue, currentKey),
                        model.schema,
                        fieldName
                    );

                    // Only update if the value was actually encrypted
                    if (decryptedValue !== fieldValue) {
                        updates[fieldName] = decryptedValue;
                        hasUpdates = true;
                    } else {
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
            // Use raw MongoDB collection to bypass Mongoose middleware that would re-encrypt the data
            const collection = model.collection;
            await collection.updateOne({ _id: record._id }, { $set: updates });
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

            if (!this.looksLikeEncryptedData(encryptedValue)) {
                return encryptedValue;
            }

            return this.decryptStructuredValue(encryptedValue, key);
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
     * Normalizes decrypted values to match the schema shape.
     * This avoids array-backed fields like contactNos being written back as a single string.
     */
    private normalizeDecryptedValueForSchema(
        value: any,
        schema: mongoose.Schema,
        fieldPath: string
    ): any {
        const schemaType: any = schema.path(fieldPath);
        const isArrayField =
            schemaType instanceof mongoose.Schema.Types.Array ||
            schemaType?.instance === 'Array' ||
            Array.isArray(schemaType?.options?.type);

        if (!isArrayField) {
            return value;
        }

        if (Array.isArray(value)) {
            return value.map(item => item == null ? item : String(item));
        }

        if (value == null || value === '') {
            return [];
        }

        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                    return parsed.map(item => item == null ? item : String(item));
                }
            } catch {
                // Plain strings for array fields should become a single-item array.
            }
        }

        return [String(value)];
    }

    private decryptStructuredValue(value: any, key: Buffer): any {
        if (value === null || value === undefined) {
            return value;
        }

        if (CryptoService.isEncryptedData(value)) {
            return CryptoService.decrypt(value, key);
        }

        if (Array.isArray(value)) {
            const decryptedArray: any[] = [];
            for (const item of value) {
                const decryptedItem = this.decryptStructuredValue(item, key);
                if (Array.isArray(decryptedItem)) {
                    decryptedArray.push(...decryptedItem);
                } else {
                    decryptedArray.push(decryptedItem);
                }
            }
            return decryptedArray;
        }

        if (typeof value === 'string') {
            const parsed = this.tryParseStructuredString(value);
            if (parsed !== undefined) {
                return this.decryptStructuredValue(parsed, key);
            }
            return value;
        }

        return value;
    }

    private tryParseStructuredString(value: string): any | undefined {
        const trimmed = value.trim();
        if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
            return undefined;
        }

        try {
            return JSON.parse(value);
        } catch {
            return undefined;
        }
    }

    /**
     * Checks if a value looks like encrypted data
     * @param value - The value to check
     * @returns True if the value looks like encrypted data
     */
    private looksLikeEncryptedData(value: any): boolean {
        if (value === null || value === undefined) {
            return false;
        }

        if (CryptoService.isEncryptedData(value)) {
            return true;
        }

        if (Array.isArray(value)) {
            return value.some(item => this.looksLikeEncryptedData(item));
        }

        if (typeof value === 'string') {
            const parsed = this.tryParseStructuredString(value);
            return parsed !== undefined ? this.looksLikeEncryptedData(parsed) : false;
        }

        return false;
    }
}

export default DataDecryptionService;
