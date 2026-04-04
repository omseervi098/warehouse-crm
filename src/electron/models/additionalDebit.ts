import mongoose from 'mongoose';

const additionalDebitSchema = new mongoose.Schema(
    {
        party: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
        periodType: { type: String, enum: ['monthly', 'quarterly'], required: true },
        description: { type: String, required: true, trim: true },
        amount: { type: Number, required: true, min: 0 },
        debitDate: { type: Date, required: true },
    },
    { timestamps: true }
);

export const AdditionalDebit = mongoose.models.AdditionalDebit || mongoose.model('AdditionalDebit', additionalDebitSchema);
export default AdditionalDebit;
