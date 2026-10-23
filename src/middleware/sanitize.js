// Strips NoSQL-operator keys ($...) and dotted keys from user input.
function clean(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    if (k.startsWith('$') || k.includes('.')) delete obj[k];
    else clean(obj[k]);
  }
}
export default (req, _res, next) => {
  clean(req.body);
  clean(req.query);
  clean(req.params);
  next();
};
