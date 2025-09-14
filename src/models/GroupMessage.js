import mongoose from 'mongoose';

const GroupMessageSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, trim: true, default: '' },
    attachments: { type: [Object], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

GroupMessageSchema.index({ group: 1, createdAt: -1 });

export const GroupMessage = mongoose.model('GroupMessage', GroupMessageSchema);
