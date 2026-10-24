import { readFileSync } from 'node:fs';

// 36 states + FCT and their 774 LGAs (MIT-licensed dataset, counts verified against published totals).
const DATA = JSON.parse(readFileSync(new URL('../data/nigeria-geo.json', import.meta.url), 'utf8'));

export const STATES = DATA.map((d) => d.state);
const LGA_SETS = new Map(DATA.map((d) => [d.state, new Set(d.lgas)]));

export const isValidState = (s) => LGA_SETS.has(s);
export const isValidLga = (state, lga) => LGA_SETS.get(state)?.has(lga) ?? false;
export const GEO = DATA;
