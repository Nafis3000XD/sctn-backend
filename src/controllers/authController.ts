import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../db';
import { sessionLifetimeSeconds, setMediaSession } from '../utils/mediaSession';
import { removeUploads, saveUpload } from '../utils/upload';
import { getJwtSecret, AuthRequest } from '../middlewares/authMiddleware';
import { generateCitizenId } from '../utils/generateCitizenId';

export const registerCitizen = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      email, password, fullName, dob, phone = '', gender = '', address = '',
      emergencyContactName = '', emergencyContactNumber = '', bloodGroup = ''
    } = req.body;

    if (!email || !password || !fullName || !dob) {
      res.status(400).json({ message: 'Email, password, full name, and date of birth are required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      res.status(400).json({ message: 'Email already in use' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const citizenId = await generateCitizenId();

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: 'Citizen',
        citizenProfile: {
          create: {
            citizenId,
            fullName,
            phone,
            dob: new Date(dob),
            gender,
            address,
            emergencyContactName,
            emergencyContactNumber,
            bloodGroup
          }
        }
      },
      include: {
        citizenProfile: true
      }
    });

    const token = jwt.sign(
      { userId: newUser.id, role: newUser.role },
      getJwtSecret(),
      { expiresIn: sessionLifetimeSeconds, jwtid: randomUUID() }
    );

    // Audit registration
    await prisma.auditLog.create({
      data: {
        userId: newUser.id,
        action: 'REGISTER_CITIZEN',
        entity: 'User'
      }
    });

    setMediaSession(res, token);
    res.status(201).json({
      message: 'Citizen registered successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        profilePicture: newUser.profilePicture,
        citizenProfile: newUser.citizenProfile
      }
    });
  } catch (error: any) {
    console.error('Registration failed:', error instanceof Error ? error.name : 'Unknown error');
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email) {
      res.status(400).json({ message: 'Email is required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { citizenProfile: true }
    });

    if (!user) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ message: 'Account is deactivated. Contact admin.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      getJwtSecret(),
      { expiresIn: sessionLifetimeSeconds, jwtid: randomUUID() }
    );

    // Audit login
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'User'
      }
    });

    setMediaSession(res, token);
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
        citizenProfile: user.citizenProfile
      }
    });
  } catch (error: any) {
    console.error('Login failed:', error instanceof Error ? error.name : 'Unknown error');
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const uploadProfilePicture = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: 'No image file uploaded' });
      return;
    }

    const fileUrl = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ profilePicture: string | null }[]>
        `SELECT "profilePicture" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const url = await saveUpload(tx, file, userId, 'Profile');
      await tx.user.update({ where: { id: userId }, data: { profilePicture: url } });
      await removeUploads(tx, [rows[0]?.profilePicture ?? null]);
      await tx.auditLog.create({ data: { userId, action: 'UPDATE_PROFILE_PICTURE', entity: 'User' } });
      return url;
    });

    res.json({
      message: 'Profile picture updated successfully',
      profilePicture: fileUrl
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};
