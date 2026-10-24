import env from './config/env.js';
import connectDb from './config/db.js';
import app from './app.js';

(async () => {
  await connectDb();
  const server = app.listen(env.PORT, () => console.log(`Voter Witness API on :${env.PORT} (${env.NODE_ENV})`));

  const shutdown = () => {
    console.log('Shutting down...');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
})().catch((e) => {
  console.error('Startup failed:', e.message);
  process.exit(1);
});
