import mongoose from 'mongoose';

export async function connectDB(uri) {
  if (!uri) throw new Error('MONGODB_URI is not set');

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 5000,
  });
  //console.log('MongoDB connected');
}
