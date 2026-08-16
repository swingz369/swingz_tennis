import { describe, it, expect } from 'vitest';
import { isMinor, decideActAs } from '@/lib/family/family-auth';

describe('isMinor', () => {
  it('returns false for missing/invalid date of birth', () => {
    expect(isMinor(null)).toBe(false);
    expect(isMinor(undefined)).toBe(false);
    expect(isMinor('')).toBe(false);
    expect(isMinor('not-a-date')).toBe(false);
  });

  it('detects a 10-year-old as minor', () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 10);
    expect(isMinor(dob.toISOString())).toBe(true);
  });

  it('detects an adult as not minor', () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 40);
    expect(isMinor(dob.toISOString())).toBe(false);
  });
});

describe('decideActAs', () => {
  const adult: { familyGroupId: string; dateOfBirth: string | null } = {
    familyGroupId: 'g1',
    dateOfBirth: '1980-01-01',
  };
  const child: { familyGroupId: string; dateOfBirth: string | null } = {
    familyGroupId: 'g1',
    dateOfBirth: '2015-01-01',
  };

  it('allows acting as yourself without a target', () => {
    const d = decideActAs('u1', null, adult, child);
    expect(d).toEqual({ allowed: true, effectiveMemberId: 'u1' });
  });

  it('allows acting as yourself even when a target equals the user', () => {
    const d = decideActAs('u1', 'u1', adult, child);
    expect(d).toEqual({ allowed: true, effectiveMemberId: 'u1' });
  });

  it('allows an adult to act for a minor in the same family group', () => {
    const d = decideActAs('parent', 'child', adult, child);
    expect(d).toEqual({ allowed: true, effectiveMemberId: 'child' });
  });

  it('rejects a target outside the family group', () => {
    const d = decideActAs('parent', 'stranger', adult, {
      familyGroupId: 'g2',
      dateOfBirth: '2015-01-01',
    });
    expect(d.allowed).toBe(false);
  });

  it('rejects a minor acting for another family member', () => {
    const d = decideActAs('child', 'child2', child, {
      familyGroupId: 'g1',
      dateOfBirth: '2016-01-01',
    });
    expect(d.allowed).toBe(false);
  });

  it('rejects acting for an adult family member', () => {
    const d = decideActAs('parent', 'adult2', adult, {
      familyGroupId: 'g1',
      dateOfBirth: '1990-01-01',
    });
    expect(d.allowed).toBe(false);
  });

  it('rejects when the actor has no family group', () => {
    const d = decideActAs(
      'loner',
      'child',
      { familyGroupId: null, dateOfBirth: '1980-01-01' },
      child
    );
    expect(d.allowed).toBe(false);
  });
});
