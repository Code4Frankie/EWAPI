// Usage: node scripts/resetPassword.js <email> <new-password>
// Resets (or creates) an admin account in the database the server actually uses, and clears any lockout.
import mongoose from 'mongoose';
import connectDb from '../src/config/db.js';
import User from '../src/models/User.js';

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 10) {
  console.error('Usage: node scripts/resetPassword.js <email> <new-password, 10+ characters>');
  process.exit(1);
}

await connectDb();
console.log(`Database in use: ${mongoose.connection.name}`);

const admins = await User.find({ role: 'admin' }).select('email isActive');
console.log('Existing admin accounts:', admins.length ? admins.map((a) => `${a.email}${a.isActive ? '' : ' (inactive)'}`).join(', ') : 'none');

const passwordHash = await User.hashPassword(password);
let user = await User.findOne({ email: email.toLowerCase() });
if (user) {
  user.passwordHash = passwordHash;
  user.isActive = true;
  user.failedLogins = 0;
  user.lockUntil = undefined;
  user.refreshTokenHash = undefined;
  await user.save();
  console.log(`Password reset and lockout cleared for ${user.email} (role: ${user.role}).`);
} else {
  user = await User.create({ name: 'Voter Witness Admin', email, role: 'admin', passwordHash });
  console.log(`No such account, so created admin ${user.email}.`);
}
await mongoose.disconnect();
