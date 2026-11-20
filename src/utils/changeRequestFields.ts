import { ChangeCategory } from '@prisma/client';
import { z } from 'zod';

export type ChangeValue = string | number | boolean | null;
type FieldKind = 'text' | 'textarea' | 'date' | 'number' | 'select' | 'boolean';
interface Field {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: string[];
  maxLength?: number;
  schema: z.ZodType<ChangeValue>;
}

const text = (key: string, label: string, maxLength = 160, multi = false, required = false): Field => ({
  key, label, kind: multi ? 'textarea' : 'text', maxLength, required,
  schema: required ? z.string().trim().min(1).max(maxLength) : z.string().trim().max(maxLength).nullable()
});
const choice = (key: string, label: string, options: string[]): Field => ({
  key, label, kind: 'select', options, schema: z.enum(options).nullable()
});
const dateField = (key: string, label: string, required: boolean): Field => ({
  key, label, kind: 'date', required,
  schema: required
    ? z.iso.date().refine(value => value >= '1900-01-01' && value <= new Date().toISOString().slice(0, 10))
    : z.iso.date().nullable()
});
const numeric = (key: string, label: string, min: number, max: number, integer = false): Field => ({
  key, label, kind: 'number', schema: (integer ? z.number().int() : z.number()).min(min).max(max).nullable()
});
const booleanField = (key: string, label: string): Field => ({
  key, label, kind: 'boolean', required: true, schema: z.boolean()
});

