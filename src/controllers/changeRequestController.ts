import { ChangeCategory, ChangeRequestStatus, Prisma } from '@prisma/client';
import type { RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import { createHmac, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../db';
import { type AuthRequest, getJwtSecret } from '../middlewares/authMiddleware';
import { categories, formCatalog, suggestCorrection, validateChanges, type ChangeValue } from '../utils/changeRequestFields';

export const verifyCorrectionSchema = z.strictObject({
  password: z.string().min(1).max(128),
  message: z.string().trim().max(300).default(''),
  category: z.enum(ChangeCategory).optional()
});
export const submitCorrectionSchema = z.strictObject({
  verification: z.string().max(2048),
  category: z.enum(ChangeCategory),
  changes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .refine(fields => Object.keys(fields).length >= 1 && Object.keys(fields).length <= 20, 'Select 1 to 20 fields.'),
  reason: z.string().trim().min(5, 'Explain why the information needs correcting.').max(1000)
});
export const reviewCorrectionSchema = z.strictObject({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().trim().max(1000).optional()
}).refine(review => review.decision !== 'REJECTED' || !!review.note, {
  path: ['note'],
  message: 'Give the citizen a reason for declining.'
});

const grantSchema = z.object({
  sub: z.string(),
  jti: z.uuid(),
  iat: z.number(),
  context: z.string()
});

function accountContext(req: AuthRequest) {
  const ip = req.ip ?? req.socket.remoteAddress ?? '';
  const address = ip.replace(/^::ffff:/i, '');
  const version = isIP(address);
  const network = version === 4 ? address.replace(/\.\d+$/, '.x') : version === 6 ? 'IPv6 (masked)' : 'Unavailable';
  const context = createHmac('sha256', getJwtSecret())
    .update(JSON.stringify(['profile-correction', req.get('authorization'), ip])).digest('base64url');
  return { context, network };
}

const grantOptions = { audience: 'sctn-profile-correction', algorithms: ['HS256' as const] };
const grantSecret = () => createHmac('sha256', getJwtSecret()).update('profile-correction-grant').digest();

export const verifyCorrection: RequestHandler = async (req: AuthRequest, res) => {
  const { password, category, message }: z.infer<typeof verifyCorrectionSchema> = req.body;
  const account = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, passwordHash: true, isActive: true }
  });
  if (!account?.isActive || !await bcrypt.compare(password, account.passwordHash)) {
    res.status(403).json({ message: 'Password verification failed.' });
    return;
  }
  const { context } = accountContext(req);
  const verification = jwt.sign({ context }, grantSecret(), {
    algorithm: 'HS256', audience: grantOptions.audience, expiresIn: '15m', subject: account.id, jwtid: randomUUID()
  });
  res.json({ verification, suggestion: suggestCorrection(message, category), catalog: formCatalog });
};

const correctionsProfile = Prisma.validator<Prisma.CitizenProfileInclude>()({
  user: { select: { isActive: true } },
  identityInfo: true, educationInfo: true, financialInfo: true, medicalInfo: true, crimeInfo: true
});
type CorrectionProfile = Prisma.CitizenProfileGetPayload<{ include: typeof correctionsProfile }>;
const findProfile = (tx: Prisma.TransactionClient, userId: string) => tx.citizenProfile.findUnique({
  where: { userId }, include: correctionsProfile
});

function recordFor(profile: CorrectionProfile, category: ChangeCategory): Record<string, unknown> {
  return ({
    PERSONAL: profile, IDENTITY: profile.identityInfo, EDUCATION: profile.educationInfo,
    FINANCIAL: profile.financialInfo, MEDICAL: profile.medicalInfo, CRIME: profile.crimeInfo
  })[category] ?? {};
}

function valueFor(current: Record<string, unknown>, key: string): ChangeValue {
  const value = current[key];
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return key === 'hasCriminalRecord' ? false : null;
}

