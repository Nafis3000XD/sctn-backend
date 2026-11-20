import { correctionLabel } from './changeRequestController';
import { Response } from 'express';
import prisma from '../db';
import { AuthRequest } from '../middlewares/authMiddleware';

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const profile = await prisma.citizenProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { supportStatus: true }
        },
        identityInfo: true,
        educationInfo: true,
        financialInfo: true,
        medicalInfo: {
          include: {
            visitLogs: {
              orderBy: {
                createdAt: 'desc'
              }
            }
          }
        },
        crimeInfo: {
          include: {
            fineLogs: {
              orderBy: {
                fineDate: 'desc'
              }
            },
            crimeLogs: {
              orderBy: {
                crimeDate: 'desc'
              }
            }
          }
        },
        documents: true
      }
    });

    if (!profile) {
      res.status(404).json({ message: 'Profile not found' });
      return;
    }

    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const profile = await prisma.citizenProfile.findUnique({ where: { userId } });
    if (!profile) {
      res.status(404).json({ message: 'Profile not found' });
      return;
    }

    const alerts = [];

    const [pendingConsents, fraudAlerts, docs, reviewedChanges] = await Promise.all([
      prisma.consentRequest.findMany({
        where: { targetId: userId, status: 'Pending' },
        include: { requester: { select: { role: true, email: true } } }
      }),
      prisma.fraudAlert.findMany({
        where: {
          status: 'Open',
          involvedUserIds: { contains: profile.id }
        }
      }),
      prisma.document.findMany({ where: { citizenProfileId: profile.id } }),
      prisma.profileChangeRequest.findMany({
        where: { citizenId: userId, status: { in: ['APPROVED', 'REJECTED'] } },
        orderBy: { reviewedAt: 'desc' }, take: 25,
        select: { id: true, category: true, status: true, reviewedAt: true }
      })
    ]);

    // 1. Consent requests alerts (Pending)
    for (const r of pendingConsents) {
      alerts.push({
        id: `consent-${r.id}`,
        type: 'Security',
        title: 'Consent Request Pending',
        description: `${r.requester.role.replace(/([A-Z])/g, ' $1').trim()} (${r.requester.email}) is requesting access to your data.`,
        createdAt: r.createdAt,
        severity: 'info',
        link: '/citizen/permissions'
      });
    }

    // 2. Fraud Alerts (open fraud alerts involving this profile ID)
    for (const f of fraudAlerts) {
      alerts.push({
        id: `fraud-${f.id}`,
        type: 'Fraud',
        title: `Duplicate ${f.duplicateType} Detected`,
        description: `A duplicate ${f.duplicateType} (${f.duplicateValue}) has been linked to another account! Under security review.`,
        createdAt: f.createdAt,
        severity: 'danger',
        link: '/citizen/profile'
      });
    }

    // 3. Document Expiry alerts (mocked based on documents uploaded)
    const passportDoc = docs.find(d => d.type.toLowerCase().includes('passport'));
    if (passportDoc) {
      alerts.push({
        id: 'expiry-passport',
        type: 'Expiry',
        title: 'Passport Nearing Expiry',
        description: 'Your uploaded Passport is set to expire in 45 days. Please update your document details.',
        createdAt: new Date(Date.now() - 3600000 * 2), // 2 hours ago
        severity: 'warning',
        link: '/citizen/documents'
      });
    }

    const licenseDoc = docs.find(d => d.type.toLowerCase().includes('license') || d.type.toLowerCase().includes('driving'));
    if (licenseDoc) {
      alerts.push({
        id: 'expiry-license',
        type: 'Expiry',
        title: 'Driving License Renewal',
        description: 'Your Driving License renewal is due in 30 days. Action required.',
        createdAt: new Date(Date.now() - 3600000 * 4), // 4 hours ago
        severity: 'warning',
        link: '/citizen/documents'
      });
    }

    for (const request of reviewedChanges) {
      alerts.push({
        id: 'change-review-' + request.id, type: 'Profile',
        title: request.status === 'APPROVED' ? 'Profile change approved' : 'Profile change declined',
        description: correctionLabel(request.category) + ' · View the decision in Change Requests.',
        createdAt: request.reviewedAt ?? new Date(0), severity: 'info', link: '/citizen/changes'
      });
    }

    // Sort alerts by createdAt desc
    alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(alerts);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getSupportMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { supportStatus: true }
    });
    const messages = await prisma.supportMessage.findMany({
      where: { citizenId: userId },
      include: {
        sender: {
          select: { id: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.setHeader('x-support-status', user?.supportStatus || 'Open');
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const sendSupportMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { message } = req.body;

    if (!message || message.trim() === '') {
      res.status(400).json({ message: 'Message content is required' });
      return;
    }

    const newMessage = await prisma.supportMessage.create({
      data: {
        citizenId: userId!,
        senderId: userId!,
        message
      },
      include: {
        sender: {
          select: { id: true, email: true, role: true }
        }
      }
    });

    await prisma.user.update({
      where: { id: userId },
      data: { supportStatus: 'Open' }
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'SEND_SUPPORT_MESSAGE',
        entity: 'SupportMessage'
      }
    });

    res.status(201).json(newMessage);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getFineLogsForCitizen = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const profile = await prisma.citizenProfile.findUnique({ where: { userId } });
    if (!profile) {
      res.status(404).json({ message: 'Profile not found' });
      return;
    }

    const crimeInfo = await prisma.crimeInfo.findUnique({
      where: { citizenProfileId: profile.id },
      include: {
        fineLogs: {
          orderBy: {
            fineDate: 'desc'
          }
        }
      }
    });

    if (!crimeInfo) {
      res.json({ fineLogs: [] });
      return;
    }

    res.json({ fineLogs: crimeInfo.fineLogs });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCrimeLogsForCitizen = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const profile = await prisma.citizenProfile.findUnique({ where: { userId } });
    if (!profile) {
      res.status(404).json({ message: 'Profile not found' });
      return;
    }

    const crimeInfo = await prisma.crimeInfo.findUnique({
      where: { citizenProfileId: profile.id },
      include: {
        crimeLogs: {
          orderBy: {
            crimeDate: 'desc'
          }
        }
      }
    });

    if (!crimeInfo) {
      res.json({ crimeLogs: [] });
      return;
    }

    res.json({ crimeLogs: crimeInfo.crimeLogs });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};
