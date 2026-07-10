import mongoose from 'mongoose';

import Stock from '../models/stock.js';
import { computeChargesForLot } from './charge.js';

// Configuration for retry logic
const RETRY_CONFIG = {
    maxRetries: 3,
    retryDelay: 1000, // 1 second
    backoffMultiplier: 2
};

// Configuration for batch processing
const BATCH_CONFIG = {
    defaultBatchSize: 50,
    maxBatchSize: 200,
    defaultPageSize: 100,
    maxPageSize: 1000,
    backgroundProcessingDelay: 100 // ms between batch operations
};

export interface ChargeRecord {
    _id?: mongoose.Types.ObjectId;
    lotNumber: string;
    party: mongoose.Types.ObjectId;
    item: mongoose.Types.ObjectId;
    unit: mongoose.Types.ObjectId;
    inwardDates: string[];
    chargeable: boolean;
    warehouses: mongoose.Types.ObjectId[];
    quantity: number;
    earliestEntryAt: Date;
    latestEntryAt: Date;
    isNil: boolean;
    totalCharge: number;
    chargeRate?: number;
    anchorDate?: Date;
    anniversaryDay?: number;
    firstMonth: {
        day1?: {
            date: Date;
            balance: number;
            amount: number;
        };
        day2?: {
            date: Date;
            balance: number;
            amount: number;
        };
        combined: number;
    };
    lastCalculatedAt: Date;
    isActive: boolean;
}

export interface PartyChargesSummary {
    party: mongoose.Types.ObjectId;
    totalCharges: number;
    lotCount: number;
    lastUpdated: Date;
    lots: Array<{
        lotNumber: string;
        totalCharge: number;
        lastCalculated: Date;
    }>;
}

export interface BatchProcessingResult {
    totalProcessed: number;
    successful: number;
    failed: number;
    errors: Array<{
        lotNumber: string;
        error: string;
    }>;
    duration: number;
}

