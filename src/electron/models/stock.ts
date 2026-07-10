import mongoose from 'mongoose';

const filterable = ["party", "item", "unit", "warehouse", "chargeable", "isNil", "chargeCalculated"];
const searchable = ["lotNumber"];
const rangeFilterable = ["earliestEntryAt", "latestEntryAt", "lastCalculatedAt", "anchorDate", "nilStockDate"];

const stockSchema = new mongoose.Schema(
  {
    party: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
    isNil: { type: Boolean, default: false },
    nilStockDate: { type: Date },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    lotNumber: { type: String, required: true, unique: true },
    quantity: { type: Number, required: true, min: 0 },
    chargeable: { type: Boolean, default: false },
    unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
    warehouses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' }],
    earliestEntryAt: { type: Date, required: true },
    latestEntryAt: { type: Date, required: true },
    inwardDates: [{ type: String }],
    transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }],

    // Charge calculation results
    totalCharge: { type: Number, default: 0 },
    chargeRate: { type: Number },
    anchorDate: { type: Date },
    anniversaryDay: { type: Number },

    // First month charges
    firstMonth: {
      day1: {
        date: { type: Date },
        balance: { type: Number },
        amount: { type: Number }
      },
      day2: {
        date: { type: Date },
        balance: { type: Number },
        amount: { type: Number }
      },
      combined: { type: Number, default: 0 }
    },



    // Charge metadata
    lastCalculatedAt: { type: Date },
    chargeCalculated: { type: Boolean, default: false },

    // Billing fields
    billingStatus: { type: String, enum: ['unbilled', 'billed', 'partially_billed'], default: 'unbilled' },
    billedAmount: { type: Number },
    associatedBills: [{
      billId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' },
      billNumber: { type: String },
      amount: { type: Number },
      billedAt: { type: String }
    }]
  },
  { timestamps: true }
);


stockSchema.statics.getFilterableFields = function (): string[] {
  return [...filterable];
};
stockSchema.statics.getSearchableFields = function (): string[] {
  return [...searchable];
};
stockSchema.statics.getRangeFilterableFields = function (): string[] {
  return [...rangeFilterable];
};

export const Stock = (mongoose.models.Stock as any) || (mongoose.model('Stock', stockSchema) as mongoose.Model<any> & {
  getFilterableFields(): string[];
  getSearchableFields(): string[];
  getRangeFilterableFields(): string[];
});
export default Stock;
