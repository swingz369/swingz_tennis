import { describe, it, expect, vi } from 'vitest';
import { buildMemberEmailHtml } from '@/lib/season-planning/season-confirmation-email.service';

// Mock env to avoid touching process.env in unit tests
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL: 'https://swingz.test',
    EMAIL_FROM: 'noreply@swingz.test',
    RESEND_API_KEY: 're_test_xxx',
  },
}));

const baseInput = {
  fullName: 'Maria Muster',
  groupName: 'Fortgeschrittene Di/Do',
  trainerName: 'Stefan Becker',
  firstSessionAt: new Date('2026-04-13T17:00:00Z'),
  totalSessions: 18,
  seasonName: 'Sommer 2026',
  firstSessionTime: '17:00',
};

describe('buildMemberEmailHtml (React-Email render)', () => {
  it('renders valid HTML with DOCTYPE, lang=de and a body element', async () => {
    const html = await buildMemberEmailHtml(baseInput);

    expect(html).toContain('<!DOCTYPE html');
    expect(html).toContain('lang="de"');
    expect(html.toLowerCase()).toContain('<body');
    expect(html).toMatch(/<html[\s>]/);
  });

  it('renders de-DE labels for the season confirmation email', async () => {
    const html = await buildMemberEmailHtml(baseInput);

    // Header + body German labels
    expect(html).toContain('Dein Trainingsplan steht');
    expect(html).toContain('Deine Gruppe');
    expect(html).toContain('Dein Trainer');
    expect(html).toContain('Erster Trainingstag');
    expect(html).toContain('Kalender-Anhang');
    expect(html).toContain('Insgesamt');
    expect(html).toContain('Dein SwingZ-Team');
  });

  it('includes the member full name and the group name', async () => {
    const html = await buildMemberEmailHtml(baseInput);

    expect(html).toContain('Maria Muster');
    expect(html).toContain('Fortgeschrittene Di/Do');
    expect(html).toContain('Stefan Becker');
  });

  it('renders the formatted first-session date (de-DE) and totalSessions count', async () => {
    const html = await buildMemberEmailHtml(baseInput);

    // formattedFirstSessionDate is rendered via Intl.DateTimeFormat('de-DE', { weekday: 'long' })
    // 13.04.2026 is a Monday → "Montag"
    expect(html).toMatch(/Montag/);
    expect(html).toMatch(/13\. April 2026/);
    expect(html).toContain('18');
    expect(html).toContain('17:00');
  });

  it('contains the SwingZ-Konto link to /member with the configured appUrl', async () => {
    const html = await buildMemberEmailHtml(baseInput);

    expect(html).toContain('https://swingz.test/member');
    expect(html).toContain('SwingZ-Konto');
  });

  it('uses a fallback greeting when fullName is empty', async () => {
    const html = await buildMemberEmailHtml({ ...baseInput, fullName: '' });

    expect(html).toContain('Mitglied');
    // Must not render a stray "Hallo ,"
    expect(html).not.toMatch(/Hallo\s*,/);
  });

  it('renders the "wird noch festgelegt" placeholder when firstSessionAt is null', async () => {
    const html = await buildMemberEmailHtml({
      ...baseInput,
      firstSessionAt: null,
      firstSessionTime: null,
    });

    expect(html).toContain('wird noch festgelegt');
    // Should not show the time line when no date is set
    expect(html).not.toContain('17:00 Uhr');
  });
});
