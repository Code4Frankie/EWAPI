import env from '../src/config/env.js';
import connectDb from '../src/config/db.js';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

(async () => {
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) {
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env');
  }
  await connectDb();
  const exists = await User.findOne({ email: env.SEED_ADMIN_EMAIL.toLowerCase() });
  if (exists) {
    console.log('Admin already exists, nothing to do.');
  } else {
    await User.create({
      name: 'Voter Witness Admin',
      email: env.SEED_ADMIN_EMAIL,
      role: 'admin',
      passwordHash: await User.hashPassword(env.SEED_ADMIN_PASSWORD),
    });
    console.log(`Admin created: ${env.SEED_ADMIN_EMAIL}. Change the password after first login.`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
