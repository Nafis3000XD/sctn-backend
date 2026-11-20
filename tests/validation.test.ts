import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, respondConsentSchema } from '../src/validation/schemas';

describe('registerSchema', () => {
  const valid = {
    email: 'user@example.com',
    password: 'password123',
    fullName: 'Jane Doe',
    dob: '1990-01-01'
  };

  it('accepts a valid registration payload', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('trims email and full name', () => {
    const r = registerSchema.safeParse({ ...valid, email: '  user@example.com  ', fullName: '  Jane Doe  ' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe('user@example.com');
      expect(r.data.fullName).toBe('Jane Doe');
    }
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(registerSchema.safeParse({ ...valid, password: '123' }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(registerSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects a missing full name', () => {
    const { fullName, ...rest } = valid;
    expect(registerSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects an invalid date of birth', () => {
    expect(registerSchema.safeParse({ ...valid, dob: 'not-a-date' }).success).toBe(false);
  });

  it('strips unknown fields (e.g. attacker-supplied role)', () => {
    const r = registerSchema.safeParse({ ...valid, role: 'Admin' } as Record<string, unknown>);
    expect(r.success).toBe(true);
    if (r.success) expect((r.data as Record<string, unknown>).role).toBeUndefined();
  });
});

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });

  it('accepts a short legacy password (no min-length on login)', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '1234' }).success).toBe(true);
  });

  it('rejects a missing password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
  });

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('respondConsentSchema', () => {
  it('accepts Approved with a numeric duration', () => {
    expect(respondConsentSchema.safeParse({ requestId: 'r1', status: 'Approved', durationMinutes: 60 }).success).toBe(true);
  });

  it('coerces a numeric-string duration', () => {
    const r = respondConsentSchema.safeParse({ requestId: 'r1', status: 'Approved', durationMinutes: '120' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.durationMinutes).toBe(120);
  });

  it('accepts Rejected without a duration', () => {
    expect(respondConsentSchema.safeParse({ requestId: 'r1', status: 'Rejected' }).success).toBe(true);
  });

  it('rejects an invalid status', () => {
    expect(respondConsentSchema.safeParse({ requestId: 'r1', status: 'Maybe' }).success).toBe(false);
  });

  it('rejects a negative duration', () => {
    expect(respondConsentSchema.safeParse({ requestId: 'r1', status: 'Approved', durationMinutes: -5 }).success).toBe(false);
  });
});
