import mongoose from 'mongoose';
import { setupEncryption } from '../utils/encryptionMiddleware.js';

const companySchema = new mongoose.Schema(
  {
    warehouseName: { type: String, required: true, encrypted: true },
    ownerName: { type: String, required: true, encrypted: true },
    contactNos: { type: [String], required: true, encrypted: true },
    email: { type: String, required: true, encrypted: true },
    address: { type: String, required: true, encrypted: true },
    gstNo: { type: String, required: true, encrypted: true },
    panNo: { type: String, required: true, encrypted: true },
  },
  { timestamps: true }
);

setupEncryption(companySchema);

// Avoid OverwriteModelError in dev/hot-reload
export const Company =
  mongoose.models.Company || mongoose.model('Company', companySchema);

export default Company;
