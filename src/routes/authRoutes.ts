import { Router } from 'express';
import { clearMediaSession } from '../utils/mediaSession';
import { registerCitizen, login, uploadProfilePicture } from '../controllers/authController';
import { authenticate } from '../middlewares/authMiddleware';
import { authLimiter } from '../middlewares/rateLimiter';
import { validateBody } from '../middlewares/validate';
import { registerSchema, loginSchema } from '../validation/schemas';
import { createUpload, validateUploads } from '../utils/upload';

const upload = createUpload({
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxFileSizeBytes: 2 * 1024 * 1024,
  maxFiles: 1,
  fileTypeError: 'Only JPG, PNG, and WEBP images are allowed'
});

const router = Router();

router.post('/register', authLimiter, validateBody(registerSchema), registerCitizen);
router.post('/login', authLimiter, validateBody(loginSchema), login);

router.post('/logout', (_req, res) => {
  clearMediaSession(res);
  res.sendStatus(204);
});

router.post('/profile-picture', authenticate, validateUploads(upload.single('profilePic')), uploadProfilePicture);

export default router;
