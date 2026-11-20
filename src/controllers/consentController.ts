import { Response } from 'express';
import prisma from '../db';
import { AuthRequest } from '../middlewares/authMiddleware';
import { checkAndExpireRequests } from '../utils/consentHelper';

export const getConsentRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await checkAndExpireRequests();
    const userId = req.user?.userId;

    const requests = await prisma.consentRequest.findMany({
      where: { targetId: userId },
      include: {
        requester: {
          select: { id: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const respondToConsent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { requestId, status, durationMinutes } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      res.status(400).json({ message: 'Consent status must be Approved or Rejected.' });
      return;
    }

    const request = await prisma.consentRequest.findUnique({ where: { id: requestId } });

    if (!request || request.targetId !== userId) {
      res.status(404).json({ message: 'Request not found' });
      return;
    }

    if (request.status !== 'Pending') {
      res.status(409).json({ message: `This consent request is already ${request.status}.` });
      return;
    }

    let expiryTime = null;
    if (status === 'Approved' && durationMinutes) {
      expiryTime = new Date(Date.now() + durationMinutes * 60000);
    }

    const updatedRequest = await prisma.consentRequest.update({
      where: { id: requestId },
      data: {
        status,
        expiryTime,
        approvedAt: status === 'Approved' ? new Date() : null
      }
    });

    // Audit consent response
    await prisma.auditLog.create({
      data: {
        userId,
        action: `CONSENT_RESPONSE_${status.toUpperCase()}`,
        entity: 'ConsentRequest'
      }
    });

    res.json({ message: `Consent ${status}`, consentRequest: updatedRequest });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getPermissionHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await checkAndExpireRequests();
    const userId = req.user?.userId;

    const history = await prisma.consentRequest.findMany({
      where: {
        targetId: userId,
        status: { in: ['Approved', 'Rejected', 'Expired'] }
      },
      include: {
        requester: {
          select: { email: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(history);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const revokeConsent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { requestId } = req.body;

    if (!requestId) {
      res.status(400).json({ message: 'requestId is required' });
      return;
    }

    const request = await prisma.consentRequest.findUnique({ where: { id: requestId } });

    if (!request || request.targetId !== userId) {
      res.status(404).json({ message: 'Request not found' });
      return;
    }

    if (request.status !== 'Approved') {
      res.status(400).json({ message: 'Only approved consent requests can be revoked.' });
      return;
    }

    const updatedRequest = await prisma.consentRequest.update({
      where: { id: requestId },
      data: {
        status: 'Expired',
        expiryTime: new Date()
      }
    });

    // Audit consent response
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CONSENT_REVOKED',
        entity: 'ConsentRequest'
      }
    });

    res.json({ message: 'Access removed successfully', consentRequest: updatedRequest });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};
