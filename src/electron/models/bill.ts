import mongoose from 'mongoose';

const billSchema = new mongoose.Schema(
    {
        billNumber: { type: String, required: true, unique: true },
        party: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
        quarter: { type: String, enum: ['Q1', 'Q2', 'Q3', 'Q4'], required: true },
        year: { type: Number, required: true },
        amount: { type: Number, required: true, min: 0 },
        billDate: { type: Date, required: true },
        status: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
        paidAmount: { type: Number, default: 0, min: 0 },
        outstandingAmount: { type: Number, required: true, min: 0 },
        description: { type: String },
        pdfPath: { type: String },
        isSplit: { type: Boolean, default: false },
        particulars: { type: String }
    },
    { timestamps: true }
);


export const Bill = mongoose.models.Bill || mongoose.model('Bill', billSchema);
export default Bill;