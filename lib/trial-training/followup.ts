/**
 * Nurture-Flow für Probetraining — der „was passiert nach dem Probetraining"-
 * Strang. Nach Abschluss (`completed`) bekommt der Interessent automatisch:
 *
 *   1. „Danke" + Feedback-Link + Anmeldelink  (sofort beim Abschluss)
 *   2. „Anmelde-Erinnerung"                    (2 Tage später, via Cron)
 *   3. „Letzter Anstoß"                        (7 Tage später, via Cron)
 *
 * Der Fortschritt wird über `trial_trainings.followup_stage` (0–3) verfolgt,
 * damit jede Mail genau einmal rausgeht. `participant_id` (ein zufälliges,
 * nicht erratbares UUID) dient als undurchsichtiger Schlüssel für die
 * öffentlichen Feedback-/Anmeldeseiten — ein zusätzlicher Token ist dafür
 * nicht nötig.
 */
import { EmailService } from '@/src/application/services/email.service';
import { appBaseUrl } from '@/lib/app-url';

export const REMINDER_AFTER_DAYS = 2;
export const FINAL_AFTER_DAYS = 7;

/** Stufen: 0 = nichts gesendet, 1 = Danke, 2 = Erinnerung, 3 = letzter Anstoß. */
export type FollowupStage = 0 | 1 | 2 | 3;

export function buildFeedbackUrl(participantId: string): string {
  return `${appBaseUrl()}/trial-training/feedback?p=${encodeURIComponent(participantId)}`;
}

export function buildSignupUrl(participantId: string): string {
  return `${appBaseUrl()}/trial-training/anmeldung?p=${encodeURIComponent(participantId)}`;
}

/**
 * Pure: welche Stufe ist nach `daysSinceCompleted` Tagen erreicht?
 * Gibt die neue Stufe zurück — ist sie gleich der aktuellen, ist nichts fällig.
 * Deckt auch Alt-Daten ab (Stufe 0, weil das Probetraining vor diesem Feature
 * abgeschlossen wurde): dann wird die „Danke"-Mail nachgeholt.
 */
export function nextFollowupStage(stage: number, daysSinceCompleted: number): number {
  if (stage >= 3) return 3;
  if (daysSinceCompleted >= FINAL_AFTER_DAYS) return 3;
  if (daysSinceCompleted >= REMINDER_AFTER_DAYS) return Math.max(2, stage);
  if (stage === 0) return 1;
  return stage;
}

export type FollowupKind = 'thanks' | 'reminder' | 'final';

const KIND_SUBJECT: Record<FollowupKind, string> = {
  thanks: 'Danke für dein Probetraining',
  reminder: 'Noch unentschlossen? Werde Mitglied bei {clubName}',
  final: 'Dein Platz bei {clubName} wartet auf dich',
};

function followupHtml(data: {
  name: string;
  clubName: string;
  kind: FollowupKind;
  feedbackUrl: string;
  signupUrl: string;
}): string {
  const { name, clubName, kind, feedbackUrl, signupUrl } = data;

  const headline =
    kind === 'thanks'
      ? 'Danke für dein Probetraining!'
      : kind === 'reminder'
        ? 'Wie hat dir das Training gefallen?'
        : 'Dein Platz wartet auf dich';

  const body =
    kind === 'thanks'
      ? 'Es hat uns gefreut, dich auf dem Platz zu haben. Wie war dein Eindruck? Mit einer kurzen Bewertung hilfst du uns, besser zu werden — und falls du bereit bist, kannst du dich direkt als Mitglied anmelden.'
      : kind === 'reminder'
        ? 'Vor ein paar Tagen warst du bei uns zum Probetraining. Falls du noch unentschlossen bist: Dein Platz im Verein ist für dich reserviert. Mit einem Klick bist du dabei.'
        : 'Dein Probetraining liegt ein paar Tage zurück — wir würden dich sehr gerne als Mitglied begrüßen. Sichere dir jetzt deinen Platz in unserem Verein.';

  return `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:24px;font-family:'Helvetica Neue',Arial,sans-serif;color:#333;background:#f4f4f4;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;">
    <div style="background:#00599F;color:#fff;padding:32px 28px;">
      <h1 style="margin:0;font-size:22px;">${headline}</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 16px;line-height:1.6;">Hallo ${name},</p>
      <p style="margin:0 0 24px;line-height:1.6;">${body}</p>
      ${
        kind !== 'thanks'
          ? ''
          : `<p style="margin:0 0 12px;font-size:13px;color:#666;">Wie war dein Eindruck?</p>
             <a href="${feedbackUrl}" style="display:inline-block;background:#f4f4f4;color:#00599F;border:1px solid #00599F;border-radius:8px;padding:10px 18px;text-decoration:none;font-weight:600;margin-bottom:20px;">Bewertung abgeben</a>`
      }
      <p style="margin:0 0 12px;font-size:13px;color:#666;">Bereit, Mitglied zu werden?</p>
      <a href="${signupUrl}" style="display:inline-block;background:#00599F;color:#fff;border-radius:8px;padding:12px 24px;text-decoration:none;font-weight:600;">Jetzt Mitglied werden</a>
      <p style="margin:24px 0 0;font-size:12px;color:#999;">Dein Verein: ${clubName}</p>
    </div>
  </div>
</body>
</html>`;
}

function followupText(data: {
  name: string;
  clubName: string;
  kind: FollowupKind;
  feedbackUrl: string;
  signupUrl: string;
}): string {
  const { name, clubName, kind, feedbackUrl, signupUrl } = data;

  const headline =
    kind === 'thanks'
      ? 'Danke für dein Probetraining!'
      : kind === 'reminder'
        ? 'Wie hat dir das Training gefallen?'
        : 'Dein Platz wartet auf dich';

  const body =
    kind === 'thanks'
      ? 'Es hat uns gefreut, dich auf dem Platz zu haben. Wie war dein Eindruck? Mit einer kurzen Bewertung hilfst du uns, besser zu werden — und falls du bereit bist, kannst du dich direkt als Mitglied anmelden.'
      : kind === 'reminder'
        ? 'Vor ein paar Tagen warst du bei uns zum Probetraining. Falls du noch unentschlossen bist: Dein Platz im Verein ist für dich reserviert. Mit einem Klick bist du dabei.'
        : 'Dein Probetraining liegt ein paar Tage zurück — wir würden dich sehr gerne als Mitglied begrüßen. Sichere dir jetzt deinen Platz in unserem Verein.';

  const parts = [headline, '', `Hallo ${name},`, '', body];
  if (kind === 'thanks') {
    parts.push('', `Bewertung abgeben: ${feedbackUrl}`);
  }
  parts.push('', `Jetzt Mitglied werden: ${signupUrl}`, '', `Dein Verein: ${clubName}`);

  return parts.join('\n');
}

/** Sendet eine Follow-up-Mail. Fehler werden nicht geworfen — Mail ist nicht kritisch. */
export async function sendFollowupEmail(data: {
  to: string;
  name: string;
  clubName: string;
  kind: FollowupKind;
  participantId: string;
}): Promise<boolean> {
  const { to, name, clubName, kind, participantId } = data;
  const subject = KIND_SUBJECT[kind].replace('{clubName}', clubName);
  const feedbackUrl = buildFeedbackUrl(participantId);
  const signupUrl = buildSignupUrl(participantId);
  const html = followupHtml({ name, clubName, kind, feedbackUrl, signupUrl });
  const text = followupText({ name, clubName, kind, feedbackUrl, signupUrl });

  try {
    return await EmailService.sendEmail(to, { subject, html, text });
  } catch {
    return false;
  }
}
