import { describe, it, expect } from 'vitest';
import { consentAllowsRule } from '../src/utils/consentScopes';

// consentAllowsRule decides whether an approved consent (a JSON array of granted
// data categories) permits a verifier to evaluate a specific zero-knowledge field.
describe('consentAllowsRule', () => {
  it('allows any field when consent grants "all" or "full profile"', () => {
    expect(consentAllowsRule(JSON.stringify(['all']), 'age')).toBe(true);
    expect(consentAllowsRule(JSON.stringify(['full profile']), 'income')).toBe(true);
  });

  it('matches a field to its scope category', () => {
    expect(consentAllowsRule(JSON.stringify(['financial']), 'income')).toBe(true);
    expect(consentAllowsRule(JSON.stringify(['identity']), 'age')).toBe(true);
    expect(consentAllowsRule(JSON.stringify(['medical']), 'blood_type')).toBe(true);
  });

  it('denies a field outside the granted scope', () => {
    expect(consentAllowsRule(JSON.stringify(['education']), 'income')).toBe(false);
    expect(consentAllowsRule(JSON.stringify(['medical']), 'cgpa')).toBe(false);
    expect(consentAllowsRule(JSON.stringify(['basic']), 'medical_visit_logs')).toBe(false);
    expect(consentAllowsRule(JSON.stringify(['medical info']), 'medical_visit_logs')).toBe(true);
  });

  it('falls back to comma-splitting when consent is not valid JSON', () => {
    expect(consentAllowsRule('financial,medical', 'income')).toBe(true);
  });
});