export const categories: Record<ChangeCategory, { label: string; words: string; fields: Field[] }> = {
  PERSONAL: {
    label: "Personal Info",
    words: "profile personal basic name phone mobile birth dob gender address blood nationality citizenship marital religion emergency contact",
    fields: [
      text("fullName", "Full Name", 120, false, true),
      text("phone", "Phone Number"),
      dateField("dob", "Date of Birth", true),
      choice("gender", "Gender", ["Male","Female","Other"]),
      text("address", "Address", 1_000, true),
      choice("bloodGroup", "Blood Group", ["A+","A-","B+","B-","AB+","AB-","O+","O-"]),
      text("fathersName", "Fathers Name"),
      text("mothersName", "Mothers Name"),
      text("nationality", "Nationality"),
      choice("maritalStatus", "Marital Status", ["Single","Married","Divorced","Widowed"]),
      text("religion", "Religion"),
      text("emergencyContactName", "Emergency Contact Name"),
      text("emergencyContactNumber", "Emergency Contact Number"),
      text("emergencyContactRelationship", "Emergency Contact Relationship"),
    ]
  },
  IDENTITY: {
    label: "Identity Info",
    words: "identity nid national passport driving driver license trade tin land khatian daag family farmer card",
    fields: [
      text("nid", "National ID Number (NID)"),
      text("nidNameBangla", "NID Name (Bangla)"),
      text("nidFathersNameBangla", "NID Father's Name (Bangla)"),
      text("nidMothersNameBangla", "NID Mother's Name (Bangla)"),
      text("passport", "Passport Number"),
      choice("passportType", "Passport Type", ["Ordinary","Official","Diplomatic"]),
      dateField("passportIssueDate", "Passport Issue Date", false),
      dateField("passportExpiryDate", "Passport Expiry Date", false),
      text("passportIssuePlace", "Passport Issue Place"),
      text("drivingLicense", "Driving License Number"),
      choice("drivingLicenseType", "Driving License Type", ["Non-Professional","Professional"]),
      text("drivingLicenseVehicleCategories", "Driving License Vehicle Categories"),
      dateField("drivingLicenseIssueDate", "Driving License Issue Date", false),
      dateField("drivingLicenseExpiryDate", "Driving License Expiry Date", false),
      text("tradeLicense", "Trade License Number"),
      text("tradeLicenseBusinessName", "Trade License Business Name"),
      text("tradeLicenseBusinessType", "Trade License Business Type"),
      text("tradeLicenseIssueAuthority", "Trade License Issue Authority"),
      text("tradeLicenseFiscalYear", "Trade License Fiscal Year"),
      text("tin", "Tax Identification Number (TIN)"),
      text("tinCircleZone", "TIN Circle Zone"),
      text("tinAssessmentStatus", "TIN Assessment Status"),
      text("landRecord", "Land Record (Khatian)"),
      text("landRecordDaagNumber", "Land Record Daag Number"),
      text("landRecordMouzaThana", "Land Record Mouza Thana"),
      text("landRecordDistrict", "Land Record District"),
      text("familyCard", "Family Card"),
      text("familyCardMembersCount", "Family Card Members Count"),
      text("farmerCard", "Farmer Card"),
      text("farmerCardType", "Farmer Card Type"),
    ]
  },
  EDUCATION: {
    label: "Education Info",
    words: "education academic school college university ssc hsc gpa cgpa degree graduation enrollment board student",
    fields: [
      text("sscRoll", "SSC Roll"),
      text("sscReg", "SSC Registration Number"),
      numeric("sscGpa", "SSC GPA", 0, 5),
      text("sscGroup", "SSC Group"),
      text("sscBoard", "SSC Board"),
      numeric("sscPassingYear", "SSC Passing Year", 1900, 2100, true),
      text("sscInstitution", "SSC Institution"),
      text("hscRoll", "HSC Roll"),
      text("hscReg", "HSC Registration Number"),
      numeric("hscGpa", "HSC GPA", 0, 5),
      text("hscGroup", "HSC Group"),
      text("hscBoard", "HSC Board"),
      numeric("hscPassingYear", "HSC Passing Year", 1900, 2100, true),
      text("hscInstitution", "HSC Institution"),
      text("university", "University"),
      text("degree", "Degree"),
      text("universityDepartment", "University Department"),
      text("universityStudentId", "University Student ID"),
      numeric("cgpa", "CGPA", 0, 5),
      text("universitySemester", "University Semester"),
      numeric("graduationYear", "Graduation Year", 1900, 2100, true),
      numeric("universityEnrollmentYear", "University Enrollment Year", 1900, 2100, true),
    ]
  },
  FINANCIAL: {
    label: "Financial Info",
    words: "financial finance salary income tax bank money company occupation employment job account payout routing wallet",
    fields: [
      text("occupation", "Occupation"),
      text("employmentStatus", "Employment Status"),
      text("companyName", "Company Name"),
      text("workExperience", "Work Experience"),
      text("officeAddressEmail", "Office Address / Email", 1_000, true),
      numeric("monthlyIncome", "Monthly Income", 0, 1_000_000_000_000),
      numeric("netTakeHomePay", "Net Take Home Pay", 0, 1_000_000_000_000),
      text("primaryIncomeSource", "Primary Income Source"),
      text("secondaryIncome", "Secondary Income"),
      text("preferredPayoutMethod", "Preferred Payout Method"),
      text("tin", "Tax Identification Number (TIN)"),
      text("taxZoneCircle", "Tax Zone Circle"),
      text("taxRegistrationStatus", "Tax Registration Status"),
      text("taxpayerAssessmentCategory", "Taxpayer Assessment Category"),
      text("taxClearanceStatus", "Tax Clearance Status"),
      text("lastReturnSubmissionDate", "Last Return Submission Date"),
      text("taxYearOfLastReturn", "Tax Year Of Last Return"),
      text("acknowledgmentReceiptNumber", "Acknowledgment Receipt Number"),
      numeric("totalTaxPaid", "Total Tax Paid", 0, 1_000_000_000_000),
      text("bankAccountNumber", "Bank Account Number"),
      text("bankNameBranch", "Bank Name Branch"),
      text("routingNumber", "Routing Number"),
      text("mfsWallet", "Mobile Financial Services Wallet"),
    ]
  },
  MEDICAL: {
    label: "Medical Info",
    words: "medical health allergy allergies chronic conditions insurance immunization vaccination",
    fields: [
      choice("bloodType", "Blood Type", ["A+","A-","B+","B-","AB+","AB-","O+","O-"]),
      text("allergies", "Allergies", 1_000, true),
      text("chronicConditions", "Chronic Conditions", 1_000, true),
      text("medicalHistory", "Medical History", 1_000, true),
      text("immunizationStatus", "Immunization Status"),
      text("insuranceProvider", "Insurance Provider"),
      text("insurancePolicyNumber", "Insurance Policy Number"),
    ]
  },
  CRIME: {
    label: "Crime Info",
    words: "criminal crime charges clearance police certificate record",
    fields: [
      booleanField("hasCriminalRecord", "Has Criminal Record"),
      text("pendingCharges", "Pending Charges", 1_000, true),
      text("recordDetails", "Record Details", 1_000, true),
      text("clearanceCertificateNumber", "Clearance Certificate Number"),
    ]
  }
};

