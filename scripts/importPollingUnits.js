// Usage: npm run import:pu -- path/to/polling_units.csv
// CSV header: code,name,state,lga,ward,lat,lng   (no commas inside fields)
// Get the authoritative list from INEC / your client; the pilot needs it for SMS + voice lookups.
import fs from 'fs';
import mongoose from 'mongoose';
import connectDb from '../src/config/db.js';
import PollingUnit from '../src/models/PollingUnit.js';
import { isValidLga } from '../src/config/geo.js';

(async () => {
  const file = process.argv[2];
  if (!file) throw new Error('Provide a CSV path');
  const [header, ...rows] = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  const cols = header.split(',').map((c) => c.trim().toLowerCase());
  const idx = (n) => cols.indexOf(n);
  for (const need of ['code', 'name', 'state', 'lga']) if (idx(need) < 0) throw new Error(`Missing column: ${need}`);

  const ops = [];
  const skipped = [];
  rows.forEach((line, i) => {
    const f = line.split(',').map((x) => x.trim());
    const state = f[idx('state')];
    const lga = f[idx('lga')];
    if (!isValidLga(state, lga)) return skipped.push(`row ${i + 2}: unknown state/LGA "${state} / ${lga}"`);
    const lat = parseFloat(f[idx('lat')]);
    const lng = parseFloat(f[idx('lng')]);
    const doc = { code: f[idx('code')].toUpperCase(), name: f[idx('name')], state, lga, ward: f[idx('ward')] || undefined };
    if (Number.isFinite(lat) && Number.isFinite(lng)) doc.geo = { type: 'Point', coordinates: [lng, lat] };
    ops.push({ updateOne: { filter: { code: doc.code }, update: { $set: doc }, upsert: true } });
  });

  await connectDb();
  if (ops.length) await PollingUnit.bulkWrite(ops);
  console.log(`Imported/updated ${ops.length} polling units. Skipped ${skipped.length}.`);
  skipped.slice(0, 20).forEach((s) => console.log('  ', s));
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
