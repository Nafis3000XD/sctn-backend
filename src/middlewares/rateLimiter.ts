import rateLimit from 'express-rate-limit';

// Throttle authentication endpoints to blunt brute-force and credential-stuffing
// attacks. 30 attempts per IP per 15 minutes is generous for legitimate users
// but quickly shuts down automated guessing.
// NOTE: if deployed behind a reverse proxy, also set `app.set('trust proxy', 1)`
// so the limiter keys on the real client IP rather than the proxy's.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts from this IP. Please try again in 15 minutes.' }
});
