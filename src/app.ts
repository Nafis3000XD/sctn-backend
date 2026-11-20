import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import multer from 'multer';
import prisma from './db';
import authRoutes from './routes/authRoutes';
import citizenRoutes from './routes/citizenRoutes';
import documentRoutes from './routes/documentRoutes';
import consentRoutes from './routes/consentRoutes';
import verifierRoutes from './routes/verifierRoutes';
import adminRoutes from './routes/adminRoutes';
import uploadRoutes from './routes/uploadRoutes';

const app = express();
const production = process.env.NODE_ENV === 'production';
const frontend = path.resolve(__dirname, '../../frontend/dist');

app.disable('x-powered-by');
if (process.env.RENDER === 'true') app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      upgradeInsecureRequests: production ? [] : null
    }
  }
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

app.use('/uploads', uploadRoutes);
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api/auth', authRoutes);
app.use('/api/citizen', citizenRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/consent', consentRoutes);
app.use('/api/verifier', verifierRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

if (process.env.NODE_ENV !== 'test') {
  app.use('/assets', express.static(path.join(frontend, 'assets'), {
    immutable: true,
    maxAge: '1y',
    fallthrough: false
  }));
  app.use(express.static(frontend, { index: false }));
  app.get('/{*route}', (_req, res, next) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(frontend, 'index.html'), (error) => {
      if (error) next(error);
    });
  });
}

const handleError: express.ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(status).json({ message: error.message });
    return;
  }
  const status = Number(error.status);
  if (status >= 400 && status < 500) {
    res.status(status).json({ message: status === 404 ? 'Not found' : error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ message: 'Internal server error' });
};

app.use(handleError);

export default app;
