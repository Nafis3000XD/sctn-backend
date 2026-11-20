import { Response } from 'express';
import prisma from '../db';
import { removeUploads, saveUpload } from '../utils/upload';
import { AuthRequest } from '../middlewares/authMiddleware';
import { checkAndExpireRequests } from '../utils/consentHelper';
import { consentAllowsRule, getActiveConsentScopes, hasMedicalVisitConsent, normalizeList } from '../utils/consentScopes';

const requestCategories: Record<string, readonly string[]> = {
  Admin: ['basic', 'identity', 'education', 'financial', 'medical', 'crime'],
  JobInterviewer: ['basic', 'identity', 'education', 'crime'],
  UniversityAuthority: ['basic', 'identity', 'education', 'crime'],
  BankLoanOfficer: ['basic', 'identity', 'financial', 'medical', 'crime'],
  Doctor: ['basic', 'medical'],
  IntelligenceDepartment: ['basic', 'identity', 'crime']
};

const allowedRoles = new Set(['JobInterviewer', 'BankLoanOfficer', 'UniversityAuthority', 'Admin', 'Doctor', 'IntelligenceDepartment']);
export const requestAccess = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requesterId = req.user?.userId;
    if (!requesterId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const { citizenId, requestedData } = req.body;
    const requestedCategories = normalizeList(requestedData);

    if (!citizenId || requestedCategories.length === 0) {
      res.status(400).json({ message: 'Citizen ID and requested data are required.' });
      return;
    }

    const role = req.user?.role;
    if (!role || !allowedRoles.has(role)) {
      res.status(403).json({ message: 'Access denied: unsupported verifier role.' });
      return;
    }

    if (requestedCategories.some((category) => !requestCategories[role].includes(category.replace(/ info$/, '')))) {
      res.status(403).json({ message: 'Your role cannot request one or more of these data categories.' });
      return;
    }

    const targetUser = await prisma.user.findFirst({
      where: { citizenProfile: { citizenId } }
    });

    if (!targetUser) {
      res.status(404).json({ message: 'Citizen not found' });
      return;
    }

    const consentRequest = await prisma.consentRequest.create({
      data: {
        requesterId,
        targetId: targetUser.id,
        requestedData: JSON.stringify(requestedCategories),
        status: 'Pending'
      }
    });

    // Audit request access
    await prisma.auditLog.create({
      data: {
        userId: requesterId,
        action: 'REQUEST_CONSENT',
        entity: 'ConsentRequest'
      }
    });

    res.status(201).json({ message: 'Consent request sent', consentRequest });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const evaluatePolicy = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requesterId = req.user?.userId;
    const { citizenId, rules } = req.body; // rules: [{ field: 'age', operator: '>=', value: 18 }]

    if (!requesterId || typeof citizenId !== 'string' || !Array.isArray(rules) || rules.length === 0 || rules.length > 50
      || rules.some((rule) => !rule || typeof rule.field !== 'string' || typeof rule.operator !== 'string')) {
      res.status(400).json({ message: 'Citizen ID and at least one rule are required.' });
      return;
    }

    const role = req.user?.role;
    if (!role || !allowedRoles.has(role)) {
      res.status(403).json({ message: 'Access denied: unsupported verifier role.' });
      return;
    }

    // Enforce role-based privacy boundary checks on rule evaluation
    if (role === 'JobInterviewer' || role === 'UniversityAuthority') {
      const hasFinancial = rules.some((r: any) =>
        r.field === 'income' || r.field === 'tax_clearance' ||
        r.field === 'net_take_home_pay' || r.field === 'total_tax_paid' ||
        r.field === 'employment_status' || r.field === 'tin' || r.field === 'primary_income_source'
      );
      if (hasFinancial) {
        res.status(403).json({ message: 'Access denied: your role is not permitted to evaluate financial records.' });
        return;
      }
    } else if (role === 'BankLoanOfficer') {
      const hasEducation = rules.some((r: any) => r.field === 'ssc_gpa' || r.field === 'cgpa');
      if (hasEducation) {
        res.status(403).json({ message: 'Access denied: your role is not permitted to evaluate academic records.' });
        return;
      }
    } else if (role === 'Doctor') {
      const hasForbidden = rules.some((r: any) =>
        r.field === 'income' || r.field === 'tax_clearance' ||
        r.field === 'net_take_home_pay' || r.field === 'total_tax_paid' ||
        r.field === 'employment_status' || r.field === 'tin' || r.field === 'primary_income_source' ||
        r.field === 'ssc_gpa' || r.field === 'cgpa' ||
        r.field === 'has_criminal_record'
      );
      if (hasForbidden) {
        res.status(403).json({ message: 'Access denied: Doctors are only permitted to evaluate basic and medical records.' });
        return;
      }
    } else if (role === 'IntelligenceDepartment') {
      const medicalFields = new Set(['blood_type', 'allergies', 'chronic_conditions', 'medical_history', 'immunization_status', 'insurance_provider', 'insurance_policy_number']);
      const hasForbidden = rules.some((r: any) =>
        r.field === 'income' || r.field === 'tax_clearance' ||
        r.field === 'net_take_home_pay' || r.field === 'total_tax_paid' ||
        r.field === 'employment_status' || r.field === 'tin' || r.field === 'primary_income_source' ||
        r.field === 'ssc_gpa' || r.field === 'cgpa' ||
        medicalFields.has(r.field)
      );
      if (hasForbidden) {
        res.status(403).json({ message: 'Access denied: Intelligence Department is only permitted to evaluate basic, identity, and criminal records.' });
        return;
      }
    }

    // Verify active consent exists
    await checkAndExpireRequests();
    const targetUser = await prisma.user.findFirst({ where: { citizenProfile: { citizenId } } });
    if (!targetUser) {
      res.status(404).json({ message: 'Citizen not found' });
      return;
    }

    const scopes = await getActiveConsentScopes(requesterId, targetUser.id);

    if (scopes.length === 0) {
      res.status(403).json({ message: 'No active consent found or consent expired' });
      return;
    }

    const unauthorizedRule = rules.find((rule: any) => !scopes.some((scope) => consentAllowsRule(scope, rule.field)));
    if (unauthorizedRule) {
      res.status(403).json({
        message: `Approved consent does not include permission to evaluate ${unauthorizedRule.field}.`
      });
      return;
    }

    // Evaluate policies using Zero Knowledge approach
    const profile = await prisma.citizenProfile.findUnique({
      where: { userId: targetUser.id },
      include: { educationInfo: true, financialInfo: true, medicalInfo: true, crimeInfo: true }
    });

    if (!profile) {
      res.status(404).json({ message: 'Profile incomplete' });
      return;
    }

    const results = rules.map((rule: any) => {
      let passed = false;
      let actualValue: any = null;

      if (rule.field === 'age') {
        const today = new Date();
        const dob = profile.dob;
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
        actualValue = age;
      } else if (rule.field === 'income' && profile.financialInfo) {
        actualValue = profile.financialInfo.monthlyIncome;
      } else if (rule.field === 'net_take_home_pay' && profile.financialInfo) {
        actualValue = profile.financialInfo.netTakeHomePay;
      } else if (rule.field === 'total_tax_paid' && profile.financialInfo) {
        actualValue = profile.financialInfo.totalTaxPaid;
      } else if (rule.field === 'employment_status' && profile.financialInfo) {
        actualValue = profile.financialInfo.employmentStatus;
      } else if (rule.field === 'tin' && profile.financialInfo) {
        actualValue = profile.financialInfo.tin;
      } else if (rule.field === 'primary_income_source' && profile.financialInfo) {
        actualValue = profile.financialInfo.primaryIncomeSource;
      } else if (rule.field === 'ssc_gpa' && profile.educationInfo) {
        actualValue = profile.educationInfo.sscGpa;
      } else if (rule.field === 'cgpa' && profile.educationInfo) {
        actualValue = profile.educationInfo.cgpa;
      } else if (rule.field === 'tax_clearance' && profile.financialInfo) {
        actualValue = profile.financialInfo.taxClearanceStatus === 'Compliant / Up-to-Date';
      } else if (rule.field === 'blood_type' && profile.medicalInfo) {
        actualValue = profile.medicalInfo.bloodType;
      } else if (rule.field === 'allergies' && profile.medicalInfo) {
        actualValue = profile.medicalInfo.allergies;
      } else if (rule.field === 'chronic_conditions' && profile.medicalInfo) {
        actualValue = profile.medicalInfo.chronicConditions;
      } else if (rule.field === 'medical_history' && profile.medicalInfo) {
        actualValue = profile.medicalInfo.medicalHistory;
      } else if (rule.field === 'immunization_status' && profile.medicalInfo) {
        actualValue = profile.medicalInfo.immunizationStatus;
      } else if (rule.field === 'insurance_provider' && profile.medicalInfo) {
        actualValue = profile.medicalInfo.insuranceProvider;
      } else if (rule.field === 'insurance_policy_number' && profile.medicalInfo) {
        actualValue = profile.medicalInfo.insurancePolicyNumber;
      } else if (rule.field === 'has_criminal_record' && profile.crimeInfo) {
        actualValue = profile.crimeInfo.hasCriminalRecord;
      }

      if (actualValue !== null) {
        const ruleVal = (typeof actualValue === 'number' && typeof rule.value !== 'number')
          ? Number(rule.value)
          : rule.value;

        if (rule.operator === '>=' && actualValue >= ruleVal) passed = true;
        if (rule.operator === '<=' && actualValue <= ruleVal) passed = true;
        if (rule.operator === '==' && actualValue === ruleVal) passed = true;
      }

      return { rule, result: passed ? 'PASSED' : 'FAILED' };
    });

    // Audit policy evaluation
    await prisma.auditLog.create({
      data: {
        userId: requesterId,
        action: 'EVALUATE_POLICY_ZK',
        entity: 'ConsentRequest'
      }
    });

    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getVerifierConsents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await checkAndExpireRequests();
    const requesterId = req.user?.userId;
    if (!requesterId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const consents = await prisma.consentRequest.findMany({
      where: { requesterId },
      include: {
        target: {
          select: {
            email: true,
            citizenProfile: {
              select: {
                citizenId: true,
                fullName: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(consents);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getMedicalVisitLogsByDoctor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requesterId = req.user?.userId;
    const role = req.user?.role;
    if (!requesterId || (role !== 'Doctor' && role !== 'Admin')) {
      res.status(403).json({ message: 'Access denied: only Doctors can view visit records.' });
      return;
    }

    const citizenId = req.params.citizenId as string;
    if (!citizenId) {
      res.status(400).json({ message: 'Citizen ID is required.' });
      return;
    }

    const targetUser = (await prisma.user.findFirst({
      where: { citizenProfile: { citizenId } },
      include: { citizenProfile: true }
    })) as any;
    if (!targetUser || !targetUser.citizenProfile) {
      res.status(404).json({ message: 'Citizen profile not found' });
      return;
    }

    if (role !== 'Admin' && !await hasMedicalVisitConsent(requesterId, targetUser.id)) {
      res.status(403).json({ message: 'An active medical consent is required for this patient.' });
      return;
    }

    const medicalInfo = await prisma.medicalInfo.findUnique({
      where: { citizenProfileId: targetUser.citizenProfile.id },
      include: {
        visitLogs: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    res.json(medicalInfo?.visitLogs || []);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const addMedicalVisitLogByDoctor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requesterId = req.user?.userId;
    const role = req.user?.role;
    if (!requesterId || (role !== 'Doctor' && role !== 'Admin')) {
      res.status(403).json({ message: 'Access denied: only Doctors can log visit records.' });
      return;
    }

    const citizenId = req.body.citizenId as string;
    const doctorName = req.body.doctorName as string;
    const visitDate = req.body.visitDate as string;
    const hospitalName = req.body.hospitalName as string;
    const reason = req.body.reason as string;
    if (!citizenId || !doctorName || !visitDate || !hospitalName) {
      res.status(400).json({ message: 'Citizen ID, Doctor name, hospital name and visit date are required' });
      return;
    }

    const targetUser = (await prisma.user.findFirst({
      where: { citizenProfile: { citizenId } },
      include: { citizenProfile: true }
    })) as any;
    if (!targetUser || !targetUser.citizenProfile) {
      res.status(404).json({ message: 'Citizen profile not found' });
      return;
    }

    if (role !== 'Admin' && !await hasMedicalVisitConsent(requesterId, targetUser.id)) {
      res.status(403).json({ message: 'An active medical consent is required for this patient.' });
      return;
    }

    const profileId = targetUser.citizenProfile.id as string;
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const image = files?.prescription?.[0];
    const pdf = files?.prescriptionPdf?.[0];

    const visitLog = await prisma.$transaction(async (tx) => {
      const medicalInfo = await tx.medicalInfo.upsert({
        where: { citizenProfileId: profileId },
        create: { citizenProfileId: profileId },
        update: {},
        select: { id: true }
      });
      const prescriptionPic = image ? await saveUpload(tx, image, targetUser.id, 'Prescription') : null;
      const prescriptionPdf = pdf ? await saveUpload(tx, pdf, targetUser.id, 'Prescription') : null;
      const record = await tx.hospitalVisitLog.create({
        data: { medicalInfoId: medicalInfo.id, doctorName, hospitalName, visitDate, prescriptionPic,
          reason: reason?.trim() || null, prescriptionPdf }
      });
      await tx.auditLog.create({
        data: { userId: requesterId, action: 'ADD_MEDICAL_VISIT_LOG_BY_DOCTOR', entity: 'HospitalVisitLog' }
      });
      return record;
    });

    res.status(201).json({ message: 'Visit log added successfully', visitLog });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteMedicalVisitLogByDoctor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requesterId = req.user?.userId;
    const role = req.user?.role;
    if (!requesterId || role !== 'Admin') {
      res.status(403).json({ message: 'Access denied: only Admins can delete visit records.' });
      return;
    }

    const id = req.params.id as string;
    const visitLog = (await prisma.hospitalVisitLog.findUnique({
      where: { id },
      include: {
        medicalInfo: {
          include: {
            citizenProfile: true
          }
        }
      }
    })) as any;

    if (!visitLog) {
      res.status(404).json({ message: 'Visit log not found' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.hospitalVisitLog.delete({ where: { id } });
      await removeUploads(tx, [visitLog.prescriptionPic, visitLog.prescriptionPdf]);
      await tx.auditLog.create({
        data: { userId: requesterId, action: 'DELETE_MEDICAL_VISIT_LOG_BY_DOCTOR', entity: 'HospitalVisitLog' }
      });
    });

    res.json({ message: 'Visit log deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

const emptyToNull = <T>(value: T): T | null =>
  typeof value === 'string' && value.trim() === '' ? null : value;

// Intelligence Fine Logs Controllers
export const getFineLogsByIntelligence = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requesterId = req.user?.userId;
    const role = req.user?.role;
    if (!requesterId || (role !== 'IntelligenceDepartment' && role !== 'Admin')) {
      res.status(403).json({ message: 'Access denied: insufficient permissions.' });
      return;
    }

    const citizenId = req.params.citizenId as string;
    if (!citizenId) {
      res.status(400).json({ message: 'Citizen ID is required.' });
      return;
    }

    const targetUser = (await prisma.user.findFirst({
      where: { citizenProfile: { citizenId } },
      include: { citizenProfile: true }
    })) as any;
    if (!targetUser || !targetUser.citizenProfile) {
      res.status(404).json({ message: 'Citizen profile not found' });
      return;
    }

    const crimeInfo = await prisma.crimeInfo.findUnique({
      where: { citizenProfileId: targetUser.citizenProfile.id },
      include: {
        fineLogs: {
          orderBy: {
            fineDate: 'desc'
          }
        }
      }
    });

    res.json(crimeInfo?.fineLogs || []);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const addFineLogByIntelligence = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requesterId = req.user?.userId;
    const role = req.user?.role;
    if (!requesterId || role !== 'Admin') {
      res.status(403).json({ message: 'Access denied: only Admins can log fine records.' });
      return;
    }

    const { citizenId, fineReason, fineAmount, fineDate } = req.body;
    if (!citizenId || !fineReason) {
      res.status(400).json({ message: 'Citizen ID and Fine reason are required' });
      return;
    }

    const targetUser = (await prisma.user.findFirst({
      where: { citizenProfile: { citizenId } },
      include: { citizenProfile: true }
    })) as any;
    if (!targetUser || !targetUser.citizenProfile) {
      res.status(404).json({ message: 'Citizen profile not found' });
      return;
    }

    let crimeInfo = await prisma.crimeInfo.findUnique({
      where: { citizenProfileId: targetUser.citizenProfile.id }
    });

    if (!crimeInfo) {
      crimeInfo = await prisma.crimeInfo.create({
        data: {
          citizenProfileId: targetUser.citizenProfile.id,
          status: 'Pending Review'
        }
      });
    }

    const fineLog = await prisma.fineLog.create({
      data: {
        crimeInfoId: crimeInfo.id,
        fineReason,
        fineAmount: fineAmount ? parseFloat(String(fineAmount)) : null,
        fineDate: fineDate ? new Date(fineDate) : new Date(),
        isCleared: false
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: requesterId,
        action: 'ADD_FINE_LOG_BY_INTELLIGENCE',
        entity: 'FineLog'
      }
    });

    res.status(201).json({ message: 'Fine log added successfully', fineLog });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateFineStatusByIntelligence = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requesterId = req.user?.userId;
    const role = req.user?.role;
    if (!requesterId || role !== 'Admin') {
      res.status(403).json({ message: 'Access denied: only Admins can update fine status.' });
      return;
    }

    const fineLogId = req.params.id as string;
    const { isCleared, clearanceDate, clearanceNotes } = req.body;

    const fineLog = (await prisma.fineLog.findUnique({
      where: { id: fineLogId },
      include: {
        crimeInfo: {
          include: {
            citizenProfile: true
          }
        }
      }
    })) as any;

    if (!fineLog) {
      res.status(404).json({ message: 'Fine log not found' });
      return;
    }

    const updatedFineLog = await prisma.fineLog.update({
      where: { id: fineLogId },
      data: {
        isCleared: typeof isCleared === 'boolean' ? isCleared : fineLog.isCleared,
        clearanceDate: isCleared && clearanceDate ? new Date(clearanceDate) : (isCleared ? new Date() : null),
        clearanceNotes: emptyToNull(clearanceNotes)
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: requesterId,
        action: 'UPDATE_FINE_STATUS_BY_INTELLIGENCE',
        entity: 'FineLog'
      }
    });

    res.json({ message: 'Fine status updated successfully', fineLog: updatedFineLog });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteFineLogByIntelligence = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requesterId = req.user?.userId;
    const role = req.user?.role;
    if (!requesterId || role !== 'Admin') {
      res.status(403).json({ message: 'Access denied: only Admins can delete fine records.' });
      return;
    }

    const id = req.params.id as string;
    const fineLog = (await prisma.fineLog.findUnique({
      where: { id },
      include: {
        crimeInfo: {
          include: {
            citizenProfile: true
          }
        }
      }
    })) as any;

    if (!fineLog) {
      res.status(404).json({ message: 'Fine log not found' });
      return;
    }

    await prisma.fineLog.delete({
      where: { id }
    });

    await prisma.auditLog.create({
      data: {
        userId: requesterId,
        action: 'DELETE_FINE_LOG_BY_INTELLIGENCE',
        entity: 'FineLog'
      }
    });

    res.json({ message: 'Fine log deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Intelligence Crime Logs Controllers
export const getCrimeLogsByIntelligence = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requesterId = req.user?.userId;
    const role = req.user?.role;
    if (!requesterId || (role !== 'IntelligenceDepartment' && role !== 'Admin')) {
      res.status(403).json({ message: 'Access denied: insufficient permissions.' });
      return;
    }

    const citizenId = req.params.citizenId as string;
    if (!citizenId) {
      res.status(400).json({ message: 'Citizen ID is required.' });
      return;
    }

    const targetUser = (await prisma.user.findFirst({
      where: { citizenProfile: { citizenId } },
      include: { citizenProfile: true }
    })) as any;
    if (!targetUser || !targetUser.citizenProfile) {
      res.status(404).json({ message: 'Citizen profile not found' });
      return;
    }

    const crimeInfo = await prisma.crimeInfo.findUnique({
      where: { citizenProfileId: targetUser.citizenProfile.id },
      include: {
        crimeLogs: {
          orderBy: {
            crimeDate: 'desc'
          }
        }
      }
    });

    res.json(crimeInfo?.crimeLogs || []);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const addCrimeLogByIntelligence = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requesterId = req.user?.userId;
    const role = req.user?.role;
    if (!requesterId || role !== 'Admin') {
      res.status(403).json({ message: 'Access denied: only Admins can log crime records.' });
      return;
    }

    const { citizenId, offense, caseNumber, crimeDate, severity, status, details } = req.body;
    if (!citizenId || !offense || !caseNumber || !severity || !status) {
      res.status(400).json({ message: 'Citizen ID, Offense, Case number, Severity, and Status are required' });
      return;
    }

    const targetUser = (await prisma.user.findFirst({
      where: { citizenProfile: { citizenId } },
      include: { citizenProfile: true }
    })) as any;
    if (!targetUser || !targetUser.citizenProfile) {
      res.status(404).json({ message: 'Citizen profile not found' });
      return;
    }

    let crimeInfo = await prisma.crimeInfo.findUnique({
      where: { citizenProfileId: targetUser.citizenProfile.id }
    });

    if (!crimeInfo) {
      crimeInfo = await prisma.crimeInfo.create({
        data: {
          citizenProfileId: targetUser.citizenProfile.id,
          status: 'Pending Review'
        }
      });
    }

    const crimeLog = await prisma.crimeLog.create({
      data: {
        crimeInfoId: crimeInfo.id,
        offense,
        caseNumber,
        severity,
        status,
        details: emptyToNull(details),
        crimeDate: crimeDate ? new Date(crimeDate) : new Date()
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: requesterId,
        action: 'ADD_CRIME_LOG_BY_INTELLIGENCE',
        entity: 'CrimeLog'
      }
    });

    res.status(201).json({ message: 'Crime log added successfully', crimeLog });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateCrimeLogByIntelligence = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requesterId = req.user?.userId;
    const role = req.user?.role;
    if (!requesterId || role !== 'Admin') {
      res.status(403).json({ message: 'Access denied: only Admins can update crime records.' });
      return;
    }

    const crimeLogId = req.params.id as string;
    const { offense, caseNumber, crimeDate, severity, status, details } = req.body;

    const crimeLog = (await prisma.crimeLog.findUnique({
      where: { id: crimeLogId },
      include: {
        crimeInfo: {
          include: {
            citizenProfile: true
          }
        }
      }
    })) as any;

    if (!crimeLog) {
      res.status(404).json({ message: 'Crime log not found' });
      return;
    }

    const updatedCrimeLog = await prisma.crimeLog.update({
      where: { id: crimeLogId },
      data: {
        offense: offense || crimeLog.offense,
        caseNumber: caseNumber || crimeLog.caseNumber,
        severity: severity || crimeLog.severity,
        status: status || crimeLog.status,
        details: details !== undefined ? emptyToNull(details) : crimeLog.details,
        crimeDate: crimeDate ? new Date(crimeDate) : crimeLog.crimeDate
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: requesterId,
        action: 'UPDATE_CRIME_LOG_BY_INTELLIGENCE',
        entity: 'CrimeLog'
      }
    });

    res.json({ message: 'Crime log updated successfully', crimeLog: updatedCrimeLog });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteCrimeLogByIntelligence = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requesterId = req.user?.userId;
    const role = req.user?.role;
    if (!requesterId || role !== 'Admin') {
      res.status(403).json({ message: 'Access denied: only Admins can delete crime records.' });
      return;
    }

    const id = req.params.id as string;
    const crimeLog = (await prisma.crimeLog.findUnique({
      where: { id },
      include: {
        crimeInfo: {
          include: {
            citizenProfile: true
          }
        }
      }
    })) as any;

    if (!crimeLog) {
      res.status(404).json({ message: 'Crime log not found' });
      return;
    }

    await prisma.crimeLog.delete({
      where: { id }
    });

    await prisma.auditLog.create({
      data: {
        userId: requesterId,
        action: 'DELETE_CRIME_LOG_BY_INTELLIGENCE',
        entity: 'CrimeLog'
      }
    });

    res.json({ message: 'Crime log deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getFullCitizenProfileForAdminOrIntelligence = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const citizenId = req.params.citizenId as string;
    if (!citizenId) {
      res.status(400).json({ message: 'Citizen ID is required' });
      return;
    }

    const profile = await prisma.citizenProfile.findUnique({
      where: { citizenId },
      include: {
        user: {
          select: {
            email: true,
            isActive: true,
            createdAt: true,
            profilePicture: true,
            supportStatus: true
          }
        },
        identityInfo: true,
        educationInfo: true,
        financialInfo: true,
        medicalInfo: {
          include: {
            visitLogs: {
              orderBy: { visitDate: 'desc' }
            }
          }
        },
        crimeInfo: {
          include: {
            fineLogs: {
              orderBy: { fineDate: 'desc' }
            },
            crimeLogs: {
              orderBy: { crimeDate: 'desc' }
            }
          }
        },
        documents: true
      }
    });

    if (!profile) {
      res.status(404).json({ message: 'Citizen profile not found' });
      return;
    }

    // Audit lookup action
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId || '',
        action: `VIEW_FULL_PROFILE_${req.user?.role?.toUpperCase()}`,
        entity: 'CitizenProfile'
      }
    });

    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Minimal citizen lookup (name only) for authority roles to resolve a Citizen ID
// before opening the direct medical/criminal hubs — avoids exposing the full profile.
export const getCitizenSummaryForAuthority = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const citizenId = req.params.citizenId as string;
    if (!citizenId) {
      res.status(400).json({ message: 'Citizen ID is required' });
      return;
    }

    const profile = await prisma.citizenProfile.findUnique({
      where: { citizenId },
      select: { citizenId: true, fullName: true }
    });

    if (!profile) {
      res.status(404).json({ message: 'Citizen profile not found' });
      return;
    }

    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Emergency medical details override lookup for unconscious/emergency cases (Doctor and Admin roles only)
export const medicalEmergencyAccess = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requesterId = req.user?.userId;
    const role = req.user?.role;
    if (!requesterId || (role !== 'Doctor' && role !== 'Admin')) {
      res.status(403).json({ message: 'Access denied: only Doctors and Admins can perform emergency lookup.' });
      return;
    }

    const { citizenId } = req.body;
    if (!citizenId) {
      res.status(400).json({ message: 'Citizen ID is required.' });
      return;
    }

    const targetUser = await prisma.user.findFirst({
      where: { citizenProfile: { citizenId } },
      include: {
        citizenProfile: {
          include: {
            medicalInfo: true
          }
        }
      }
    });

    if (!targetUser || !targetUser.citizenProfile) {
      res.status(404).json({ message: 'Citizen profile not found' });
      return;
    }

    const profile = targetUser.citizenProfile;

    // Audit the emergency override lookup
    await prisma.auditLog.create({
      data: {
        userId: requesterId,
        action: 'EMERGENCY_OVERRIDE_ACCESS',
        entity: `CitizenProfile:${profile.id}`
      }
    });

    res.json({
      fullName: profile.fullName,
      bloodGroup: profile.bloodGroup,
      emergencyContactName: profile.emergencyContactName,
      emergencyContactNumber: profile.emergencyContactNumber,
      emergencyContactRelationship: profile.emergencyContactRelationship
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
};