function validateRelatedDates(current: Record<string, unknown>, changes: Record<string, ChangeValue>) {
  const updated = { ...current, ...changes };
  for (const prefix of ['passport', 'drivingLicense']) {
    const issue = prefix + 'IssueDate';
    const expiry = prefix + 'ExpiryDate';
    if (!Object.hasOwn(changes, issue) && !Object.hasOwn(changes, expiry)) continue;
    if (typeof updated[issue] === 'string' && typeof updated[expiry] === 'string'
      && updated[issue] && updated[expiry] && updated[issue] > updated[expiry]) {
      return { [expiry]: 'The expiration date must be on or after the issue date.' };
    }
  }
  return {};
}

const identityIdentifiers = ['nid', 'passport', 'drivingLicense', 'tradeLicense', 'tin', 'familyCard', 'farmerCard'];

async function conflictingIdentifier(category: ChangeCategory, profileId: string, changes: Record<string, ChangeValue>) {
  if (category === 'IDENTITY') {
    const identifiers = identityIdentifiers.flatMap(key => changes[key] ? [{ [key]: changes[key] }] : []);
    if (identifiers.length) {
      const duplicate = await prisma.identityInfo.findFirst({
        where: { citizenProfileId: { not: profileId }, OR: identifiers },
        select: { id: true }
      });
      return !!duplicate;
    }
  }
  if (category === 'FINANCIAL' && typeof changes.tin === 'string' && changes.tin) {
    return !!await prisma.financialInfo.findFirst({
      where: { citizenProfileId: { not: profileId }, tin: changes.tin }, select: { id: true }
    });
  }
  return false;
}

const summarySelect = {
  id: true, category: true, status: true, createdAt: true, reviewedAt: true, reviewNote: true,
  reason: true, proposedValues: true, priorValues: true
} satisfies Prisma.ProfileChangeRequestSelect;

export const submitCorrection: RequestHandler = async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const { verification, category, changes, reason }: z.infer<typeof submitCorrectionSchema> = req.body;
  const { context, network } = accountContext(req);
  let grant: z.infer<typeof grantSchema>;
  try {
    grant = grantSchema.parse(jwt.verify(verification, grantSecret(), grantOptions));
  } catch {
    res.status(403).json({ message: 'Verify your password again to submit this request.', code: 'VERIFY_AGAIN' });
    return;
  }
  if (grant.sub !== userId || grant.context !== context) {
    res.status(403).json({ message: 'Your session or network changed. Verify your password again.', code: 'VERIFY_AGAIN' });
    return;
  }

  const valid = validateChanges(category, changes);
  if (Object.keys(valid.errors).length) {
    res.status(422).json({ message: 'Check the highlighted fields.', errors: valid.errors });
    return;
  }

  const existing = await prisma.profileChangeRequest.findUnique({ where: { id: grant.jti }, select: summarySelect });
  if (existing) {
    const proposed = existing.proposedValues as Record<string, ChangeValue>;
    if (existing.category !== category || existing.reason !== reason
      || Object.entries(proposed).some(([key, value]) => valid.changes[key] !== value)) {
      res.status(409).json({ message: 'This verification was already used. Verify again for a new request.', code: 'VERIFY_AGAIN' });
      return;
    }
    res.json(existing);
    return;
  }

  const profile = await findProfile(prisma, userId);
  if (!profile?.user.isActive) {
    res.status(404).json({ message: 'Active citizen profile not found.' });
    return;
  }
  const current = recordFor(profile, category);
  const changed = Object.entries(valid.changes).filter(([field, value]) => valueFor(current, field) !== value);
  if (!changed.length) {
    res.status(422).json({ message: 'Enter at least one value that differs from your saved information.' });
    return;
  }

  const priorValues = Object.fromEntries(changed.map(([field]) => [field, valueFor(current, field)]));
  const proposedValues = Object.fromEntries(changed);
  const dateErrors = validateRelatedDates(current, proposedValues);
  if (Object.keys(dateErrors).length) {
    res.status(422).json({ message: 'Check the related dates.', errors: dateErrors });
    return;
  }
  if (await conflictingIdentifier(category, profile.id, proposedValues)) {
    res.status(422).json({ message: 'A proposed identifier is already in use. Check it or contact support.' });
    return;
  }

  try {
    const saved = await prisma.$transaction(async tx => {
      const request = await tx.profileChangeRequest.create({
        data: {
          id: grant.jti, citizenId: userId, category, priorValues, proposedValues, reason,
          verifiedAt: new Date(grant.iat * 1000), network
        },
        select: summarySelect
      });
      await tx.auditLog.create({ data: { userId, action: 'SUBMIT_PROFILE_CHANGE_REQUEST', entity: 'ProfileChangeRequest' } });
      return request;
    });
    res.status(201).json(saved);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ message: 'This verification already submitted a request. Check your request history.', code: 'VERIFY_AGAIN' });
      return;
    }
    throw error;
  }
};

