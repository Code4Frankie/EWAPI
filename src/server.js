const env = require('./config/env');
const connectDb = require('./config/db');
const app = require('./app');

(async () => {
  await connectDb();
  const server = app.listen(env.PORT, () => console.log(`ElectWatch API on :${env.PORT} (${env.NODE_ENV})`));

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
