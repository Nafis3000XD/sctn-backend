import { listCorrections, pendingCorrectionsCount, reviewCorrection, reviewCorrectionSchema } from '../controllers/changeRequestController';
import { Router } from 'express';
import { validateBody } from '../middlewares/validate';
import { authenticate, authorizeRole } from '../middlewares/authMiddleware';
import {
  getDashboardStats,
  getFraudAlerts,
  getUsers,
  resolveFraudAlert,
  createUser,
  createUserSchema,
  getAuditLogs,
  getConsentRequests,
  toggleUserStatus,
  getSupportThreads,
  getSupportThreadMessages,
  replySupportThread,
  updateSupportThreadStatus
} from '../controllers/adminController';

const router = Router();

router.use(authenticate);
router.use(authorizeRole(['Admin']));

router.get('/stats', getDashboardStats);
router.get('/change-requests', listCorrections(true));
router.get('/change-requests/pending-count', pendingCorrectionsCount);
router.post('/change-requests/:id/decision', validateBody(reviewCorrectionSchema), reviewCorrection);
router.get('/fraud-alerts', getFraudAlerts);
router.post('/fraud-alerts/resolve', resolveFraudAlert);
router.get('/users', getUsers);
router.post('/users', validateBody(createUserSchema), createUser);
router.post('/users/toggle-status', toggleUserStatus);
router.get('/audit-logs', getAuditLogs);
router.get('/consent-requests', getConsentRequests);
router.get('/support-tickets', getSupportThreads);
router.get('/support-tickets/:citizenId', getSupportThreadMessages);
router.post('/support-tickets/:citizenId', replySupportThread);
router.post('/support-tickets/:citizenId/status', updateSupportThreadStatus);

export default router;