export const pendingCorrectionsCount: RequestHandler = async (_req, res) => {
  const count = await prisma.profileChangeRequest.count({ where: { status: 'PENDING' } });
  res.json({ count });
};

const pageSize = 30;
const listQuery = z.object({ cursor: z.uuid().optional(), status: z.enum(ChangeRequestStatus).optional() });

export function listCorrections(admin: boolean): RequestHandler {
  return async (req: AuthRequest, res) => {
    const query = listQuery.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ message: 'Invalid request list filters.' });
      return;
    }
    const { cursor, status } = query.data;
    const rows = await prisma.profileChangeRequest.findMany({
      where: admin ? { status } : { citizenId: req.user!.userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: pageSize + 1,
      select: {
        ...summarySelect,
        verifiedAt: admin,
        network: admin,
        citizen: admin ? { select: { email: true, isActive: true, citizenProfile: { select: { citizenId: true, fullName: true } } } } : false
      }
    });
    const items = rows.slice(0, pageSize);
    const labeled = items.map(item => ({
      ...item,
      labels: Object.fromEntries(categories[item.category].fields
        .filter(field => Object.hasOwn(item.proposedValues as object, field.key))
        .map(field => [field.key, field.label]))
    }));
    res.json({ items: labeled, nextCursor: rows.length > pageSize ? items.at(-1)?.id : null });
  };
}

function statusResets(category: ChangeCategory, changes: Record<string, ChangeValue>) {
  const fields = Object.keys(changes);
  const groups: Partial<Record<ChangeCategory, Record<string, string[]>>> = {
    IDENTITY: Object.fromEntries(['nid', 'passport', 'drivingLicense', 'tradeLicense', 'tin', 'landRecord', 'familyCard', 'farmerCard']
      .map(prefix => [prefix + 'Status', fields.filter(field => field.startsWith(prefix))])),
    EDUCATION: {
      sscStatus: fields.filter(field => field.startsWith('ssc')),
      hscStatus: fields.filter(field => field.startsWith('hsc')),
      universityStatus: fields.filter(field => !field.startsWith('ssc') && !field.startsWith('hsc'))
    },
    FINANCIAL: {
      occupationStatus: ['occupation', 'employmentStatus', 'companyName', 'workExperience', 'officeAddressEmail'],
      incomeStatus: ['monthlyIncome', 'netTakeHomePay', 'primaryIncomeSource', 'secondaryIncome', 'preferredPayoutMethod'],
      taxComplianceStatus: ['tin', 'taxZoneCircle', 'taxRegistrationStatus', 'taxpayerAssessmentCategory'],
      taxClearanceStatusBadge: ['taxClearanceStatus', 'lastReturnSubmissionDate', 'taxYearOfLastReturn', 'acknowledgmentReceiptNumber', 'totalTaxPaid'],
      wealthStatus: ['bankAccountNumber', 'bankNameBranch', 'routingNumber', 'mfsWallet']
    },
    CRIME: { clearanceStatus: ['clearanceCertificateNumber', 'hasCriminalRecord', 'pendingCharges', 'recordDetails'] }
  };
  const reset = Object.fromEntries(Object.entries(groups[category] ?? {})
    .filter(([, keys]) => keys.some(key => Object.hasOwn(changes, key))).map(([key]) => [key, 'Pending Review']));
  return { ...reset, ...(reset.incomeStatus ? { incomeVerificationBadge: 'Self-Declared' } : {}), status: 'Pending Review' };
}

