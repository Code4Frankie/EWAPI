import mongoose from 'mongoose';
import { LGAS } from '../config/constants.js';

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true }, // e.g. 26-05-03-012
    name: { type: String, required: true, trim: true },
    lga: { type: String, enum: LGAS, required: true, index: true },
    ward: { type: String, trim: true },
    geo: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number], default: undefined },
    },
  },
  { timestamps: true }
);

export default mongoose.model('PollingUnit', schema);
