import mongoose from 'mongoose';

const unitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    rate: { type: Number, required: true },
  },
  { timestamps: true }
);

export const Unit = mongoose.models.Unit || mongoose.model('Unit', unitSchema);
export default Unit;
