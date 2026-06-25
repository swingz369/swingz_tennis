/**
 * F8: SMS via Twilio — no-op wenn TWILIO_* ENV fehlt.
 */
import { createLogger } from '@/lib/logger';

const log = createLogger('notifications:sms');

const configured =
  !!process.env.TWILIO_ACCOUNT_SID &&
  !!process.env.TWILIO_AUTH_TOKEN &&
  !!process.env.TWILIO_FROM_NUMBER;

export async function sendSms(to: string, body: string): Promise<void> {
  if (!configured) {
    log.info('SMS nicht konfiguriert (TWILIO_* fehlt) — übersprungen', { to });
    return;
  }
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER!, Body: body }).toString(),
    }
  );
  if (!res.ok) {
    log.error('SMS-Versand fehlgeschlagen', { to, status: res.status });
  }
}

export async function sendMatchdayReminder(phone: string, matchday: string, time: string) {
  await sendSms(phone, `SwingZ: Erinnerung — Spieltag ${matchday} um ${time}. Viel Erfolg!`);
}
