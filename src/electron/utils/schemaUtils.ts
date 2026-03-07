import mongoose from 'mongoose';
import { CryptoService } from './crypto.js';

/**
 * Interface for schema field information
 */
export interface SchemaFieldInfo {
    path: string;
    type: string;
    encrypted: boolean;
    required: boolean;
    isArray: boolean;
}

/**
 * Interface for encryption validation result
 */
export interface EncryptionValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Schema enhancement utilities for encryption functionality
 */
export class SchemaUtils {

    /**
     * Detects all fields marked with encrypted: true in a schema
     * @param schema - The Mongoose schema to analyze
     * @returns Array of SchemaFieldInfo for encrypted fields
     */
    static getEncryptedFields(schema: mongoose.Schema): SchemaFieldInfo[] {
        const encryptedFields: SchemaFieldInfo[] = [];

        schema.eachPath((pathname: string, schemaType: any) => {
            if (schemaType.options && schemaType.options.encrypted === true) {
                encryptedFields.push({
                    path: pathname,
                    type: schemaType.instance || 'Mixed',
                    encrypted: true,
                    required: Boolean(schemaType.options.required),
                    isArray: Array.isArray(schemaType.options.type) || schemaType instanceof mongoose.Schema.Types.Array
                });
            }
        });

        return encryptedFields;
    }

    /**
     * Gets all field information from a schema (encrypted and non-encrypted)
     * @param schema - The Mongoose schema to analyze
     * @returns Array of SchemaFieldInfo for all fields
     */
    static getAllFields(schema: mongoose.Schema): SchemaFieldInfo[] {
        const fields: SchemaFieldInfo[] = [];

        schema.eachPath((pathname: string, schemaType: any) => {
            // Skip internal mongoose fields
            if (pathname.startsWith('_') || pathname === '__v') {
                return;
            }

            fields.push({
                path: pathname,
                type: schemaType.instance || 'Mixed',
                encrypted: Boolean(schemaType.options && schemaType.options.encrypted),
                required: Boolean(schemaType.options && schemaType.options.required),
                isArray: Array.isArray(schemaType.options.type) || schemaType instanceof mongoose.Schema.Types.Array
            });
        });

        return fields;
    }

    /**
     * Validates encryption configuration for a schema
     * @param schema - The Mongoose schema to validate
     * @returns EncryptionValidationResult with validation details
     */
    static validateEncryptionConfig(schema: mongoose.Schema): EncryptionValidationResult {
        const result: EncryptionValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        const encryptedFields = this.getEncryptedFields(schema);

        // Check if there are any encrypted fields
        if (encryptedFields.length === 0) {
            result.warnings.push('No fields marked for encryption in schema');
            return result;
        }

        // Validate each encrypted field
        for (const field of encryptedFields) {
            // Check supported types
            if (!this.isSupportedEncryptionType(field.type)) {
                result.errors.push(`Field '${field.path}' has unsupported type '${field.type}' for encryption`);
                result.isValid = false;
            }

            // Warn about performance implications for required fields
            if (field.required) {
                result.warnings.push(`Required field '${field.path}' is encrypted - this may impact query performance`);
            }

            // Warn about array fields
            if (field.isArray) {
                result.warnings.push(`Array field '${field.path}' is encrypted - individual array elements will be encrypted`);
            }
        }

        return result;
    }

    /**
     * Checks if a field type is supported for encryption
     * @param fieldType - The field type to check
     * @returns True if the type is supported for encryption
     */
    static isSupportedEncryptionType(fieldType: string): boolean {
        const supportedTypes = [
            'String',
            'Number',
            'Boolean',
            'Date',
            'Mixed',
            'Array'
        ];

        return supportedTypes.includes(fieldType);
    }

    /**
     * Detects if a document contains unencrypted data for fields that should be encrypted
     * @param doc - The document to check
     * @param schema - The schema definition
     * @returns Object with field paths and whether they contain unencrypted data
     */
    static detectUnencryptedData(doc: any, schema: mongoose.Schema): Record<string, boolean> {
        const encryptedFields = this.getEncryptedFields(schema);
        const unencryptedData: Record<string, boolean> = {};

        for (const field of encryptedFields) {
            const value = this.getFieldValue(doc, field.path);

            if (value !== null && value !== undefined) {
                unencryptedData[field.path] = !this.isEncryptedValue(value);
            }
        }

        return unencryptedData;
    }

