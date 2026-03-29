
import Stock from '../models/stock.js';
import { computeChargesForLot } from './charge.js';
import { ChargeService } from './chargeService.js';

export interface ValidationResult {
    lotNumber: string;
    isValid: boolean;
    errors: string[];
    storedCharge?: number;
    dynamicCharge?: number;
    difference?: number;
}

export interface ValidationSummary {
    total: number;
    valid: number;
    invalid: number;
    validationPercentage: number;
    results: ValidationResult[];
    startTime: Date;
    endTime?: Date;
    duration?: number;
}

export interface CleanupResult {
    orphanedChargesRemoved: number;
    invalidChargesRemoved: number;
    inconsistentChargesFixed: number;
    errors: Array<{
        lotNumber: string;
        error: string;
    }>;
}

export interface ConsistencyCheckResult {
    stockWithoutCharges: string[];
    chargesWithoutStock: string[];
    nonChargeableWithCharges: string[];
    chargeableWithoutCharges: string[];
}

export class ChargeValidationService {
    private static readonly CHARGE_TOLERANCE = 0.01; // Allow 1 cent difference for floating point precision
    private static readonly VALIDATION_BATCH_SIZE = 50;

    /**
     * Validate charge calculations match expected results for a single lot
     */
    static async validateLot(lotNumber: string): Promise<ValidationResult> {
        const result: ValidationResult = {
            lotNumber,
            isValid: false,
            errors: []
        };

        try {
            // Get stock record with charge data
            const stock = await Stock.findOne({ lotNumber }).lean();
            if (!stock) {
                result.errors.push('No stock record found');
                return result;
            }

            // Check if lot should be chargeable
            if (!stock.chargeable) {
                if (stock.chargeCalculated) {
                    result.errors.push('Stock is not chargeable but has charge data');
                }
                return result;
            }

            // Check if charge data exists
            if (!stock.chargeCalculated || stock.totalCharge === undefined) {
                result.errors.push('No charge data found in stock record');
                return result;
            }

            // Calculate dynamic charge
            const dynamicChargeData = await computeChargesForLot(stock, false);

            result.storedCharge = stock.totalCharge;
            result.dynamicCharge = dynamicChargeData.totalCharge;

            // Calculate difference only if both values are available
            if (result.storedCharge !== undefined && result.dynamicCharge !== undefined) {
                result.difference = Math.abs(result.storedCharge - result.dynamicCharge);
            }

            // Validate total charge
            if (result.difference !== undefined && result.difference > this.CHARGE_TOLERANCE) {
                result.errors.push(`Charge mismatch: stored=${result.storedCharge}, dynamic=${result.dynamicCharge}, difference=${result.difference}`);
            }

            // Validate basic fields match (these should already match since they're from the same stock record)
            if (stock.party.toString() !== dynamicChargeData.party.toString()) {
                result.errors.push('Party mismatch between stored and dynamic charge');
            }

            if (stock.item.toString() !== dynamicChargeData.item.toString()) {
                result.errors.push('Item mismatch between stored and dynamic charge');
            }

            if (stock.unit.toString() !== dynamicChargeData.unit.toString()) {
                result.errors.push('Unit mismatch between stored and dynamic charge');
            }

            if (stock.chargeable !== dynamicChargeData.chargeable) {
                result.errors.push('Chargeable flag mismatch between stored and dynamic charge');
            }

            // Validate anchor date if present
            if (stock.anchorDate && dynamicChargeData.anchorDate) {
                const storedAnchorTime = new Date(stock.anchorDate).getTime();
                const dynamicAnchorTime = new Date(dynamicChargeData.anchorDate).getTime();
                if (storedAnchorTime !== dynamicAnchorTime) {
                    result.errors.push('Anchor date mismatch between stored and dynamic charge');
                }
            }

            result.isValid = result.errors.length === 0;

        } catch (error) {
            result.errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
        }

        return result;
    }

    /**
     * Validate charge calculations for multiple lots
     */
    static async validateLots(lotNumbers: string[]): Promise<ValidationSummary> {
        const summary: ValidationSummary = {
            total: lotNumbers.length,
            valid: 0,
            invalid: 0,
            validationPercentage: 0,
            results: [],
            startTime: new Date()
        };


        try {
            for (let i = 0; i < lotNumbers.length; i++) {
                const lotNumber = lotNumbers[i];

                try {
                    const result = await this.validateLot(lotNumber);
                    summary.results.push(result);

                    if (result.isValid) {
                        summary.valid++;
                    } else {
                        summary.invalid++;
                    }

                    // Progress reporting
                    if ((i + 1) % this.VALIDATION_BATCH_SIZE === 0) {
                        const percentage = ((i + 1) / lotNumbers.length * 100).toFixed(1);
                    }

                } catch (error) {
                    summary.invalid++;
                    summary.results.push({
                        lotNumber,
                        isValid: false,
                        errors: [`Validation error: ${error instanceof Error ? error.message : String(error)}`]
                    });
                }
            }

            summary.validationPercentage = summary.total > 0 ? (summary.valid / summary.total) * 100 : 100;
            summary.endTime = new Date();
            summary.duration = summary.endTime.getTime() - summary.startTime.getTime();


        } catch (error) {
            summary.endTime = new Date();
            summary.duration = summary.endTime.getTime() - summary.startTime.getTime();
            console.error('Validation failed with error:', error);
            throw error;
        }

        return summary;
    }

