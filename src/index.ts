import 'dotenv/config';
import app from './app';
import prisma from './db';
import { getJwtSecret } from './middlewares/authMiddleware';

async function start() {
  getJwtSecret();
  await prisma.$connect();

  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid port number');
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`SCTN listening on port ${port}`);
  });
  server.on('error', (error) => {
    console.error('SCTN server error', error);
    process.exitCode = 1;
    void prisma.$disconnect();
  });

  const shutdown = () => {
    const timeout = setTimeout(() => process.exit(1), 10_000);
    timeout.unref();
    server.close(() => {
      void prisma.$disconnect().finally(() => clearTimeout(timeout));
    });
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

start().catch(async (error: unknown) => {
  console.error('SCTN could not start', error);
  process.exitCode = 1;
  await prisma.$disconnect();
});
