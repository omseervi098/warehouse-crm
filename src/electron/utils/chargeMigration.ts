
import Stock from '../models/stock.js';
import { ChargeService } from './chargeService.js';

export interface MigrationProgress {
    total: number;
    processed: number;
    successful: number;
    failed: number;
    errors: Array<{
        lotNumber: string;
        error: string;
    }>;
    startTime: Date;
    endTime?: Date;
    duration?: number;
}

export interface MigrationOptions {
    batchSize?: number;
    skipExisting?: boolean;
    onProgress?: (progress: MigrationProgress) => void;
    onError?: (lotNumber: string, error: Error) => void;
}

export class ChargeMigrationService {
    private static readonly DEFAULT_BATCH_SIZE = 100;
    private static readonly PROGRESS_REPORT_INTERVAL = 50;

    /**
     * Migrate all chargeable lots from Stock collection to Charge collection
     */
    static async migrateAllChargeableStocks(options: MigrationOptions = {}): Promise<MigrationProgress> {
        const {
            batchSize = this.DEFAULT_BATCH_SIZE,
            skipExisting = true,
            onProgress,
            onError
        } = options;


        const progress: MigrationProgress = {
            total: 0,
            processed: 0,
            successful: 0,
            failed: 0,
            errors: [],
            startTime: new Date()
        };

        try {
            // Get total count of chargeable stocks
            const totalCount = await Stock.countDocuments({ chargeable: true });
            progress.total = totalCount;


            if (totalCount === 0) {
                progress.endTime = new Date();
                progress.duration = progress.endTime.getTime() - progress.startTime.getTime();
                return progress;
            }

            // Process in batches
            let skip = 0;
            while (skip < totalCount) {
                const stocks = await Stock.find({ chargeable: true })
                    .skip(skip)
                    .limit(batchSize)
                    .lean();

                for (const stock of stocks) {
                    try {
                        // Check if charge data already exists in stock record
                        if (skipExisting && stock.chargeCalculated) {
                            progress.processed++;
                            progress.successful++;
                            continue;
                        }

                        // Calculate and store charge
                        const chargeRecord = await ChargeService.calculateAndStore(stock.lotNumber);

                        if (chargeRecord) {
                            progress.successful++;
                        } else {
                            // This happens when lot is not chargeable (shouldn't occur due to filter)
                            progress.successful++;
                        }

                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        progress.failed++;
                        progress.errors.push({
                            lotNumber: stock.lotNumber,
                            error: errorMessage
                        });

                        console.error(`Failed to migrate charge for lot ${stock.lotNumber}:`, error);

                        if (onError) {
                            onError(stock.lotNumber, error as Error);
                        }
                    }

                    progress.processed++;

                    // Report progress periodically
                    if (progress.processed % this.PROGRESS_REPORT_INTERVAL === 0) {
                        const percentage = ((progress.processed / progress.total) * 100).toFixed(1);

                        if (onProgress) {
                            onProgress({ ...progress });
                        }
                    }
                }

                skip += batchSize;

                // Add small delay between batches to avoid overwhelming the database
                await this.sleep(100);
            }

            progress.endTime = new Date();
            progress.duration = progress.endTime.getTime() - progress.startTime.getTime();


            if (progress.errors.length > 0) {
                progress.errors.forEach(error => {
                });
            }

            return progress;

        } catch (error) {
            progress.endTime = new Date();
            progress.duration = progress.endTime.getTime() - progress.startTime.getTime();

            console.error('Migration failed with error:', error);
            throw error;
        }
    }

    /**
     * Migrate charges for specific lot numbers
     */
    static async migrateLots(lotNumbers: string[], options: MigrationOptions = {}): Promise<MigrationProgress> {
        const {
            skipExisting = true,
            onProgress,
            onError
        } = options;


        const progress: MigrationProgress = {
            total: lotNumbers.length,
            processed: 0,
            successful: 0,
            failed: 0,
            errors: [],
            startTime: new Date()
        };

        try {
            for (const lotNumber of lotNumbers) {
                try {
                    // Check if stock exists and is chargeable
                    const stock = await Stock.findOne({ lotNumber, chargeable: true }).lean();
                    if (!stock) {
                        progress.processed++;
                        progress.successful++;
                        continue;
                    }

                    // Check if charge data already exists in stock record
                    if (skipExisting) {
                        const stockRecord = await Stock.findOne({ lotNumber }).lean();
                        if (stockRecord?.chargeCalculated) {
                            progress.processed++;
                            progress.successful++;
                            continue;
                        }
                    }

                    // Calculate and store charge
                    const chargeRecord = await ChargeService.calculateAndStore(lotNumber);

                    if (chargeRecord) {
                        progress.successful++;
                    } else {
                        progress.successful++;
                    }

                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    progress.failed++;
                    progress.errors.push({
                        lotNumber,
                        error: errorMessage
                    });

                    console.error(`Failed to migrate charge for lot ${lotNumber}:`, error);

                    if (onError) {
                        onError(lotNumber, error as Error);
                    }
                }

                progress.processed++;

                if (onProgress) {
                    onProgress({ ...progress });
                }
            }

            progress.endTime = new Date();
            progress.duration = progress.endTime.getTime() - progress.startTime.getTime();


            return progress;

        } catch (error) {
            progress.endTime = new Date();
            progress.duration = progress.endTime.getTime() - progress.startTime.getTime();

            console.error('Lot-specific migration failed with error:', error);
            throw error;
        }
    }

    /**
     * Get migration status - check how many chargeable lots have charge records
     */
    static async getMigrationStatus(): Promise<{
        totalChargeableLots: number;
        migratedLots: number;
        pendingLots: number;
        migrationPercentage: number;
    }> {
        try {
            const totalChargeableLots = await Stock.countDocuments({ chargeable: true });
            const migratedLots = await Stock.countDocuments({ chargeCalculated: true });
            const pendingLots = Math.max(0, totalChargeableLots - migratedLots);
            const migrationPercentage = totalChargeableLots > 0 ? (migratedLots / totalChargeableLots) * 100 : 100;

            return {
                totalChargeableLots,
                migratedLots,
                pendingLots,
                migrationPercentage: Math.round(migrationPercentage * 100) / 100
            };
        } catch (error) {
            console.error('Error getting migration status:', error);
            throw error;
        }
    }

    /**
     * Find lots that need migration (chargeable stocks without charge records)
     */
    static async findPendingMigrations(): Promise<string[]> {
        try {
            // Get all chargeable lot numbers from stock
            const chargeableLots = await Stock.distinct('lotNumber', { chargeable: true });

            // Get all lot numbers that have charge data
            const migratedLots = await Stock.distinct('lotNumber', { chargeCalculated: true });

            // Find the difference
            const pendingLots = chargeableLots.filter((lot: string) => !migratedLots.includes(lot));

            return pendingLots;
        } catch (error) {
            console.error('Error finding pending migrations:', error);
            throw error;
        }
    }

    /**
     * Utility function for delays
     */
    private static async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}