    /**
     * Validate all charge records in the system
     */
    static async validateAllCharges(): Promise<ValidationSummary> {
        try {
            const allChargeLots = await Stock.distinct('lotNumber', { chargeCalculated: true });
            return await this.validateLots(allChargeLots);
        } catch (error) {
            console.error('Error validating all charges:', error);
            throw error;
        }
    }

    /**
     * Check data consistency between Stock and Charge collections
     */
    static async checkDataConsistency(): Promise<ConsistencyCheckResult> {
        try {

            // Get all lot numbers from stock collection
            const stockLots = await Stock.distinct('lotNumber');
            const chargeLots = await Stock.distinct('lotNumber', { chargeCalculated: true });
            const chargeableStockLots = await Stock.distinct('lotNumber', { chargeable: true });
            const nonChargeableStockLots = await Stock.distinct('lotNumber', { chargeable: false });

            // Find inconsistencies
            const stockWithoutCharges = chargeableStockLots.filter((lot: string) => !chargeLots.includes(lot));
            const chargesWithoutStock = chargeLots.filter((lot: string) => !stockLots.includes(lot));
            const nonChargeableWithCharges = chargeLots.filter((lot: string) => nonChargeableStockLots.includes(lot));
            const chargeableWithoutCharges = chargeableStockLots.filter((lot: string) => !chargeLots.includes(lot));

            const result: ConsistencyCheckResult = {
                stockWithoutCharges,
                chargesWithoutStock,
                nonChargeableWithCharges,
                chargeableWithoutCharges
            };


            return result;

        } catch (error) {
            console.error('Error checking data consistency:', error);
            throw error;
        }
    }

    /**
     * Clean up orphaned and invalid charge records
     */
    static async cleanupChargeData(): Promise<CleanupResult> {
        const result: CleanupResult = {
            orphanedChargesRemoved: 0,
            invalidChargesRemoved: 0,
            inconsistentChargesFixed: 0,
            errors: []
        };

        try {

            // Check data consistency first
            const consistency = await this.checkDataConsistency();

            // Remove orphaned charges (charges without stock records)
            if (consistency.chargesWithoutStock.length > 0) {

                // Since charges are now part of stock, orphaned charges shouldn't exist
                // This section is kept for compatibility but should not find any records
                const orphanedResult = { deletedCount: 0 };

                result.orphanedChargesRemoved = orphanedResult.deletedCount || 0;
            }

            // Remove charges for non-chargeable lots
            if (consistency.nonChargeableWithCharges.length > 0) {

                const invalidResult = await Stock.updateMany(
                    {
                        lotNumber: { $in: consistency.nonChargeableWithCharges },
                        chargeable: false
                    },
                    {
                        $unset: {
                            totalCharge: 1,
                            anchorDate: 1,
                            anniversaryDay: 1,
                            firstMonth: 1,

                            lastCalculatedAt: 1
                        },
                        chargeCalculated: false
                    }
                );

                result.invalidChargesRemoved = invalidResult.deletedCount || 0;
            }

            // Fix inconsistent charges by recalculating
            if (consistency.chargeableWithoutCharges.length > 0) {

                for (const lotNumber of consistency.chargeableWithoutCharges) {
                    try {
                        await ChargeService.calculateAndStore(lotNumber);
                        result.inconsistentChargesFixed++;
                    } catch (error) {
                        result.errors.push({
                            lotNumber,
                            error: error instanceof Error ? error.message : String(error)
                        });
                    }
                }

            }


        } catch (error) {
            console.error('Error during charge data cleanup:', error);
            throw error;
        }

        return result;
    }

    /**
     * Recalculate and fix charges that fail validation
     */
    static async fixInvalidCharges(validationResults: ValidationResult[]): Promise<{
        fixed: number;
        failed: number;
        errors: Array<{ lotNumber: string; error: string }>;
    }> {
        const invalidResults = validationResults.filter(r => !r.isValid);
        const fixResult = {
            fixed: 0,
            failed: 0,
            errors: [] as Array<{ lotNumber: string; error: string }>
        };


        for (const result of invalidResults) {
            try {
                await ChargeService.calculateAndStore(result.lotNumber);
                fixResult.fixed++;
            } catch (error) {
                fixResult.failed++;
                fixResult.errors.push({
                    lotNumber: result.lotNumber,
                    error: error instanceof Error ? error.message : String(error)
                });
                console.error(`Failed to fix charge record for lot ${result.lotNumber}:`, error);
            }
        }

        return fixResult;
    }

    /**
     * Get validation statistics for the system
     */
    static async getValidationStats(): Promise<{
        totalCharges: number;
        totalStock: number;
        chargeableStock: number;
        consistencyPercentage: number;
        lastValidationRun?: Date;
    }> {
        try {
            const totalCharges = await Stock.countDocuments({ chargeCalculated: true });
            const totalStock = await Stock.countDocuments();
            const chargeableStock = await Stock.countDocuments({ chargeable: true });

            const consistencyPercentage = chargeableStock > 0 ? (totalCharges / chargeableStock) * 100 : 100;

            return {
                totalCharges,
                totalStock,
                chargeableStock,
                consistencyPercentage: Math.round(consistencyPercentage * 100) / 100
            };
        } catch (error) {
            console.error('Error getting validation stats:', error);
            throw error;
        }
    }
}