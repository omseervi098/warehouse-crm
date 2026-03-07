import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
    {
        paymentNumber: { type: String, required: true, unique: true },
        bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', required: true },
        party: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
        amount: { type: Number, required: true, min: 0 },
        paymentMethod: {
            type: String,
            enum: ['cash', 'cheque', 'bank_transfer'],
            required: true
        },
        paymentDate: { type: Date, required: true },
        bankDetails: {
            bankName: { type: String },
            accountNumber: { type: String },
            chequeNumber: { type: String },
            transactionId: { type: String }
        },
        notes: { type: String }
    },
    { timestamps: true }
);


export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
export default Payment;