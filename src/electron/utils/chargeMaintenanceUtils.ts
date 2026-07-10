import { ChargeMigrationService, MigrationOptions, MigrationProgress } from './chargeMigration.js';
import { ChargeValidationService, CleanupResult, ConsistencyCheckResult, ValidationSummary } from './chargeValidation.js';

/**
 * Combined utility class for charge data migration and maintenance operations
 * Provides high-level functions for managing charge data lifecycle
 */
export class ChargeMaintenanceUtils {

    /**
     * Perform a complete charge data setup - migration, validation, and cleanup
     */
    static async performCompleteSetup(options: {
        skipExisting?: boolean;
        validateAfterMigration?: boolean;
        cleanupBeforeMigration?: boolean;
        batchSize?: number;
    } = {}): Promise<{
        migration: MigrationProgress;
        validation?: ValidationSummary;
        cleanup?: CleanupResult;
    }> {
        const {
            skipExisting = true,
            validateAfterMigration = true,
            cleanupBeforeMigration = true,
            batchSize = 100
        } = options;


        const results: {
            migration: MigrationProgress;
            validation?: ValidationSummary;
            cleanup?: CleanupResult;
        } = {} as any;

        try {
            // Step 1: Cleanup existing data if requested
            if (cleanupBeforeMigration) {
                results.cleanup = await ChargeValidationService.cleanupChargeData();
            }

            // Step 2: Migrate charge data
            results.migration = await ChargeMigrationService.migrateAllChargeableStocks({
                batchSize,
                skipExisting,
                onProgress: (progress) => {
                    const percentage = ((progress.processed / progress.total) * 100).toFixed(1);
                }
            });

            // Step 3: Validate migrated data if requested
            if (validateAfterMigration) {
                results.validation = await ChargeValidationService.validateAllCharges();

                // If validation found issues, attempt to fix them
                if (results.validation.invalid > 0) {
                    const fixResult = await ChargeValidationService.fixInvalidCharges(results.validation.results);
                }
            }

            return results;

        } catch (error) {
            console.error('Complete charge data setup failed:', error);
            throw error;
        }
    }

    /**
     * Perform routine maintenance on charge data
     */
    static async performRoutineMaintenance(): Promise<{
        consistency: ConsistencyCheckResult;
        cleanup: CleanupResult;
        validation: ValidationSummary;
        stats: any;
    }> {

        try {
            // Check data consistency
            const consistency = await ChargeValidationService.checkDataConsistency();

            // Cleanup orphaned and invalid data
            const cleanup = await ChargeValidationService.cleanupChargeData();

            // Validate a sample of charges (limit to 1000 for performance)
            const Stock = await import('../models/stock.js').then(m => m.default);
            const allChargeLots = await Stock.distinct('lotNumber', { chargeCalculated: true });
            const sampleSize = Math.min(1000, allChargeLots.length);
            const sampleLots = allChargeLots.slice(0, sampleSize);
            const validation = await ChargeValidationService.validateLots(sampleLots);

            // Get current stats
            const stats = await ChargeValidationService.getValidationStats();


            return {
                consistency,
                cleanup,
                validation,
                stats
            };

        } catch (error) {
            console.error('Routine maintenance failed:', error);
            throw error;
        }
    }

    /**
     * Get comprehensive status of charge data system
     */
    static async getSystemStatus(): Promise<{
        migration: {
            totalChargeableLots: number;
            migratedLots: number;
            pendingLots: number;
            migrationPercentage: number;
        };
        consistency: ConsistencyCheckResult;
        stats: any;
    }> {
        try {

            const [migration, consistency, stats] = await Promise.all([
                ChargeMigrationService.getMigrationStatus(),
                ChargeValidationService.checkDataConsistency(),
                ChargeValidationService.getValidationStats()
            ]);

            return {
                migration,
                consistency,
                stats
            };

        } catch (error) {
            console.error('Error getting system status:', error);
            throw error;
        }
    }

    /**
     * Emergency repair function - attempts to fix all known issues
     */
    static async emergencyRepair(): Promise<{
        cleanup: CleanupResult;
        migration: MigrationProgress;
        validation: ValidationSummary;
    }> {

        try {
            // Step 1: Cleanup all inconsistent data
            const cleanup = await ChargeValidationService.cleanupChargeData();

            // Step 2: Re-migrate all missing charges
            const pendingLots = await ChargeMigrationService.findPendingMigrations();
            const migration = await ChargeMigrationService.migrateLots(pendingLots, {
                skipExisting: false // Force recalculation
            });

            // Step 3: Validate everything
            const validation = await ChargeValidationService.validateAllCharges();

            // Step 4: Fix any remaining invalid charges
            if (validation.invalid > 0) {
                await ChargeValidationService.fixInvalidCharges(validation.results);
            }

            return {
                cleanup,
                migration,
                validation
            };

        } catch (error) {
            console.error('Emergency repair failed:', error);
            throw error;
        }
    }

    /**
     * Utility to check if charge system is healthy
     */
    static async isSystemHealthy(): Promise<{
        isHealthy: boolean;
        issues: string[];
        recommendations: string[];
    }> {
        try {
            const status = await this.getSystemStatus();
            const issues: string[] = [];
            const recommendations: string[] = [];

            // Check migration completeness
            if (status.migration.migrationPercentage < 95) {
                issues.push(`Only ${status.migration.migrationPercentage.toFixed(1)}% of chargeable lots have been migrated`);
                recommendations.push('Run charge migration to complete missing lots');
            }

            // Check for orphaned charges
            if (status.consistency.chargesWithoutStock.length > 0) {
                issues.push(`${status.consistency.chargesWithoutStock.length} orphaned charge records found`);
                recommendations.push('Run cleanup to remove orphaned charges');
            }

            // Check for non-chargeable lots with charges
            if (status.consistency.nonChargeableWithCharges.length > 0) {
                issues.push(`${status.consistency.nonChargeableWithCharges.length} non-chargeable lots have charge records`);
                recommendations.push('Run cleanup to remove invalid charges');
            }

            // Check for missing charges
            if (status.consistency.chargeableWithoutCharges.length > 0) {
                issues.push(`${status.consistency.chargeableWithoutCharges.length} chargeable lots missing charge records`);
                recommendations.push('Run migration to create missing charge records');
            }

            const isHealthy = issues.length === 0;

            return {
                isHealthy,
                issues,
                recommendations
            };

        } catch (error) {
            console.error('Error checking system health:', error);
            return {
                isHealthy: false,
                issues: ['Error checking system health'],
                recommendations: ['Check system logs and run emergency repair']
            };
        }
    }
}

// Export all services for direct access if needed
export { ChargeMigrationService, ChargeValidationService };
export type { CleanupResult, ConsistencyCheckResult, MigrationOptions, MigrationProgress, ValidationSummary };

