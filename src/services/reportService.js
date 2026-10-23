const Report = require('../models/Report');
const PollingUnit = require('../models/PollingUnit');

// Fills lga/ward/geo from a known polling unit code when available.
async function resolveLocation(loc) {
  const out = { ...loc };
  if (loc.pollingUnitCode) {
    const pu = await PollingUnit.findOne({ code: loc.pollingUnitCode.toUpperCase() }).lean();
    if (pu) {
      out.pollingUnit = pu._id;
      out.pollingUnitCode = pu.code;
      out.lga = pu.lga;
      out.ward = pu.ward || out.ward;
      if (!out.geo && pu.geo?.coordinates) out.geo = pu.geo;
    }
  }
  return out;
}

// Retries on the (very unlikely) refCode collision.
async function createReport(data) {
  for (let i = 0; i < 3; i += 1) {
    try {
      return await Report.create(data);
    } catch (e) {
      const collision = e.code === 11000 && e.keyPattern?.refCode;
      if (!collision) throw e;
      delete data.refCode;
    }
  }
  throw new Error('Could not allocate a reference code');
}

module.exports = { resolveLocation, createReport };
