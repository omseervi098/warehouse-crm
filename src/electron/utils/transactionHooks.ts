import { ChargeService } from './chargeService.js';

/**
 * Transaction change handler that triggers charge recalculation
 * This function is called whenever a transaction is created, updated, or deleted
 * Errors are logged but not thrown to avoid blocking transaction operations
 */
export async function onTransactionChange(lotNumber: string): Promise<void> {
    try {
        console.log(`Transaction change detected for lot: ${lotNumber}, triggering charge recalculation`);
        const result = await ChargeService.recalculateForLot(lotNumber);

        if (result) {
            console.log(`Charge recalculation completed successfully for lot: ${lotNumber}`);
        } else {
            console.warn(`Charge recalculation returned null for lot: ${lotNumber} (may be non-chargeable or failed)`);
        }
    } catch (error) {
        // Log error but don't throw to avoid blocking transaction operations
        console.error(`Critical error in charge recalculation for lot ${lotNumber}:`, error);

        // In a production system, you might want to:
        // 1. Add to a retry queue
        // 2. Send alerts to administrators
        // 3. Mark the charge record as needing recalculation
    }
}

/**
 * Handle batch transaction operations that affect multiple lots
 * This function processes multiple lot numbers and triggers charge recalculation for each
 */
export async function onBatchTransactionChange(lotNumbers: string[]): Promise<void> {
    const uniqueLotNumbers = [...new Set(lotNumbers)];

    console.log(`Batch transaction change detected for ${uniqueLotNumbers.length} lots, triggering charge recalculation`);

    // Process lots in parallel for better performance
    const promises = uniqueLotNumbers.map(async (lotNumber) => {
        try {
            await ChargeService.recalculateForLot(lotNumber);
            console.log(`Charge recalculation completed for lot: ${lotNumber}`);
        } catch (error) {
            // Log error but don't throw to avoid blocking other lot calculations
            console.error(`Error recalculating charges for lot ${lotNumber}:`, error);
        }
    });

    await Promise.allSettled(promises);
    console.log(`Batch charge recalculation completed for ${uniqueLotNumbers.length} lots`);
}

/**
 * Setup mongoose middleware hooks for transaction model
 * These hooks provide additional safety in case transactions are modified outside of the main API handlers
 */
export function setupTransactionHooks(transactionModel: any): void {
    try {
        // Get the actual mongoose schema from the model
        const schema = transactionModel.schema;

        if (!schema) {
            console.error('Transaction model does not have a schema property');
            return;
        }

        // Hook for new transaction creation
        schema.post('save', async function (doc: any) {
            if (doc.lotNumber) {
                await onTransactionChange(doc.lotNumber);
            }
        });

        // Hook for transaction updates
        schema.post('findOneAndUpdate', async function (doc: any) {
            if (doc && doc.lotNumber) {
                await onTransactionChange(doc.lotNumber);
            }
        });

        // Hook for transaction deletion
        schema.post('findOneAndDelete', async function (doc: any) {
            if (doc && doc.lotNumber) {
                await onTransactionChange(doc.lotNumber);
            }
        });

        // Hook for bulk operations
        schema.post('deleteMany', async function () {
            // For bulk operations, we need to get the affected lot numbers before deletion
            // This is handled in the main API handlers where we have more control
            console.log('Bulk transaction deletion detected, charge recalculation should be handled by API layer');
        });

        console.log('Transaction hooks setup completed');
    } catch (error) {
        console.error('Error setting up transaction hooks:', error);
        console.log('Transaction hooks will be disabled, charge updates will rely on API-level triggers');
    }
}