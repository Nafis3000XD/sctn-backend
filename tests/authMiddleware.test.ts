import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Response, NextFunction } from 'express';

// Mock the Prisma client so authenticate() never touches a real database.
vi.mock('../src/db', () => ({
  default: { user: { findUnique: vi.fn() } }
}));

import prisma from '../src/db';
import { authenticate, authorizeRole } from '../src/middlewares/authMiddleware';
import type { AuthRequest } from '../src/middlewares/authMiddleware';

const findUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;
const SECRET = 'dev_only_change_me'; // getJwtSecret() fallback outside production
const token = (payload: object) => jwt.sign(payload, SECRET);

const makeRes = () => {
  const res = {} as Record<string, unknown> & Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
};

beforeEach(() => findUnique.mockReset());

describe('authenticate', () => {
  it('rejects requests without a Bearer token (401)', async () => {
    const req = { headers: {} } as AuthRequest;
    const res = makeRes();
    const next = vi.fn();
    await authenticate(req, res, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an invalid token (401)', async () => {
    const req = { headers: { authorization: 'Bearer not.a.jwt' } } as AuthRequest;
    const res = makeRes();
    const next = vi.fn();
    await authenticate(req, res, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when the user no longer exists (401)', async () => {
    findUnique.mockResolvedValue(null);
    const req = { headers: { authorization: `Bearer ${token({ userId: 'u1', role: 'Citizen' })}` } } as AuthRequest;
    const res = makeRes();
    const next = vi.fn();
    await authenticate(req, res, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a suspended (inactive) user with 403 — security regression guard', async () => {
    findUnique.mockResolvedValue({ id: 'u1', isActive: false });
    const req = { headers: { authorization: `Bearer ${token({ userId: 'u1', role: 'Citizen' })}` } } as AuthRequest;
    const res = makeRes();
    const next = vi.fn();
    await authenticate(req, res, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows an active user and attaches req.user', async () => {
    findUnique.mockResolvedValue({ id: 'u1', isActive: true, role: 'Citizen' });
    const req = { headers: { authorization: `Bearer ${token({ userId: 'u1', role: 'Citizen' })}` } } as AuthRequest;
    const res = makeRes();
    const next = vi.fn();
    await authenticate(req, res, next as NextFunction);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject({ userId: 'u1', role: 'Citizen' });
  });
});

describe('authorizeRole', () => {
  it('returns 401 when no user is present', () => {
    const res = makeRes();
    const next = vi.fn();
    authorizeRole(['Admin'])({} as AuthRequest, res, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when the role is not allowed', () => {
    const res = makeRes();
    const next = vi.fn();
    authorizeRole(['Admin'])({ user: { userId: 'u1', role: 'Citizen' } } as AuthRequest, res, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when the role is allowed', () => {
    const res = makeRes();
    const next = vi.fn();
    authorizeRole(['Admin', 'Citizen'])({ user: { userId: 'u1', role: 'Admin' } } as AuthRequest, res, next as NextFunction);
    expect(next).toHaveBeenCalledOnce();
  });
});
