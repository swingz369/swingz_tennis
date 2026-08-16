import { describe, it, expect } from 'vitest';
import { nextFollowupStage, buildFeedbackUrl, buildSignupUrl } from '@/lib/trial-training/followup';

describe('nextFollowupStage', () => {
  it('sends the thanks mail immediately for fresh completions (stage 0)', () => {
    expect(nextFollowupStage(0, 0)).toBe(1);
    expect(nextFollowupStage(0, 1)).toBe(1);
  });

  it('keeps stage 1 unchanged before the reminder window', () => {
    expect(nextFollowupStage(1, 0)).toBe(1);
    expect(nextFollowupStage(1, 1)).toBe(1);
  });

  it('advances to reminder after 2 days', () => {
    expect(nextFollowupStage(1, 2)).toBe(2);
    expect(nextFollowupStage(1, 3)).toBe(2);
  });

  it('keeps stage 2 unchanged before the final window', () => {
    expect(nextFollowupStage(2, 2)).toBe(2);
    expect(nextFollowupStage(2, 6)).toBe(2);
  });

  it('advances to the final nudge after 7 days', () => {
    expect(nextFollowupStage(2, 7)).toBe(3);
    expect(nextFollowupStage(2, 10)).toBe(3);
  });

  it('stage 3 is terminal', () => {
    expect(nextFollowupStage(3, 100)).toBe(3);
  });

  it('skips ahead for legacy data with a completed_at in the past', () => {
    // Alt-Daten (stage 0, weil vor dem Feature abgeschlossen): es soll nicht
    // mit einer verspäteten „Danke“-Mail anfangen, sondern direkt bei der
    // passenden Stufe einsteigen.
    expect(nextFollowupStage(0, 3)).toBe(2);
    expect(nextFollowupStage(0, 9)).toBe(3);
  });
});

describe('followup URL builders', () => {
  const id = '123e4567-e89b-12d3-a456-426614174000';

  it('builds a feedback URL carrying the participant id', () => {
    const url = buildFeedbackUrl(id);
    expect(url).toContain('/trial-training/feedback');
    expect(url).toContain(encodeURIComponent(id));
  });

  it('builds a signup URL carrying the participant id', () => {
    const url = buildSignupUrl(id);
    expect(url).toContain('/trial-training/anmeldung');
    expect(url).toContain(encodeURIComponent(id));
  });
});
