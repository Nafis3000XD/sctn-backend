import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db';
import { getMediaSession } from '../utils/mediaSession';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32)) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }
  return secret || 'dev_only_change_me';
}

export interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

function authenticateRequest(allowMediaCookie: boolean) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ')
      ? header.slice(7)
      : allowMediaCookie ? getMediaSession(req) : undefined;
    if (!token) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
      if (typeof decoded === 'string' || typeof decoded.userId !== 'string') {
        throw new Error('Invalid session');
      }
      userId = decoded.userId;
    } catch {
      res.status(401).json({ message: 'Invalid or expired token' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, role: true }
    });
    if (!user) {
      res.status(401).json({ message: 'Session invalid: User no longer exists' });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ message: 'Account is deactivated. Contact admin.' });
      return;
    }

    req.user = { userId: user.id, role: user.role };
    next();
  };
}

export const authenticate = authenticateRequest(false);
export const authenticateMedia = authenticateRequest(true);

export function authorizeRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: 'Access denied: insufficient permissions' });
      return;
    }
    next();
  };
}
