import { Router } from 'express';
import prisma from '../db';
import { hasMedicalVisitConsent } from '../utils/consentScopes';
import { authenticateMedia, type AuthRequest } from '../middlewares/authMiddleware';

const router = Router();

router.get('/:id', authenticateMedia, async (req: AuthRequest, res) => {
  res.set('Cache-Control', 'private, no-store');
  const user = req.user!;
  const id = req.params.id as string;
  const upload = await prisma.uploadedFile.findUnique({
    where: { id },
    select: { ownerId: true, category: true }
  });

  let allowed = upload && (
    upload.ownerId === user.userId || ['Admin', 'IntelligenceDepartment'].includes(user.role)
  );

  if (upload && !allowed && user.role === 'Doctor' && upload.category === 'Prescription') {
    allowed = await hasMedicalVisitConsent(user.userId, upload.ownerId);
  }

  if (!allowed) {
    res.status(404).json({ message: 'File not found' });
    return;
  }

  const content = await prisma.uploadedFile.findUnique({
    where: { id },
    select: { bytes: true, mimeType: true }
  });

  if (!content) {
    res.status(404).json({ message: 'File not found' });
    return;
  }

  res.type(content.mimeType).send(Buffer.from(content.bytes));
});

router.use((_req, res) => {
  res.status(404).json({ message: 'File not found' });
});

export default router;