async function applyCorrection(
  tx: Prisma.TransactionClient,
  profile: CorrectionProfile,
  category: ChangeCategory,
  changes: Record<string, ChangeValue>
) {
  if (category === 'PERSONAL') {
    const data = { ...changes, ...(typeof changes.dob === 'string' ? { dob: new Date(changes.dob) } : {}) };
    await tx.citizenProfile.update({ where: { id: profile.id }, data });
    return;
  }
  const update = { ...changes, ...statusResets(category, changes) };
  const upsert = { update, create: update };
  const relations = { IDENTITY: 'identityInfo', EDUCATION: 'educationInfo', FINANCIAL: 'financialInfo', MEDICAL: 'medicalInfo', CRIME: 'crimeInfo' } as const;
  await tx.citizenProfile.update({ where: { id: profile.id }, data: { [relations[category]]: { upsert } } });
}

class ReviewConflict extends Error {}

export const reviewCorrection: RequestHandler = async (req: AuthRequest, res) => {
  const reviewerId = req.user!.userId;
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ message: 'Invalid request ID.' });
    return;
  }

  const { decision, note }: z.infer<typeof reviewCorrectionSchema> = req.body;
  try {
    const result = await prisma.$transaction(async tx => {
      const request = await tx.profileChangeRequest.findUnique({ where: { id: id.data } });
      if (!request) return null;
      if (request.status !== 'PENDING') throw new ReviewConflict('This request has already been reviewed.');

      if (decision === 'APPROVED') {
        const profile = await findProfile(tx, request.citizenId);
        if (!profile?.user.isActive) throw new ReviewConflict('This citizen no longer has an active profile. Decline the request.');
        const current = recordFor(profile, request.category);
        const prior = request.priorValues as Record<string, ChangeValue>;
        if (Object.entries(prior).some(([key, value]) => valueFor(current, key) !== value)) {
          throw new ReviewConflict('The saved information changed since submission. Decline this request and ask the citizen to resubmit.');
        }
        const proposed = validateChanges(request.category, request.proposedValues as Record<string, unknown>);
        if (Object.keys(proposed.errors).length || Object.keys(validateRelatedDates(current, proposed.changes)).length) {
          throw new ReviewConflict('The proposed values no longer pass validation. Decline and ask the citizen to resubmit.');
        }
        await applyCorrection(tx, profile, request.category, proposed.changes);
      }

      const updated = await tx.profileChangeRequest.update({
        where: { id: request.id },
        data: { status: decision, reviewerId, reviewedAt: new Date(), reviewNote: note || null },
        select: summarySelect
      });
      await tx.auditLog.create({
        data: { userId: reviewerId, action: decision === 'APPROVED' ? 'APPROVE_PROFILE_CHANGE' : 'REJECT_PROFILE_CHANGE', entity: 'ProfileChangeRequest' }
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!result) {
      res.status(404).json({ message: 'Change request not found.' });
      return;
    }
    res.json(result);
  } catch (error) {
    if (error instanceof ReviewConflict) {
      res.status(409).json({ message: error.message });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
      res.status(409).json({
        message: error.code === 'P2002'
          ? 'A proposed identifier is already in use. Decline and ask the citizen to resubmit.'
          : 'Another update happened at the same time. Refresh and review again.'
      });
      return;
    }
    throw error;
  }
};

export const correctionLabel = (category: ChangeCategory) => categories[category].label;
