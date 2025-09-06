import mongoose from 'mongoose';

const ContactSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: false, trim: true, default: '' },
    countryCode: { type: String, required: true, default: '+1' },
    phoneNumber: { type: String, required: true, trim: true },
    linkedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// Prevent duplicates per owner
ContactSchema.index({ owner: 1, phoneNumber: 1 }, { unique: true });

export const Contact = mongoose.model('Contact', ContactSchema);