export const formCatalog = Object.entries(categories).map(([id, { label, fields }]) => ({
  id, label, fields: fields.map(({ schema: _schema, ...field }) => field)
}));

const tokenize = (message: string) => new Set(message.toLowerCase().match(/[a-z]+/g) ?? []);

export function suggestCorrection(message: string, category?: ChangeCategory) {
  const terms = tokenize(message);
  const entries = Object.entries(categories) as [ChangeCategory, typeof categories[ChangeCategory]][];
  const ranked = entries.map(([id, section]) => {
    const exactFields = section.fields.filter(field => [...tokenize(field.label)].every(word => terms.has(word)));
    exactFields.sort((a, b) => b.label.length - a.label.length);
    const score = section.words.split(' ').filter(word => terms.has(word)).length + (exactFields.length ? 2 : 0);
    return { id, score, exactFields };
  }).sort((a, b) => b.score - a.score);
  const chosen = category ?? (ranked[0].score > ranked[1].score ? ranked[0].id : null);
  const exactFields = ranked.find(section => section.id === chosen)?.exactFields ?? [];
  const aliasField = chosen === 'PERSONAL'
    ? terms.has('phone') || terms.has('mobile') ? 'phone' : terms.has('dob') ? 'dob' : undefined
    : chosen === 'IDENTITY' && terms.has('nid') ? 'nid' : undefined;
  return { category: chosen, field: exactFields[0]?.key ?? aliasField ?? null };
}

const phoneFields = new Set(['phone', 'emergencyContactNumber']);
const requiredStringFields = new Set(['phone', 'gender', 'address', 'bloodGroup', 'emergencyContactName', 'emergencyContactNumber']);

export function validateChanges(category: ChangeCategory, values: Record<string, unknown>) {
  const changes: Record<string, ChangeValue> = {};
  const errors: Record<string, string> = {};
  const fields = new Map(categories[category].fields.map(field => [field.key, field]));

  for (const [key, value] of Object.entries(values)) {
    const field = fields.get(key);
    const normalized = typeof value === 'string' && !value.trim() ? null : value;
    const parsed = field?.schema.safeParse(normalized);
    if (!field || !parsed?.success) {
      if (!field) return { changes: {}, errors: { form: 'Select fields from the chosen section.' } };
      errors[key] = `Enter a valid value for ${field.label}.`;
      continue;
    }
    if (phoneFields.has(key) && typeof parsed.data === 'string'
      && (!/^\+?[\d(). -]+$/.test(parsed.data) || !/^\d{7,15}$/.test(parsed.data.replace(/\D/g, '')))) {
      errors[key] = 'Enter a phone number with 7–15 digits.';
      continue;
    }
    changes[key] = parsed.data === null && category === 'PERSONAL' && requiredStringFields.has(key) ? '' : parsed.data;
  }
  return { changes, errors };
}
