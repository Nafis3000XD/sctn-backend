import prisma from '../db';

const ruleScopes: Record<string, string[]> = {
  age: ['age', 'basic', 'identity', 'identity info', 'profile'],
  income: ['income', 'financial', 'financial info'],
  net_take_home_pay: ['income', 'financial', 'financial info', 'take home pay'],
  total_tax_paid: ['tax', 'tax clearance', 'financial', 'financial info'],
  employment_status: ['employment', 'financial', 'financial info'],
  tin: ['tax', 'tin', 'financial', 'financial info'],
  primary_income_source: ['income', 'financial', 'financial info'],
  tax_clearance: ['tax', 'tax clearance', 'financial', 'financial info'],
  ssc_gpa: ['education', 'education info', 'academic', 'academic records', 'ssc'],
  cgpa: ['education', 'education info', 'academic', 'academic records', 'university', 'cgpa'],
  medical_visit_logs: ['medical', 'medical info', 'health', 'medical visit logs'],
  blood_type: ['medical', 'medical info', 'health', 'blood type'],
  allergies: ['medical', 'medical info', 'health', 'allergies'],
  chronic_conditions: ['medical', 'medical info', 'health', 'chronic conditions'],
  medical_history: ['medical', 'medical info', 'health', 'medical history'],
  immunization_status: ['medical', 'medical info', 'health', 'immunization status'],
  insurance_provider: ['medical', 'medical info', 'health', 'insurance provider'],
  insurance_policy_number: ['medical', 'medical info', 'health', 'insurance policy number'],
  has_criminal_record: ['crime', 'crime info', 'criminal record', 'background check']
};

export const normalizeList = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
};

export const consentAllowsRule = (requestedData: string, field: string): boolean => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(requestedData);
  } catch {
    parsed = requestedData.split(',');
  }

  const requested = normalizeList(parsed);
  if (requested.some((item) => item === 'all' || item === 'full profile')) return true;

  const acceptedScopes = ruleScopes[field] || [field.toLowerCase()];
  return requested.some((item) => acceptedScopes.includes(item));
};


export async function getActiveConsentScopes(requesterId: string, targetId: string) {
  const consents = await prisma.consentRequest.findMany({
    where: { requesterId, targetId, status: 'Approved', OR: [
      { expiryTime: null }, { expiryTime: { gt: new Date() } }
    ] },
    select: { requestedData: true }
  });
  return consents.map(({ requestedData }) => requestedData);
}

export async function hasMedicalVisitConsent(requesterId: string, targetId: string) {
  const scopes = await getActiveConsentScopes(requesterId, targetId);
  return scopes.some((scope) => consentAllowsRule(scope, 'medical_visit_logs'));
}
