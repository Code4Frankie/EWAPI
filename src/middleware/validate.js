// validate({ body: schema, query: schema }) - replaces the parsed value on req.
module.exports = (schemas) => (req, _res, next) => {
  try {
    for (const key of ['body', 'query', 'params']) {
      if (schemas[key]) req[key] = schemas[key].parse(req[key] ?? {});
    }
    next();
  } catch (e) {
    next(e); // ZodError handled in errorHandler
  }
};
