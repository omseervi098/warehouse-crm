import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
  },
  { timestamps: true }
);

export const Item = mongoose.models.Item || mongoose.model('Item', itemSchema);
export default Item;
