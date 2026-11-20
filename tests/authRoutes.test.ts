import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';

// Mock Prisma so the full Express app (routes + middleware + controllers) can be
// exercised in-process via supertest without a real database.
vi.mock('../src/db', () => ({
  default: {
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({}) }
  }
}));

import request from 'supertest';
import prisma from '../src/db';
import app from '../src/app';

const findUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;

const activeAdmin = async (password = 'secret123') => ({
  id: 'u1',
  email: 'a@b.com',
  passwordHash: await bcrypt.hash(password, 10),
  role: 'Admin',
  isActive: true,
  profilePicture: null,
  citizenProfile: null
});

beforeEach(() => findUnique.mockReset());

describe('POST /api/auth/login', () => {
  it('returns 200 and a token for valid credentials', async () => {
    findUnique.mockResolvedValue(await activeAdmin());
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('Admin');
  });

  it('returns 401 for a wrong password', async () => {
    findUnique.mockResolvedValue(await activeAdmin());
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for a deactivated account', async () => {
    findUnique.mockResolvedValue({ ...(await activeAdmin()), isActive: false });
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'secret123' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when the body fails zod validation', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'secret123' });
    expect(res.status).toBe(400);
  });
  it('normalizes email to lowercase and trims whitespace', async () => {
    findUnique.mockResolvedValue(await activeAdmin());
    const res = await request(app).post('/api/auth/login').send({ email: '  A@B.COM  ', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: 'a@b.com' },
      include: { citizenProfile: true }
    });
  });
});
