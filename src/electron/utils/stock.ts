import mongoose from 'mongoose';
import Stock from '../models/stock.js';
import Transaction from '../models/transaction.js';
import Unit from '../models/unit.js';
import { ChargeService } from './chargeService.js';

export const recalculateStock = async (lotNumber: string) => {
  try {
    const transactions = await Transaction.find({ lotNumber }).sort({ enteredAt: 1 }).exec();

    if (transactions.length === 0) {
      await Stock.deleteOne({ lotNumber });
      return;
    }

    const quantity = transactions.reduce((acc: number, t: any) => {
      if (t.type === 'INWARD' || t.type === 'RETURN') return acc + t.quantity;
      return acc - t.quantity; // OUTWARD
    }, 0);

    const earliestEntryAt = transactions.reduce(
      (earliest: Date, t: any) => (t.enteredAt < earliest ? t.enteredAt : earliest),
      transactions[0].enteredAt
    );
    const latestEntryAt = transactions.reduce(
      (latest: Date, t: any) => (t.enteredAt > latest ? t.enteredAt : latest),
      transactions[0].enteredAt
    );

    const inwardDates = transactions
      .filter((t: any) => t.type === 'INWARD')
      .map((t: any) => new Date(t.enteredAt).toISOString().split('T')[0]);
    const uniqueInwardDates = [...new Set(inwardDates)];

    const warehouses = [
      ...new Set<string>(
        transactions.flatMap((t: any) => t.warehouses.map((w: any) => w.toString() as string))
      ),
    ].map((id: string) => new mongoose.Types.ObjectId(id));

    const firstTransaction = transactions[0];
    const existingStock = await Stock.findOne({ lotNumber }).select('chargeRate').lean();
    let chargeRate = existingStock?.chargeRate;

    if (typeof chargeRate !== 'number') {
      const unit = await Unit.findById(firstTransaction.unit).select('rate').lean<{ rate?: number }>();
      chargeRate = unit?.rate ?? 0;
    }

    const stockData: any = {
      party: firstTransaction.party,
      item: firstTransaction.item,
      lotNumber,
      quantity,
      isNil: quantity === 0,
      inwardDates: uniqueInwardDates,
      chargeable: firstTransaction.charge,
      unit: firstTransaction.unit,
      warehouses,
      earliestEntryAt,
      latestEntryAt,
      chargeRate,
      transactions: transactions.map((t: any) => t._id),
    };

    await Stock.findOneAndUpdate(
      { lotNumber },
      stockData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Trigger charge calculation immediately after stock update
    await ChargeService.recalculateForLot(lotNumber);
  } catch (error) {
    console.error(`Error recalculating stock for lot number ${lotNumber}:`, error);
    throw error;
  }
};