export interface PaginationOptions {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export class ChargeService {
    /**
     * Sleep utility for retry delays
     */
    private static async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Retry wrapper for charge calculation operations
     */
    private static async withRetry<T>(
        operation: () => Promise<T>,
        lotNumber: string,
        operationName: string
    ): Promise<T> {
        let lastError: Error;

        for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;
                console.error(`${operationName} failed for lot ${lotNumber} (attempt ${attempt}/${RETRY_CONFIG.maxRetries}):`, error);

                if (attempt < RETRY_CONFIG.maxRetries) {
                    const delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1);
                    await this.sleep(delay);
                } else {
                    console.error(`${operationName} failed permanently for lot ${lotNumber} after ${RETRY_CONFIG.maxRetries} attempts`);
                }
            }
        }

        throw lastError!;
    }

    /**
     * Fallback to dynamic calculation when charge records are missing or invalid
     */
    static async fallbackToDynamicCalculation(lotNumber: string): Promise<any> {
        try {
            const stock = await Stock.findOne({ lotNumber }).lean();
            if (!stock) {
                throw new Error(`Stock record not found for lot: ${lotNumber}`);
            }

            const chargeData = await computeChargesForLot(stock, false);
            return chargeData;
        } catch (error) {
            console.error(`Dynamic calculation fallback failed for lot ${lotNumber}:`, error);
            throw error;
        }
    }

    /**
     * Check if a charge record is stale (calculated more than 24 hours ago)
     */
    static isStale(record: ChargeRecord): boolean {
        if (!record || !record.lastCalculatedAt) return true;
        const now = Date.now();
        const lastCalc = new Date(record.lastCalculatedAt).getTime();
        const diff = now - lastCalc;
        // 24 hours in milliseconds
        const STALE_THRESHOLD = 24 * 60 * 60 * 1000;
        return diff > STALE_THRESHOLD;
    }

    /**
     * Get charge record with fallback to dynamic calculation
     * Also checks for stale records and recalculates if necessary
     */
    static async getChargeWithFallback(lotNumber: string): Promise<any> {
        try {
            // First try to get stored charge record
            const storedCharge = await this.getByLotNumber(lotNumber);

            if (storedCharge) {
                // Check if the record is stale
                if (this.isStale(storedCharge)) {
                    // Recalculate and update asynchronously (don't block read if possible, 
                    // but for strict accuracy we might want to wait. 
                    // Given the user wants "automatic update", let's wait for it to ensure fresh data is returned.)
                    try {
                        const freshCharge = await this.calculateAndStore(lotNumber);
                        if (freshCharge) return freshCharge;
                    } catch (recalcError) {
                        console.error(`Failed to refresh stale charge for lot ${lotNumber}, returning stored value:`, recalcError);
                        // Fallback to stored value if recalculation fails
                        return storedCharge;
                    }
                }
                return storedCharge;
            }

            // If no stored charge, fall back to dynamic calculation
            // Also try to persist this dynamic calculation so next time it's fast
            try {
                // Fire and forget storage for next time
                this.calculateAndStore(lotNumber).catch(e => console.error(`Background store failed for ${lotNumber}`, e));
            } catch (ignore) { }

            return await this.fallbackToDynamicCalculation(lotNumber);
        } catch (error) {
            console.error(`Error getting charge with fallback for lot ${lotNumber}:`, error);
            throw error;
        }
    }

    /**
     * Calculate charges for a lot and store the result in the Charge collection
     * Uses the existing computeChargesForLot function for calculation
     */
    static async calculateAndStore(lotNumber: string): Promise<ChargeRecord | null> {
        return await this.withRetry(async () => {
            // Get the stock record for this lot
            const stock = await Stock.findOne({ lotNumber }).lean();
            if (!stock) {
                throw new Error(`Stock record not found for lot: ${lotNumber}`);
            }

            // Skip calculation if not chargeable
            if (!stock.chargeable) {
                // Reset charge fields for non-chargeable lots
                await Stock.findOneAndUpdate(
                    { lotNumber },
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
                return null;
            }

            // Calculate charges using existing logic
            const chargeData = await computeChargesForLot(stock, false);

            // Prepare charge data to update in Stock record
            const chargeFields = {
                totalCharge: chargeData.totalCharge,
                chargeRate: chargeData.chargeRate,
                anchorDate: chargeData.anchorDate,
                anniversaryDay: chargeData.anniversaryDay,
                firstMonth: chargeData.firstMonth,
                lastCalculatedAt: new Date(),
                chargeCalculated: true
            };

            // Update the Stock record with charge data
            const result = await Stock.findOneAndUpdate(
                { lotNumber },
                { $set: chargeFields },
                { new: true }
            );

            return result.toObject();
        }, lotNumber, 'Charge calculation and storage');
    }

    /**
     * Get charge record by lot number
     */
    static async getByLotNumber(lotNumber: string): Promise<ChargeRecord | null> {
        try {
            const stock = await Stock.findOne({ lotNumber, chargeCalculated: true }).lean();
            return stock;
        } catch (error) {
            console.error(`Error getting charge for lot ${lotNumber}:`, error);
            throw error;
        }
    }

    /**
     * Get all charge records for a specific party
     */
    static async getByParty(partyId: string): Promise<ChargeRecord[]> {
        try {
            // Validate partyId parameter
            if (!partyId || typeof partyId !== 'string') {
                throw new Error(`Invalid partyId: expected string, got ${typeof partyId}`);
            }

            // Validate ObjectId format
            if (!mongoose.Types.ObjectId.isValid(partyId)) {
                throw new Error(`Invalid ObjectId format: ${partyId}`);
            }

            // Use simple query with populate - only nil stock for billing
            const stocks = await Stock.find({
                party: new mongoose.Types.ObjectId(partyId),
                chargeCalculated: true,
                isNil: true,
                chargeable: true
            }).populate('party', 'name').lean();

            return stocks;
        } catch (error) {
            console.error(`Error getting charges for party ${partyId}:`, error);
            throw error;
        }
    }

    /**
     * Recalculate charges for a specific lot
     * This method is called when transactions change for a lot
     * Errors are logged but not thrown to avoid blocking transaction operations
     */
    static async recalculateForLot(lotNumber: string): Promise<ChargeRecord | null> {
        try {
            return await this.calculateAndStore(lotNumber);
        } catch (error) {
            // Log error but don't throw to avoid blocking transaction operations
            console.error(`Error recalculating charges for lot ${lotNumber}:`, error);

            // Optionally, you could add the failed lot to a retry queue here
            // For now, we just log and continue
            return null;
        }
    }

    /**
     * Aggregate charges for a single party
     * Returns summary with total charges, lot count, and individual lot details
     */
    static async aggregateByParty(partyId: string): Promise<PartyChargesSummary | null> {
        try {
            // Validate partyId parameter
            if (!partyId || typeof partyId !== 'string') {
                throw new Error(`Invalid partyId: expected string, got ${typeof partyId}`);
            }

            // Validate ObjectId format
            if (!mongoose.Types.ObjectId.isValid(partyId)) {
                throw new Error(`Invalid ObjectId format: ${partyId}`);
            }

            // Use simple query - only nil stock for billing
            const stocks = await Stock.find({
                party: new mongoose.Types.ObjectId(partyId),
                chargeCalculated: true,
                isNil: true,
                chargeable: true
            }).lean();

            if (stocks.length === 0) {
                return null;
            }

            const totalCharges = stocks.reduce((sum: number, stock: any) => sum + (stock.totalCharge || 0), 0);
            const lotCount = stocks.length;
            const lastUpdated = stocks.reduce((latest: Date, stock: any) => {
                return stock.lastCalculatedAt > latest ? stock.lastCalculatedAt : latest;
            }, new Date(0));

            const lots = stocks.map((stock: any) => ({
                lotNumber: stock.lotNumber,
                totalCharge: stock.totalCharge || 0,
                lastCalculated: stock.lastCalculatedAt
            }));

            return {
                party: new mongoose.Types.ObjectId(partyId),
                totalCharges,
                lotCount,
                lastUpdated,
                lots
            };
        } catch (error) {
            console.error(`Error aggregating charges for party ${partyId}:`, error);
            throw error;
        }
    }

    /**
     * Aggregate charges for all parties in the system
     * Returns array of party charge summaries
     */
    static async aggregateAllParties(): Promise<PartyChargesSummary[]> {
        try {
            // Use MongoDB aggregation pipeline with lookup to handle encrypted party field
            // Only include nil stock (isNil: true) for billing
            const aggregationResult = await Stock.aggregate([
                {
                    $match: {
                        chargeCalculated: true,
                        isNil: true,
                        chargeable: true
                    }
                },
                {
                    $lookup: {
                        from: 'parties',
                        localField: 'party',
                        foreignField: '_id',
                        as: 'partyData'
                    }
                },
                {
                    $unwind: '$partyData'
                },
                {
                    $group: {
                        _id: '$partyData._id',
                        totalCharges: { $sum: '$totalCharge' },
                        lotCount: { $sum: 1 },
                        lastUpdated: { $max: '$lastCalculatedAt' },
                        lots: {
                            $push: {
                                lotNumber: '$lotNumber',
                                totalCharge: '$totalCharge',
                                lastCalculated: '$lastCalculatedAt'
                            }
                        }
                    }
                },
                {
                    $project: {
                        party: '$_id',
                        totalCharges: 1,
                        lotCount: 1,
                        lastUpdated: 1,
                        lots: 1,
                        _id: 0
                    }
                },
                {
                    $sort: { totalCharges: -1 }
                }
            ]);

            return aggregationResult.map((result: any) => ({
                party: result.party,
                totalCharges: result.totalCharges,
                lotCount: result.lotCount,
                lastUpdated: result.lastUpdated,
                lots: result.lots
            }));
        } catch (error) {
            console.error('Error aggregating charges for all parties:', error);
            throw error;
        }
    }

    /**
     * Validate charge record against dynamic calculation
     * Used for data consistency checks
     */
    static async validateChargeRecord(lotNumber: string): Promise<boolean> {
        try {
            const storedCharge = await this.getByLotNumber(lotNumber);
            if (!storedCharge) {
                console.warn(`No stored charge record found for lot: ${lotNumber}`);
                return false;
            }

            const dynamicCharge = await this.fallbackToDynamicCalculation(lotNumber);

            // Compare total charges (allowing for small floating point differences)
            const tolerance = 0.01;
            const difference = Math.abs(storedCharge.totalCharge - dynamicCharge.totalCharge);

            if (difference > tolerance) {
                console.warn(`Charge mismatch for lot ${lotNumber}: stored=${storedCharge.totalCharge}, dynamic=${dynamicCharge.totalCharge}`);
                return false;
            }

            return true;
        } catch (error) {
            console.error(`Error validating charge record for lot ${lotNumber}:`, error);
            return false;
        }
    }

    /**
     * Mark charge record as needing recalculation
     * Used when calculation fails but we want to track it for later retry
     */
    static async markForRecalculation(lotNumber: string): Promise<void> {
        try {
            await Stock.findOneAndUpdate(
                { lotNumber },
                {
                    chargeCalculated: false,
                    lastCalculatedAt: new Date(),
                    // You could add a 'needsRecalculation' flag here if needed
                },
                { upsert: false }
            );
        } catch (error) {
            console.error(`Error marking charge record for recalculation for lot ${lotNumber}:`, error);
        }
    }

    /**
     * Clean up orphaned charge records (charges for lots that no longer exist)
     * Since charges are now part of Stock records, this method resets charge fields for non-chargeable lots
     */
    static async cleanupOrphanedCharges(): Promise<number> {
        try {
            // Find Stock records that have charge data but are not chargeable
            const result = await Stock.updateMany(
                {
                    chargeable: false,
                    chargeCalculated: true
                },
                {
                    $unset: {
                        totalCharge: 1,
                        anchorDate: 1,
                        anniversaryDay: 1,
                        firstMonth: 1,
                        monthlyCharges: 1,
                        lastCalculatedAt: 1
                    },
                    chargeCalculated: false
                }
            );

            return result.modifiedCount || 0;
        } catch (error) {
            console.error('Error cleaning up orphaned charge records:', error);
            throw error;
        }
    }

    /**
     * Batch update functionality for processing multiple charge calculations
     * Processes lots in batches to avoid overwhelming the system
     */
    static async batchUpdateCharges(
        lotNumbers: string[],
        batchSize: number = BATCH_CONFIG.defaultBatchSize
    ): Promise<BatchProcessingResult> {
        const startTime = Date.now();
        const result: BatchProcessingResult = {
            totalProcessed: 0,
            successful: 0,
            failed: 0,
            errors: [],
            duration: 0
        };

        // Validate batch size
        const effectiveBatchSize = Math.min(batchSize, BATCH_CONFIG.maxBatchSize);


        // Process lots in batches
        for (let i = 0; i < lotNumbers.length; i += effectiveBatchSize) {
            const batch = lotNumbers.slice(i, i + effectiveBatchSize);

            // Process batch concurrently but with limited concurrency
            const batchPromises = batch.map(async (lotNumber) => {
                try {
                    await this.calculateAndStore(lotNumber);
                    result.successful++;
                } catch (error) {
                    result.failed++;
                    result.errors.push({
                        lotNumber,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    console.error(`Failed to update charges for lot ${lotNumber}:`, error);
                }
                result.totalProcessed++;
            });

            await Promise.all(batchPromises);

            // Add small delay between batches to prevent overwhelming the system
            if (i + effectiveBatchSize < lotNumbers.length) {
                await this.sleep(BATCH_CONFIG.backgroundProcessingDelay);
            }
        }

        result.duration = Date.now() - startTime;

        return result;
    }

    /**
     * Background processing for charge updates during high-volume periods
     * Processes charges with lower priority to avoid blocking critical operations
     */
    static async backgroundUpdateCharges(
        lotNumbers: string[],
        options: { batchSize?: number; delayBetweenBatches?: number } = {}
    ): Promise<BatchProcessingResult> {
        const batchSize = options.batchSize || Math.floor(BATCH_CONFIG.defaultBatchSize / 2);
        const delay = options.delayBetweenBatches || BATCH_CONFIG.backgroundProcessingDelay * 2;


        const startTime = Date.now();
        const result: BatchProcessingResult = {
            totalProcessed: 0,
            successful: 0,
            failed: 0,
            errors: [],
            duration: 0
        };

        // Process in smaller batches with longer delays for background processing
        for (let i = 0; i < lotNumbers.length; i += batchSize) {
            const batch = lotNumbers.slice(i, i + batchSize);

            // Process batch sequentially to minimize system impact
            for (const lotNumber of batch) {
                try {
                    await this.calculateAndStore(lotNumber);
                    result.successful++;
                } catch (error) {
                    result.failed++;
                    result.errors.push({
                        lotNumber,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    console.error(`Background update failed for lot ${lotNumber}:`, error);
                }
                result.totalProcessed++;

                // Small delay between individual operations
                await this.sleep(10);
            }

            // Longer delay between batches for background processing
            if (i + batchSize < lotNumbers.length) {
                await this.sleep(delay);
            }
        }

        result.duration = Date.now() - startTime;

        return result;
    }

    /**
     * Get charges by party with pagination support
     * Supports large datasets by returning paginated results
     */
    static async getByPartyPaginated(
        partyId: string,
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<ChargeRecord>> {
        try {
            const page = Math.max(1, options.page || 1);
            const limit = Math.min(options.limit || BATCH_CONFIG.defaultPageSize, BATCH_CONFIG.maxPageSize);
            const skip = (page - 1) * limit;

            // Build sort criteria
            const sortBy = options.sortBy || 'lastCalculatedAt';
            const sortOrder = options.sortOrder === 'asc' ? 1 : -1;

            // Use aggregation pipeline to handle encrypted party field
            // Only include nil stock (isNil: true) for billing
            const charges = await Stock.aggregate([
                {
                    $lookup: {
                        from: 'parties',
                        localField: 'party',
                        foreignField: '_id',
                        as: 'partyData'
                    }
                },
                {
                    $unwind: '$partyData'
                },
                {
                    $match: {
                        'partyData._id': new mongoose.Types.ObjectId(partyId),
                        chargeCalculated: true,
                        isNil: true,
                        chargeable: true
                    }
                },
                {
                    $sort: { [sortBy]: sortOrder }
                },
                {
                    $skip: skip
                },
                {
                    $limit: limit
                },
                {
                    $project: {
                        _id: 1,
                        lotNumber: 1,
                        party: '$partyData._id',
                        item: 1,
                        unit: 1,
                        inwardDates: 1,
                        chargeable: 1,
                        warehouses: 1,
                        quantity: 1,
                        earliestEntryAt: 1,
                        latestEntryAt: 1,
                        isNil: 1,
                        totalCharge: 1,
                        anchorDate: 1,
                        anniversaryDay: 1,
                        firstMonth: 1,
                        monthlyCharges: 1,
                        lastCalculatedAt: 1,
                        isActive: { $literal: true }
                    }
                }
            ]);

            // Get total count using separate aggregation
            const totalResult = await Stock.aggregate([
                {
                    $lookup: {
                        from: 'parties',
                        localField: 'party',
                        foreignField: '_id',
                        as: 'partyData'
                    }
                },
                {
                    $unwind: '$partyData'
                },
                {
                    $match: {
                        'partyData._id': new mongoose.Types.ObjectId(partyId),
                        chargeCalculated: true,
                        isNil: true,
                        chargeable: true
                    }
                },
                {
                    $count: 'total'
                }
            ]);

            const total = totalResult.length > 0 ? totalResult[0].total : 0;
            const pages = Math.ceil(total / limit);

            return {
                data: charges,
                pagination: {
                    page,
                    limit,
                    total,
                    pages,
                    hasNext: page < pages,
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            console.error(`Error getting paginated charges for party ${partyId}:`, error);
            throw error;
        }
    }

    /**
     * Aggregate charges for all parties with pagination support
     * Handles large datasets efficiently with pagination
     */
    static async aggregateAllPartiesPaginated(
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<PartyChargesSummary>> {
        try {
            const page = Math.max(1, options.page || 1);
            const limit = Math.min(options.limit || BATCH_CONFIG.defaultPageSize, BATCH_CONFIG.maxPageSize);
            const skip = (page - 1) * limit;

            // Build sort criteria for aggregation
            const sortBy = options.sortBy || 'totalCharges';
            const sortOrder = options.sortOrder === 'asc' ? 1 : -1;

            // Get total count of parties using aggregation with lookup
            const totalCountResult = await Stock.aggregate([
                {
                    $match: {
                        chargeCalculated: true,
                        isNil: true,
                        chargeable: true
                    }
                },
                {
                    $lookup: {
                        from: 'parties',
                        localField: 'party',
                        foreignField: '_id',
                        as: 'partyData'
                    }
                },
                {
                    $unwind: '$partyData'
                },
                {
                    $group: {
                        _id: '$partyData._id'
                    }
                },
                {
                    $count: 'total'
                }
            ]);

            const total = totalCountResult.length > 0 ? totalCountResult[0].total : 0;

            // Use MongoDB aggregation pipeline with pagination and lookup
            const aggregationResult = await Stock.aggregate([
                {
                    $match: {
                        chargeCalculated: true,
                        isNil: true,
                        chargeable: true
                    }
                },
                {
                    $lookup: {
                        from: 'parties',
                        localField: 'party',
                        foreignField: '_id',
                        as: 'partyData'
                    }
                },
                {
                    $unwind: '$partyData'
                },
                {
                    $group: {
                        _id: '$partyData._id',
                        totalCharges: { $sum: '$totalCharge' },
                        lotCount: { $sum: 1 },
                        lastUpdated: { $max: '$lastCalculatedAt' },
                        lots: {
                            $push: {
                                lotNumber: '$lotNumber',
                                totalCharge: '$totalCharge',
                                lastCalculated: '$lastCalculatedAt'
                            }
                        }
                    }
                },
                {
                    $project: {
                        party: '$_id',
                        totalCharges: 1,
                        lotCount: 1,
                        lastUpdated: 1,
                        lots: 1,
                        _id: 0
                    }
                },
                {
                    $sort: { [sortBy]: sortOrder }
                },
                {
                    $skip: skip
                },
                {
                    $limit: limit
                }
            ]);

            const data = aggregationResult.map((result: any) => ({
                party: result.party,
                totalCharges: result.totalCharges,
                lotCount: result.lotCount,
                lastUpdated: result.lastUpdated,
                lots: result.lots
            }));

            const pages = Math.ceil(total / limit);

            return {
                data,
                pagination: {
                    page,
                    limit,
                    total,
                    pages,
                    hasNext: page < pages,
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            console.error('Error getting paginated party aggregations:', error);
            throw error;
        }
    }

    /**
     * Get lots that need charge recalculation (for batch processing)
     * Returns lot numbers that have outdated or missing charge records
     */
    static async getLotsNeedingRecalculation(limit?: number): Promise<string[]> {
        try {
            // Get all chargeable lots from stock
            const chargeableLots = await Stock.find({ chargeable: true })
                .select('lotNumber chargeCalculated lastCalculatedAt updatedAt')
                .lean();

            const lotsNeedingUpdate: string[] = [];

            // Check each lot to see if it needs recalculation
            for (const stock of chargeableLots) {
                // Need recalculation if:
                // 1. No charge calculation exists (chargeCalculated is false)
                // 2. Charge calculation is older than stock record
                if (!stock.chargeCalculated ||
                    !stock.lastCalculatedAt ||
                    stock.lastCalculatedAt < stock.updatedAt) {
                    lotsNeedingUpdate.push(stock.lotNumber);

                    // Apply limit if specified
                    if (limit && lotsNeedingUpdate.length >= limit) {
                        break;
                    }
                }
            }

            return lotsNeedingUpdate;
        } catch (error) {
            console.error('Error getting lots needing recalculation:', error);
            throw error;
        }
    }
}
