// Normalises Nigerian numbers to +234XXXXXXXXXX. Returns null if it doesn't look valid.
function normalizePhone(input) {
  if (!input) return null;
  let d = String(input).replace(/[^\d]/g, '');
  if (d.startsWith('234') && d.length === 13) return `+${d}`;
  if (d.startsWith('0') && d.length === 11) return `+234${d.slice(1)}`;
  if (d.length === 10 && /^[789]/.test(d)) return `+234${d}`;
  return null;
}
module.exports = { normalizePhone };