    /**
     * Checks if a value appears to be encrypted
     * @param value - The value to check
     * @returns True if the value appears to be encrypted
     */
    static isEncryptedValue(value: any): boolean {
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

    /**
     * Creates a migration plan for encrypting existing unencrypted data
     * @param modelName - The name of the model
     * @param schema - The schema definition
     * @returns Migration plan with field information
     */
    static createEncryptionMigrationPlan(modelName: string, schema: mongoose.Schema): {
        modelName: string;
        encryptedFields: SchemaFieldInfo[];
        estimatedImpact: string;
        recommendations: string[];
    } {
        const encryptedFields = this.getEncryptedFields(schema);
        const recommendations: string[] = [];

        // Add recommendations based on field types
        const hasArrayFields = encryptedFields.some(f => f.isArray);
        const hasRequiredFields = encryptedFields.some(f => f.required);

        if (hasArrayFields) {
            recommendations.push('Array fields will have each element encrypted individually');
        }

        if (hasRequiredFields) {
            recommendations.push('Required encrypted fields may impact query performance - consider indexing strategies');
        }

        if (encryptedFields.length > 5) {
            recommendations.push('Large number of encrypted fields detected - consider batch processing for migration');
        }

        recommendations.push('Backup your database before running encryption migration');
        recommendations.push('Test encryption/decryption with a small dataset first');

        return {
            modelName,
            encryptedFields,
            estimatedImpact: this.calculateMigrationImpact(encryptedFields),
            recommendations
        };
    }

    /**
     * Validates that encryption configuration is compatible with existing data
     * @param doc - Sample document to validate against
     * @param schema - The schema definition
     * @returns Validation result with compatibility information
     */
    static validateBackwardCompatibility(doc: any, schema: mongoose.Schema): EncryptionValidationResult {
        const result: EncryptionValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        const encryptedFields = this.getEncryptedFields(schema);
        const unencryptedData = this.detectUnencryptedData(doc, schema);

        for (const field of encryptedFields) {
            const hasUnencryptedData = unencryptedData[field.path];

            if (hasUnencryptedData) {
                result.warnings.push(`Field '${field.path}' contains unencrypted data that will be encrypted on next save`);
            }

            // Check for potential data type issues
            const value = this.getFieldValue(doc, field.path);
            if (value !== null && value !== undefined) {
                if (field.isArray && !Array.isArray(value)) {
                    result.errors.push(`Field '${field.path}' is marked as array but contains non-array value`);
                    result.isValid = false;
                }
            }
        }

        return result;
    }

    /**
     * Gets the value of a field from a document, handling nested paths
     * @param doc - The document
     * @param fieldPath - The field path (e.g., 'name' or 'nested.field')
     * @returns The field value
     */
    private static getFieldValue(doc: any, fieldPath: string): any {
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
     * Calculates the estimated impact of encryption migration
     * @param encryptedFields - Array of encrypted fields
     * @returns Impact assessment string
     */
    private static calculateMigrationImpact(encryptedFields: SchemaFieldInfo[]): string {
        const fieldCount = encryptedFields.length;
        const hasArrays = encryptedFields.some(f => f.isArray);
        const hasRequired = encryptedFields.some(f => f.required);

        if (fieldCount === 0) {
            return 'No impact - no encrypted fields';
        } else if (fieldCount <= 2 && !hasArrays) {
            return 'Low impact - few fields, simple types';
        } else if (fieldCount <= 5 && !hasRequired) {
            return 'Medium impact - moderate number of fields';
        } else {
            return 'High impact - many fields or complex types';
        }
    }

    /**
     * Generates a summary report of encryption configuration for a schema
     * @param schema - The schema to analyze
     * @param modelName - Optional model name for the report
     * @returns Formatted report string
     */
    static generateEncryptionReport(schema: mongoose.Schema, modelName?: string): string {
        const encryptedFields = this.getEncryptedFields(schema);
        const allFields = this.getAllFields(schema);
        const validation = this.validateEncryptionConfig(schema);

        let report = '';

        if (modelName) {
            report += `Encryption Report for ${modelName}\n`;
            report += '='.repeat(30 + modelName.length) + '\n\n';
        } else {
            report += 'Schema Encryption Report\n';
            report += '='.repeat(23) + '\n\n';
        }

        report += `Total Fields: ${allFields.length}\n`;
        report += `Encrypted Fields: ${encryptedFields.length}\n`;
        report += `Encryption Coverage: ${((encryptedFields.length / allFields.length) * 100).toFixed(1)}%\n\n`;

        if (encryptedFields.length > 0) {
            report += 'Encrypted Fields:\n';
            for (const field of encryptedFields) {
                report += `  - ${field.path} (${field.type}${field.isArray ? '[]' : ''})${field.required ? ' *required' : ''}\n`;
            }
            report += '\n';
        }

        if (validation.errors.length > 0) {
            report += 'Errors:\n';
            for (const error of validation.errors) {
                report += `  ❌ ${error}\n`;
            }
            report += '\n';
        }

        if (validation.warnings.length > 0) {
            report += 'Warnings:\n';
            for (const warning of validation.warnings) {
                report += `  ⚠️  ${warning}\n`;
            }
            report += '\n';
        }

        report += `Configuration Status: ${validation.isValid ? '✅ Valid' : '❌ Invalid'}\n`;

        return report;
    }
}

/**
 * Convenience function to validate and report on schema encryption configuration
 * @param schema - The schema to validate
 * @param modelName - Optional model name for reporting
 * @returns Validation result and report
 */
export function validateSchemaEncryption(schema: mongoose.Schema, modelName?: string): {
    validation: EncryptionValidationResult;
    report: string;
} {
    const validation = SchemaUtils.validateEncryptionConfig(schema);
    const report = SchemaUtils.generateEncryptionReport(schema, modelName);

    return { validation, report };
}

/**
 * Default export
 */
export default SchemaUtils;