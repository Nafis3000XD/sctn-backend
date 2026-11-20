import { Response } from 'express';
import prisma from '../db';
import { saveUpload } from '../utils/upload';
import { AuthRequest } from '../middlewares/authMiddleware';

export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const profile = await prisma.citizenProfile.findUnique({ where: { userId } });

    if (!profile) {
      res.status(404).json({ message: 'Profile not found' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const type = typeof req.body.type === 'string' ? req.body.type.trim() : '';
    if (!type || type.length > 100) {
      res.status(400).json({ message: 'Document type is required' });
      return;
    }

    const document = await prisma.$transaction(async (tx) => {
      const fileUrl = await saveUpload(tx, file, userId, 'Document');
      const record = await tx.document.create({
        data: { citizenProfileId: profile.id, type, fileUrl, status: 'Pending Review' }
      });
      await tx.auditLog.create({
        data: { userId, action: 'UPLOAD_DOCUMENT_' + type.toUpperCase(), entity: 'Document' }
      });
      return record;
    });

    res.status(201).json({ message: 'Document uploaded successfully', document });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const profile = await prisma.citizenProfile.findUnique({ where: { userId } });

    if (!profile) {
      res.status(404).json({ message: 'Profile not found' });
      return;
    }

    const documents = await prisma.document.findMany({
      where: { citizenProfileId: profile.id }
    });

    res.json(documents);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};
