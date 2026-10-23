const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, LGAS } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true }, // +234...
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'observer', index: true },
    assignedLgas: [{ type: String, enum: LGAS }], // moderators: limits what they see (empty = all)
    isActive: { type: Boolean, default: true },
    failedLogins: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    refreshTokenHash: { type: String, select: false },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, 12);
userSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.refreshTokenHash;
    delete ret.failedLogins;
    delete ret.lockUntil;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
