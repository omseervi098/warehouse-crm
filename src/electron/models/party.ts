import mongoose from 'mongoose';
import { setupEncryption } from '../utils/encryptionMiddleware.js';

const partySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, encrypted: true },
    contactNos: { type: [String], required: true, encrypted: true },
    businessContactEmail: { type: String, required: true, encrypted: true },
    orgEmail: { type: String, required: true, encrypted: true },
    address: { type: String, required: true, encrypted: true },
    gstNo: { type: String, required: true, encrypted: true },
    panNo: { type: String, required: true, encrypted: true },
  },
  { timestamps: true }
);

// Apply encryption middleware to the schema
setupEncryption(partySchema);

export const Party = mongoose.models.Party || mongoose.model('Party', partySchema);
export default Party;
