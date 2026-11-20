import { Router } from 'express';
import { authenticate, authorizeRole } from '../middlewares/authMiddleware';
import {
  requestAccess,
  evaluatePolicy,
  getVerifierConsents,
  getMedicalVisitLogsByDoctor,
  addMedicalVisitLogByDoctor,
  deleteMedicalVisitLogByDoctor,
  getFineLogsByIntelligence,
  addFineLogByIntelligence,
  updateFineStatusByIntelligence,
  deleteFineLogByIntelligence,
  getCrimeLogsByIntelligence,
  addCrimeLogByIntelligence,
  updateCrimeLogByIntelligence,
  deleteCrimeLogByIntelligence,
  getFullCitizenProfileForAdminOrIntelligence,
  getCitizenSummaryForAuthority,
  medicalEmergencyAccess
} from '../controllers/verifierController';
import { createUpload, validateUploads } from '../utils/upload';

const router = Router();

const upload = createUpload({
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  maxFileSizeBytes: 5 * 1024 * 1024,
  maxFiles: 2,
  fileTypeError: 'Only JPG, PNG, WEBP, and PDF files are allowed'
});

router.use(authenticate);
router.use(authorizeRole(['JobInterviewer', 'BankLoanOfficer', 'UniversityAuthority', 'Admin', 'Doctor', 'IntelligenceDepartment']));

router.post('/request-access', requestAccess);
router.post('/evaluate-policy', evaluatePolicy);
router.get('/consents', getVerifierConsents);

// Medical visit logs endpoints
router.get('/medical/visit-logs/:citizenId', getMedicalVisitLogsByDoctor);

router.post('/medical/visit-logs', authorizeRole(['Doctor', 'Admin']), validateUploads(upload.fields([
  { name: 'prescription', maxCount: 1 },
  { name: 'prescriptionPdf', maxCount: 1 }
]), {
  prescription: ['image/jpeg', 'image/png', 'image/webp'],
  prescriptionPdf: ['application/pdf']
}), addMedicalVisitLogByDoctor);

router.delete('/medical/visit-logs/:id', deleteMedicalVisitLogByDoctor);

// Doctor emergency lookup
router.post('/medical/emergency', authorizeRole(['Doctor', 'Admin']), medicalEmergencyAccess);

// Criminal Record Fines & Crime Logs endpoints
router.get('/crime/fines/:citizenId', authorizeRole(['IntelligenceDepartment', 'Admin']), getFineLogsByIntelligence);
router.post('/crime/fines', authorizeRole(['Admin']), addFineLogByIntelligence);
router.patch('/crime/fines/:id', authorizeRole(['Admin']), updateFineStatusByIntelligence);
router.delete('/crime/fines/:id', authorizeRole(['Admin']), deleteFineLogByIntelligence);

router.get('/crime/crime-logs/:citizenId', authorizeRole(['IntelligenceDepartment', 'Admin']), getCrimeLogsByIntelligence);
router.post('/crime/crime-logs', authorizeRole(['Admin']), addCrimeLogByIntelligence);
router.patch('/crime/crime-logs/:id', authorizeRole(['Admin']), updateCrimeLogByIntelligence);
router.delete('/crime/crime-logs/:id', authorizeRole(['Admin']), deleteCrimeLogByIntelligence);

// Full profile lookup for Admin + Intelligence.
// DESIGN DECISION (2026-06-23, confirmed by product owner): Intelligence
// Department is a high-clearance authority and is INTENTIONALLY granted
// full-profile visibility here (including financial/education), even though the
// consent/zero-knowledge flow deliberately restricts it to identity + crime.
// This broader direct-search access is by design — do NOT narrow it to match the
// consent boundary without an explicit product decision to reverse this.
router.get('/citizen-profile/details/:citizenId', authorizeRole(['IntelligenceDepartment', 'Admin']), getFullCitizenProfileForAdminOrIntelligence);

// Lightweight name lookup so authority roles can resolve a citizen before opening direct hubs
router.get('/citizen-lookup/:citizenId', authorizeRole(['Doctor', 'IntelligenceDepartment', 'Admin']), getCitizenSummaryForAuthority);

export default router;
