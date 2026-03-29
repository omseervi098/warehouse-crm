
import Stock from '../models/stock.js';
import { computeChargesForLot } from './charge.js';

export interface MigrationResult {
    totalProcessed: number;
    successful: number;
    failed: number;
    skipped: number;
    errors: Array<{
        lotNumber: string;
        error: string;
    }>;
    duration: number;
}

/**
 * Migrate existing stock data to the new Charge collection
 * This will populate the Charge collection with pre-calculated charge data
 */
export async function migrateExistingCharges(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        errors: [],
        duration: 0
    };

    try {

        // Get all chargeable stock records
        const chargeableStocks = await Stock.find({ chargeable: true }).lean();

        // Process each stock record
        for (const stock of chargeableStocks) {
            result.totalProcessed++;

            try {
                // Check if charge data already exists in stock record
                if (stock.chargeCalculated) {
                    result.skipped++;
                    continue;
                }

                // Calculate charges using existing logic
                const chargeData = await computeChargesForLot(stock, false);

                // Prepare charge record data
                const chargeRecord = {
                    lotNumber: chargeData.lotNumber,
                    party: chargeData.party,
                    item: chargeData.item,
                    unit: chargeData.unit,
                    inwardDates: chargeData.inwardDates,
                    chargeable: chargeData.chargeable,
                    warehouses: chargeData.warehouses,
                    quantity: chargeData.quantity,
                    earliestEntryAt: chargeData.earliestEntryAt,
                    latestEntryAt: chargeData.latestEntryAt,
                    isNil: chargeData.isNil,
                    totalCharge: chargeData.totalCharge || chargeData.charge || 0,
                    anchorDate: chargeData.anchorDate,
                    anniversaryDay: chargeData.anniversaryDay,
                    firstMonth: chargeData.firstMonth,

                    lastCalculatedAt: new Date(),
                    isActive: true
                };

                // Update the stock record with charge data
                await Stock.findOneAndUpdate(
                    { lotNumber: stock.lotNumber },
                    {
                        $set: {
                            totalCharge: chargeRecord.totalCharge,
                            anchorDate: chargeRecord.anchorDate,
                            anniversaryDay: chargeRecord.anniversaryDay,
                            firstMonth: chargeRecord.firstMonth,

                            lastCalculatedAt: chargeRecord.lastCalculatedAt,
                            chargeCalculated: true
                        }
                    }
                );
                result.successful++;

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`Failed to migrate charges for lot ${stock.lotNumber}:`, error);
                result.failed++;
                result.errors.push({
                    lotNumber: stock.lotNumber,
                    error: errorMessage
                });
            }
        }

        result.duration = Date.now() - startTime;

        return result;

    } catch (error) {
        console.error('Migration failed:', error);
        result.duration = Date.now() - startTime;
        throw error;
    }
}

/**
 * Validate migrated data by comparing stored charges with dynamic calculations
 */
export async function validateMigratedCharges(sampleSize: number = 10): Promise<{
    validated: number;
    mismatches: Array<{
        lotNumber: string;
        storedCharge: number;
        dynamicCharge: number;
        difference: number;
    }>;
}> {

    const chargeRecords = await Stock.find({ chargeCalculated: true }).limit(sampleSize).lean();
    const mismatches: Array<{
        lotNumber: string;
        storedCharge: number;
        dynamicCharge: number;
        difference: number;
    }> = [];

    for (const chargeRecord of chargeRecords) {
        try {
            // Get the stock record
            const stock = await Stock.findOne({ lotNumber: chargeRecord.lotNumber }).lean();
            if (!stock) {
                console.warn(`Stock not found for lot: ${chargeRecord.lotNumber}`);
                continue;
            }

            // Calculate dynamic charge
            const dynamicCharge = await computeChargesForLot(stock, false);
            const dynamicTotal = dynamicCharge.totalCharge || dynamicCharge.charge || 0;
            const storedTotal = chargeRecord.totalCharge;

            // Compare with tolerance for floating point differences
            const tolerance = 0.01;
            const difference = Math.abs(storedTotal - dynamicTotal);

            if (difference > tolerance) {
                mismatches.push({
                    lotNumber: chargeRecord.lotNumber,
                    storedCharge: storedTotal,
                    dynamicCharge: dynamicTotal,
                    difference
                });
                console.warn(`Charge mismatch for lot ${chargeRecord.lotNumber}: stored=${storedTotal}, dynamic=${dynamicTotal}`);
            }

        } catch (error) {
            console.error(`Error validating lot ${chargeRecord.lotNumber}:`, error);
        }
    }


    return {
        validated: chargeRecords.length,
        mismatches
    };
}

/**
 * Clean up orphaned charge records (charges for lots that no longer exist)
 */
export async function cleanupOrphanedCharges(): Promise<number> {

    try {
        // Get all lot numbers with charge data
        const chargeLots = await Stock.distinct('lotNumber', { chargeCalculated: true });

        // Get all lot numbers from stock
        const stockLots = await Stock.distinct('lotNumber');

        // Find orphaned lot numbers
        const orphanedLots = chargeLots.filter((lot: string) => !stockLots.includes(lot));

        if (orphanedLots.length > 0) {

            // Since charges are now part of stock records, we don't need to delete separate records
            // This cleanup is no longer needed but kept for compatibility
            const result = { deletedCount: 0 };

            return result.deletedCount || 0;
        }

        return 0;

    } catch (error) {
        console.error('Error cleaning up orphaned charge records:', error);
        throw error;
    }
}
