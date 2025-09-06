import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', index: true, required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, default: '' },
    // future: attachments, status
  },
  { timestamps: true }
);

MessageSchema.index({ conversation: 1, createdAt: 1 });

export const Message = mongoose.model('Message', MessageSchema);
