import mongoose from 'mongoose';
import { setupEncryption } from '../utils/encryptionMiddleware.js';

const paymentSchema = new mongoose.Schema(
    {
        paymentNumber: { type: String, required: true, unique: true },
        paymentFor: { type: String, enum: ['bill_payment', 'rent'], default: 'bill_payment', required: true },
        bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' },
        party: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
        amount: { type: Number, required: true, min: 0 },
        paymentMethod: {
            type: String,
            enum: ['cash', 'bank'],
            required: true
        },
        paymentDate: { type: Date, required: true },
        financialYear: { type: Number },
        quarter: { type: String, enum: ['Q1', 'Q2', 'Q3', 'Q4'] },
        description: { type: String, trim: true },
        bankDetails: {
            bankName: { type: String },
            accountNumber: { type: String, encrypted: true }
        },
        notes: { type: String }
    },
    { timestamps: true }
);

setupEncryption(paymentSchema);

export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
export default Payment;
