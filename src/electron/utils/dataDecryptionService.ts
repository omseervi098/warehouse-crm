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
            console.log('DataDecryptionService: Found models with encryption:', modelsWithEncryption.length);
            console.log('Models:', modelsWithEncryption.map(m => ({ name: m.model.collection.name, fields: m.encryptedFields })));

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

                console.log(`Decrypting record ${record._id} in ${model.collection.name}`);
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
                    console.log(`Processing field ${fieldName} with value type:`, typeof fieldValue);
                    console.log(`Field ${fieldName} value sample:`, typeof fieldValue === 'string' ? fieldValue.substring(0, 100) : JSON.stringify(fieldValue).substring(0, 100));
                    console.log(`Field ${fieldName} looks encrypted:`, this.looksLikeEncryptedData(fieldValue));

                    // Decrypt the field value
                    const decryptedValue = await this.decryptFieldValue(fieldValue, currentKey);

                    // Only update if the value was actually encrypted
                    if (decryptedValue !== fieldValue) {
                        console.log(`Field ${fieldName} decrypted successfully`);
                        updates[fieldName] = decryptedValue;
                        hasUpdates = true;
                    } else {
                        console.log(`Field ${fieldName} was not encrypted or already decrypted`);
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
            console.log(`Updating record ${record._id} with decrypted data:`, Object.keys(updates));
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

            let parsedValue = encryptedValue;

            // If it's a string, parse it first
            if (typeof encryptedValue === 'string') {
                try {
                    parsedValue = JSON.parse(encryptedValue);
                } catch {
                    return encryptedValue;
                }
            }

            // Handle arrays of encrypted data
            if (Array.isArray(parsedValue)) {
                const decryptedArray: any[] = [];
                for (const item of parsedValue) {
                    if (item && CryptoService.isEncryptedData(item)) {
                        const decryptedItem = CryptoService.decrypt(item, key);
                        // Keep decrypted values as strings to preserve formatting (important for contact numbers)
                        decryptedArray.push(decryptedItem);
                    } else if (typeof item === 'string') {
                        // Handle nested JSON string containing array of encrypted objects
                        try {
                            const nestedArray = JSON.parse(item);
                            if (Array.isArray(nestedArray)) {
                                const decryptedNestedArray: any[] = [];
                                for (const nestedItem of nestedArray) {
                                    if (CryptoService.isEncryptedData(nestedItem)) {
                                        const decryptedNestedItem = CryptoService.decrypt(nestedItem, key);
                                        // For contact numbers and similar fields, keep as string to preserve formatting
                                        decryptedNestedArray.push(decryptedNestedItem);
                                    } else {
                                        decryptedNestedArray.push(nestedItem);
                                    }
                                }
                                // Return the flattened array instead of nested structure
                                decryptedArray.push(...decryptedNestedArray);
                            } else if (CryptoService.isEncryptedData(nestedArray)) {
                                const decryptedNestedItem = CryptoService.decrypt(nestedArray, key);
                                // Keep as string to preserve formatting
                                decryptedArray.push(decryptedNestedItem);
                            } else {
                                decryptedArray.push(item);
                            }
                        } catch {
                            // Not a JSON string, keep as is
                            decryptedArray.push(item);
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
                // Return as string to preserve original formatting (important for contact numbers, IDs, etc.)
                return decryptedStr;
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
     * Checks if a value looks like encrypted data
     * @param value - The value to check
     * @returns True if the value looks like encrypted data
     */
    private looksLikeEncryptedData(value: any): boolean {
        // Handle direct object (already parsed)
        if (typeof value === 'object' && value !== null) {
            // Check if it's an array of encrypted data or strings containing encrypted data
            if (Array.isArray(value)) {
                return value.some(item => {
                    if (CryptoService.isEncryptedData(item)) {
                        return true;
                    }
                    // Check if array item is a string containing encrypted data
                    if (typeof item === 'string') {
                        try {
                            const parsed = JSON.parse(item);
                            return CryptoService.isEncryptedData(parsed) ||
                                (Array.isArray(parsed) && parsed.some(subItem => CryptoService.isEncryptedData(subItem)));
                        } catch {
                            return false;
                        }
                    }
                    return false;
                });
            }

            // Check if it's a single encrypted data object
            return CryptoService.isEncryptedData(value);
        }

        // Handle string (JSON encoded)
        if (typeof value === 'string') {
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

        return false;
    }
}

export default DataDecryptionService;