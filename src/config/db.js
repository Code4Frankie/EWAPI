import mongoose from 'mongoose';
import env from './env.js';

mongoose.set('strictQuery', true);

export default async function connectDb() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('MongoDB connected');
};
