const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const sanitize = require('./middleware/sanitize');
const { notFound, errorHandler } = require('./middleware/error');
const routes = require('./routes');

const app = express();

app.set('trust proxy', 1); // Render sits behind one proxy; needed for correct client IPs / rate limiting
app.disable('x-powered-by');

app.use(helmet());
const origins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins, credentials: true }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' })); // SMS providers often post form-encoded
app.use(sanitize);

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
