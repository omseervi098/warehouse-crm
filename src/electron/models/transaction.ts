import mongoose from 'mongoose';

const filterable = ["type", "party", "item", "unit", "warehouse"];
const searchable = ["lotNumber", "vehicleNumber", "doNumber", "remark"];
const rangeFilterable = ["enteredAt"];

const transactionSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true },
    type: { type: String, required: true, enum: ["INWARD", "OUTWARD", "RETURN"] },
    enteredAt: { type: Date, required: true },
    party: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    lotNumber: { type: String, required: true },
    vehicleNumber: { type: String, required: true },
    doNumber: { type: String, required: function (this: { type: string }) { return this.type === 'OUTWARD' || this.type === 'RETURN'; } },
    quantity: { type: Number, required: true, min: 0 },
    shortage: { type: Number, default: 0, min: 0 },
    extra: { type: Number, default: 0, min: 0 },
    unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
    warehouses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true }],
    charge: { type: Boolean, required: true, default: true },
    remark: { type: String, default: '' },
  },
  { timestamps: true }
);

(transactionSchema.statics as any).getFilterableFields = function (): string[] { return [...filterable]; };
(transactionSchema.statics as any).getSearchableFields = function (): string[] { return [...searchable]; };
(transactionSchema.statics as any).getRangeFilterableFields = function (): string[] { return [...rangeFilterable]; };

export const Transaction = (mongoose.models.Transaction as any) || (mongoose.model('Transaction', transactionSchema) as mongoose.Model<any> & {
  getFilterableFields(): string[];
  getSearchableFields(): string[];
  getRangeFilterableFields(): string[];
});

// Setup transaction hooks for automatic charge updates removed to prevent race conditions
// Charge updates are now handled in the recalculateStock function

export default Transaction;
