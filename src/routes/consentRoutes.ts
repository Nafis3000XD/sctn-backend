import { Router } from 'express';
import { authenticate, authorizeRole } from '../middlewares/authMiddleware';
import { getConsentRequests, respondToConsent, getPermissionHistory, revokeConsent } from '../controllers/consentController';
import { validateBody } from '../middlewares/validate';
import { respondConsentSchema } from '../validation/schemas';

const router = Router();

router.use(authenticate);
router.use(authorizeRole(['Citizen']));

router.get('/requests', getConsentRequests);
router.post('/respond', validateBody(respondConsentSchema), respondToConsent);
router.post('/revoke', revokeConsent);
router.get('/history', getPermissionHistory);

export default router;
