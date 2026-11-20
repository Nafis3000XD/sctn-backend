import rateLimit from 'express-rate-limit';
import type { AuthRequest } from '../middlewares/authMiddleware';
import { validateBody } from '../middlewares/validate';
import { listCorrections, verifyCorrection, verifyCorrectionSchema, submitCorrection, submitCorrectionSchema } from '../controllers/changeRequestController';
import { Router } from 'express';
import { authenticate, authorizeRole } from '../middlewares/authMiddleware';
import {
  getProfile,
  getAlerts,
  getSupportMessages,
  sendSupportMessage,
  getFineLogsForCitizen,
  getCrimeLogsForCitizen
} from '../controllers/citizenController';

const router = Router();

router.use(authenticate);
router.use(authorizeRole(['Citizen']));

router.get('/profile', getProfile);
router.get('/alerts', getAlerts);
router.get('/change-requests', listCorrections(false));
router.post('/change-requests/verify', rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  keyGenerator: req => (req as AuthRequest).user!.userId,
  skipSuccessfulRequests: true,
  message: { message: 'Too many verification attempts. Try again in 10 minutes.' }
}), validateBody(verifyCorrectionSchema), verifyCorrection);
router.post('/change-requests', validateBody(submitCorrectionSchema), submitCorrection);
router.get('/support-messages', getSupportMessages);
router.post('/support-messages', sendSupportMessage);

router.get('/fines', getFineLogsForCitizen);
router.get('/crime-logs', getCrimeLogsForCitizen);

export default router;
