import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import env from './config/env.js';
import sanitize from './middleware/sanitize.js';
import { notFound, errorHandler } from './middleware/error.js';
import routes from './routes/index.js';

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

export default app;
