import mongoose from 'mongoose';

const warehouseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
  },
  { timestamps: true }
);

export const Warehouse = mongoose.models.Warehouse || mongoose.model('Warehouse', warehouseSchema);
export default Warehouse;
