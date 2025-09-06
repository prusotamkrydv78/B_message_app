import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const RefreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 80 },
    phoneNumber: { type: String, required: true, unique: true, index: true },
    countryCode: { type: String, default: '+1' },
    passwordHash: { type: String, required: true },
    refreshTokens: { type: [RefreshTokenSchema], default: [] },
  },
  { timestamps: true }
);

UserSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

UserSchema.statics.hashPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const User = mongoose.model('User', UserSchema);
