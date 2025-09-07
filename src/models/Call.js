import mongoose from 'mongoose';

const CallSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', index: true, required: true },
    caller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['voice', 'video'], required: true },
    status: { type: String, enum: ['missed', 'answered', 'declined', 'ended'], required: true },
    duration: { type: Number, default: 0 }, // in seconds
    startedAt: { type: Date },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

CallSchema.index({ conversation: 1, createdAt: 1 });
CallSchema.index({ caller: 1, createdAt: -1 });
CallSchema.index({ recipient: 1, createdAt: -1 });

export const Call = mongoose.model('Call', CallSchema);
