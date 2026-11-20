import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('../src/db', () => ({
  default: {
    user: { findUnique: vi.fn() },
    consentRequest: { findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({}) }
  }
}));

import request from 'supertest';
import prisma from '../src/db';
import app from '../src/app';

const userFindUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;
const consentRequestFindUnique = prisma.consentRequest.findUnique as unknown as ReturnType<typeof vi.fn>;
const consentRequestUpdate = prisma.consentRequest.update as unknown as ReturnType<typeof vi.fn>;

const SECRET = 'dev_only_change_me';
const token = (payload: object) => jwt.sign(payload, SECRET);

describe('POST /api/consent/revoke', () => {
  beforeEach(() => {
    userFindUnique.mockReset();
    consentRequestFindUnique.mockReset();
    consentRequestUpdate.mockReset();
  });

  it('rejects unauthenticated requests (401)', async () => {
    const res = await request(app).post('/api/consent/revoke').send({ requestId: 'r1' });
    expect(res.status).toBe(401);
  });

  it('revokes consent request and sets status to Expired', async () => {
    userFindUnique.mockResolvedValue({ id: 'u1', isActive: true, role: 'Citizen' });
    consentRequestFindUnique.mockResolvedValue({ id: 'r1', targetId: 'u1', status: 'Approved' });
    consentRequestUpdate.mockResolvedValue({ id: 'r1', status: 'Expired' });

    const authHeader = `Bearer ${token({ userId: 'u1', role: 'Citizen' })}`;
    const res = await request(app)
      .post('/api/consent/revoke')
      .set('Authorization', authHeader)
      .send({ requestId: 'r1' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Access removed successfully');
    expect(consentRequestUpdate).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: {
        status: 'Expired',
        expiryTime: expect.any(Date)
      }
    });
  });

  it('returns 400 if target request is not currently Approved', async () => {
    userFindUnique.mockResolvedValue({ id: 'u1', isActive: true, role: 'Citizen' });
    consentRequestFindUnique.mockResolvedValue({ id: 'r1', targetId: 'u1', status: 'Pending' });

    const authHeader = `Bearer ${token({ userId: 'u1', role: 'Citizen' })}`;
    const res = await request(app)
      .post('/api/consent/revoke')
      .set('Authorization', authHeader)
      .send({ requestId: 'r1' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Only approved consent requests can be revoked');
  });
});
