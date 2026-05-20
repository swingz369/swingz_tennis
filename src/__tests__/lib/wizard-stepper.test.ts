import { describe, it, expect } from 'vitest';
import { getActiveStep, WIZARD_STEPS } from '@/app/(protected)/admin/seasons/[id]/wizard/wizard-steps';

describe('getActiveStep', () => {
  it('returns 0 for draft status', () => {
    expect(getActiveStep('draft')).toBe(0);
  });

  it('returns 1 for collecting_preferences status', () => {
    expect(getActiveStep('collecting_preferences')).toBe(1);
  });

  it('returns 2 for auto_planning status', () => {
    expect(getActiveStep('auto_planning')).toBe(2);
  });

  it('returns 2 for manual_review status (same step as auto_planning)', () => {
    expect(getActiveStep('manual_review')).toBe(2);
  });

  it('returns 3 for invoices_generated status', () => {
    expect(getActiveStep('invoices_generated')).toBe(3);
  });

  it('returns 4 for published status', () => {
    expect(getActiveStep('published')).toBe(4);
  });

  it('returns 4 for active status', () => {
    expect(getActiveStep('active')).toBe(4);
  });

  it('returns 4 for completed status', () => {
    expect(getActiveStep('completed')).toBe(4);
  });

  it('returns 4 for archived status', () => {
    expect(getActiveStep('archived')).toBe(4);
  });

  it('returns 0 for unknown status (default fallback)', () => {
    expect(getActiveStep('nonexistent_status')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(getActiveStep('')).toBe(0);
  });

  it('step progression is monotonic (no regression)', () => {
    // Draft < Preferences < Planning < Invoices < Published
    const steps = [
      'draft',
      'collecting_preferences',
      'auto_planning',
      'invoices_generated',
      'published',
    ];
    const values = steps.map((s) => getActiveStep(s));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });
});

describe('WIZARD_STEPS', () => {
  it('has 5 steps', () => {
    expect(WIZARD_STEPS).toHaveLength(5);
  });

  it('has correct labels in order', () => {
    const labels = WIZARD_STEPS.map((s) => s.label);
    expect(labels).toEqual([
      'Einstellungen',
      'Gruppen',
      'Plan',
      'Billing',
      'Veröffentlichen',
    ]);
  });

  it('has correct hrefs in order', () => {
    const hrefs = WIZARD_STEPS.map((s) => s.href);
    expect(hrefs).toEqual([
      'preferences',
      'groups',
      'plan',
      'billing',
      'publish',
    ]);
  });

  it('every step has a corresponding STATUS_TO_STEP value', () => {
    // Verify that the highest step index (4) is reachable
    expect(getActiveStep('published')).toBe(4);
    // Verify all intermediate steps are reachable
    expect(getActiveStep('collecting_preferences')).toBe(1);
    expect(getActiveStep('invoices_generated')).toBe(3);
  });
});
