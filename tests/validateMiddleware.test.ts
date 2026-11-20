import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { validateBody } from '../src/middlewares/validate';

const makeRes = () => {
  const res = {} as Record<string, unknown> & Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
};

const schema = z.object({ name: z.string().min(1, 'name is required') });

describe('validateBody', () => {
  it('calls next and strips unknown keys on success', () => {
    const req = { body: { name: 'Jane', extra: 1 } } as Request;
    const res = makeRes();
    const next = vi.fn();

    validateBody(schema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.body).toEqual({ name: 'Jane' });
  });

  it('responds 400 with a field-prefixed message and does not call next', () => {
    const req = { body: {} } as Request;
    const res = makeRes();
    const next = vi.fn();

    validateBody(schema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('name') }));
    expect(next).not.toHaveBeenCalled();
  });
});
