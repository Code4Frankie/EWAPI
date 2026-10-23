const mongoose = require('mongoose');
const env = require('./env');

mongoose.set('strictQuery', true);

module.exports = async function connectDb() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('MongoDB connected');
};
