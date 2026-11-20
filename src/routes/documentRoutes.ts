import { Router } from 'express';
import { authenticate, authorizeRole } from '../middlewares/authMiddleware';
import { uploadDocument, getDocuments } from '../controllers/documentController';
import { createUpload, validateUploads } from '../utils/upload';

const upload = createUpload({
  allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  maxFileSizeBytes: 5 * 1024 * 1024,
  maxFiles: 1,
  fileTypeError: 'Only PDF, JPG, PNG, and WEBP files are allowed'
});

const router = Router();

router.use(authenticate);
router.use(authorizeRole(['Citizen']));

router.post('/upload', validateUploads(upload.single('document')), uploadDocument);
router.get('/', getDocuments);

export default router;
