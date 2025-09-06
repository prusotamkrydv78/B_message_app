import mongoose from 'mongoose';

const LastMessageSchema = new mongoose.Schema(
  {
    text: { type: String, default: '' },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date },
  },
  { _id: false }
);

const ConversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    lastMessage: { type: LastMessageSchema, default: null },
  },
  { timestamps: true }
);

ConversationSchema.index({ participants: 1 });

export const Conversation = mongoose.model('Conversation', ConversationSchema);
