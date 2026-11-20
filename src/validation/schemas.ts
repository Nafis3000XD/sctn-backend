import { z } from 'zod';

// Registration enforces a real password policy (min 8) for NEW accounts. Login
// only requires a non-empty password so pre-existing/seeded accounts (some with
// short demo passwords) can still authenticate. Emails are trimmed and
// lowercased for consistent case-insensitive lookup; optional profile fields
// are capped to prevent oversized payloads.
export const accountPassword = z.string().min(8, 'Password must be at least 8 characters long')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes');

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email address is required').max(254),
  password: accountPassword,
  fullName: z.string().trim().min(1, 'Full name is required').max(120),
  dob: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Date of birth is invalid'),
  phone: z.string().trim().max(30).optional(),
  gender: z.string().trim().max(20).optional(),
  address: z.string().trim().max(500).optional(),
  emergencyContactName: z.string().trim().max(120).optional(),
  emergencyContactNumber: z.string().trim().max(30).optional(),
  bloodGroup: z.string().trim().max(5).optional()
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email address is required'),
  password: z.string().min(1, 'Password is required')
});

export const respondConsentSchema = z.object({
  requestId: z.string().min(1, 'requestId is required'),
  status: z.enum(['Approved', 'Rejected'], {
    message: 'Consent status must be Approved or Rejected'
  }),
  // Accept numeric or numeric-string durations; cap at one year of minutes.
  durationMinutes: z.coerce.number().int().positive().max(525600).optional()
});
