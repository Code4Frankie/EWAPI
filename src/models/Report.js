import mongoose from 'mongoose';
import crypto from 'crypto';
import {
  LGAS, CATEGORIES, SEVERITIES, STATUSES, CHANNELS,
} from '../config/constants.js';

const { Schema } = mongoose;

const mediaSchema = new Schema(
  { url: String, publicId: String, resourceType: String, format: String, bytes: Number },
  { _id: false }
);

const historySchema = new Schema(
  {
    from: String,
    to: String,
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, maxlength: 1000 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I - easy to read out over a call
function generateRefCode() {
  const bytes = crypto.randomBytes(8);
  let s = '';
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `VW-${s.slice(0, 4)}-${s.slice(4)}`;
}

const reportSchema = new Schema(
  {
    refCode: { type: String, unique: true, default: generateRefCode },
    channel: { type: String, enum: CHANNELS, required: true, index: true },
    externalId: String, // provider message/call id, used to dedupe webhook retries

    category: { type: String, enum: CATEGORIES, required: true, index: true },
    severity: { type: String, enum: SEVERITIES, default: 'medium', index: true },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: STATUSES, default: 'new', index: true },

    location: {
      lga: { type: String, enum: LGAS, required: true },
      ward: { type: String, trim: true },
      pollingUnitCode: { type: String, uppercase: true, trim: true },
      pollingUnit: { type: Schema.Types.ObjectId, ref: 'PollingUnit' },
      geo: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number], default: undefined }, // [lng, lat]
      },
    },
    occurredAt: { type: Date, default: Date.now },

    reporter: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    reporterPhone: String,
    reporterVerified: { type: Boolean, default: false }, // false = unregistered SMS/voice sender

    media: [mediaSchema],
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    history: [historySchema],
  },
  { timestamps: true }
);

reportSchema.index({ 'location.lga': 1, createdAt: -1 });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ 'location.geo': '2dsphere' });
reportSchema.index({ description: 'text' });
reportSchema.index(
  { channel: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } }
);

reportSchema.set('toJSON', {
  transform: (_d, ret) => {
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('Report', reportSchema);
