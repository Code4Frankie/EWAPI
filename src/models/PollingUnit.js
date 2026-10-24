import mongoose from 'mongoose';
import { STATES } from '../config/geo.js';

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true }, // e.g. 26-05-03-012
    name: { type: String, required: true, trim: true },
    state: { type: String, enum: STATES, required: true, index: true },
    lga: { type: String, required: true, index: true },
    ward: { type: String, trim: true },
    geo: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number], default: undefined },
    },
  },
  { timestamps: true }
);

export default mongoose.model('PollingUnit', schema);
