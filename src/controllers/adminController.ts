import { Response } from 'express';
import prisma from '../db';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { accountPassword } from '../validation/schemas';
import { checkAndExpireRequests } from '../utils/consentHelper';
import { generateCitizenId } from '../utils/generateCitizenId';
import { AuthRequest } from '../middlewares/authMiddleware';

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: accountPassword,
  role: z.enum(['Citizen', 'Admin', 'JobInterviewer', 'BankLoanOfficer', 'UniversityAuthority', 'Doctor', 'IntelligenceDepartment'])
});

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await checkAndExpireRequests();
    const [totalCitizens, totalRequests, activePermissions, fraudCases] = await Promise.all([
      prisma.user.count({ where: { role: 'Citizen' } }),
      prisma.consentRequest.count(),
      prisma.consentRequest.count({ where: { status: 'Approved' } }),
      prisma.fraudAlert.count({ where: { status: 'Open' } })
    ]);

    res.json({
      totalCitizens,
      totalRequests,
      activePermissions,
      fraudCases
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getFraudAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const alerts = await prisma.fraudAlert.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Collect all profile IDs
    const allProfileIdsSet = new Set<string>();
    const alertProfileIdsMap = new Map<string, string[]>();

    for (const alert of alerts) {
      try {
        const ids = JSON.parse(alert.involvedUserIds);
        if (Array.isArray(ids)) {
          alertProfileIdsMap.set(alert.id, ids);
          ids.forEach(id => allProfileIdsSet.add(id));
        }
      } catch {
        alertProfileIdsMap.set(alert.id, []);
      }
    }

    // Single query to fetch all involved profiles
    const allProfiles = await prisma.citizenProfile.findMany({
      where: { id: { in: Array.from(allProfileIdsSet) } },
      select: {
        id: true,
        fullName: true,
        citizenId: true,
        phone: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          }
        }
      }
    });

    const profilesMap = new Map(allProfiles.map(p => [p.id, p]));

    const populatedAlerts = alerts.map(alert => {
      const profileIds = alertProfileIdsMap.get(alert.id) || [];
      const involvedUsers = profileIds
        .map(id => profilesMap.get(id))
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map(p => ({
          id: p.user.id,
          email: p.user.email,
          role: p.user.role,
          isActive: p.user.isActive,
          createdAt: p.user.createdAt,
          citizenProfile: {
            fullName: p.fullName,
            citizenId: p.citizenId,
            phone: p.phone,
          }
        }));

      return { ...alert, involvedUsers };
    });

    res.json(populatedAlerts);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const resolveFraudAlert = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { alertId } = req.body;
    if (!alertId) {
      res.status(400).json({ message: 'alertId is required' });
      return;
    }
    const existing = await prisma.fraudAlert.findUnique({ where: { id: alertId } });
    if (!existing) {
      res.status(404).json({ message: 'Fraud alert not found' });
      return;
    }
    const alert = await prisma.fraudAlert.update({
      where: { id: alertId },
      data: { status: 'Resolved' }
    });

    // Log admin action
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'RESOLVE_FRAUD_ALERT',
        entity: 'FraudAlert'
      }
    });

    res.json({ message: 'Fraud alert resolved', alert });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const toggleUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, isActive } = req.body;
    if (!userId || typeof isActive !== 'boolean') {
      res.status(400).json({ message: 'userId and isActive (boolean) are required' });
      return;
    }
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true
      }
    });

    // Log admin action
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: isActive ? 'ACTIVATE_USER' : 'SUSPEND_USER',
        entity: 'User'
      }
    });

    res.json({ message: `User status updated successfully`, user });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        citizenProfile: {
          select: { citizenId: true, fullName: true, phone: true }
        },
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;

    const normalizedEmail = email;

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      res.status(400).json({ message: 'Email already in use' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const citizenId = role === 'Citizen' ? await generateCitizenId() : undefined;

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role,
        ...(role === 'Citizen' ? {
          citizenProfile: {
            create: {
              citizenId: citizenId!,
              fullName: 'Pending Setup',
              phone: '',
              dob: new Date('2000-01-01'),
              gender: '',
              address: '',
              emergencyContactName: '',
              emergencyContactNumber: '',
              bloodGroup: ''
            }
          }
        } : {})
      }
    });

    // Log admin action
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: `CREATE_USER_${role.toUpperCase()}`,
        entity: 'User'
      }
    });

    res.status(201).json({ message: 'User created successfully', user: { id: newUser.id, email: newUser.email, role: newUser.role } });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Bounded: this table grows on every action; unbounded fetch degrades forever
    const limit = Math.min(parseInt(String(req.query.limit)) || 200, 1000);
    const logs = await prisma.auditLog.findMany({
      include: {
        user: {
          select: { email: true, role: true }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: limit
    });
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getConsentRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await checkAndExpireRequests();
    const requests = await prisma.consentRequest.findMany({
      include: {
        requester: { select: { email: true, role: true } },
        target: {
          select: {
            email: true,
            citizenProfile: { select: { citizenId: true, fullName: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getSupportThreads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tickets = await prisma.user.findMany({
      where: {
        role: 'Citizen',
        citizenMessages: { some: {} }
      },
      select: {
        id: true,
        email: true,
        supportStatus: true,
        citizenProfile: {
          select: { fullName: true, citizenId: true }
        },
        citizenMessages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            message: true,
            createdAt: true
          }
        }
      }
    });

    const threads = tickets.map(t => ({
      citizenId: t.id,
      email: t.email,
      supportStatus: t.supportStatus,
      fullName: t.citizenProfile?.fullName || 'Anonymous',
      citizenCode: t.citizenProfile?.citizenId || '',
      lastMessage: t.citizenMessages[0]?.message || '',
      lastMessageAt: t.citizenMessages[0]?.createdAt || null
    })).sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());

    res.json(threads);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getSupportThreadMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const citizenId = req.params.citizenId as string;
    const messages = await prisma.supportMessage.findMany({
      where: { citizenId },
      include: {
        sender: {
          select: { id: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const replySupportThread = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const citizenId = req.params.citizenId as string;
    const { message } = req.body;
    const adminUserId = req.user?.userId;

    if (!message || message.trim() === '') {
      res.status(400).json({ message: 'Message content is required' });
      return;
    }

    const newMessage = await prisma.supportMessage.create({
      data: {
        citizenId,
        senderId: adminUserId!,
        message
      },
      include: {
        sender: {
          select: { id: true, email: true, role: true }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'REPLY_SUPPORT_MESSAGE',
        entity: 'SupportMessage'
      }
    });

    res.status(201).json(newMessage);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateSupportThreadStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const citizenId = req.params.citizenId as string;
    const { status } = req.body; // 'Open' or 'Closed'

    if (status !== 'Open' && status !== 'Closed') {
      res.status(400).json({ message: 'Invalid status value. Must be Open or Closed.' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: citizenId },
      data: { supportStatus: status },
      select: { id: true, email: true, supportStatus: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: status === 'Closed' ? 'CLOSE_SUPPORT_TICKET' : 'REOPEN_SUPPORT_TICKET',
        entity: 'User'
      }
    });

    res.json(updatedUser);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};
