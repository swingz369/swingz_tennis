/**
 * F10: Google Wallet Mitgliedskarte (Generic Pass via signed JWT)
 *
 * ENV vars:
 *   GOOGLE_WALLET_SERVICE_ACCOUNT_KEY  — JSON-String des Service-Account-Schlüssels
 *   GOOGLE_WALLET_ISSUER_ID            — Issuer ID aus der Google Wallet Console
 *   GOOGLE_WALLET_CLASS_ID             — z.B. swingz_member_card (optional, Default genutzt)
 */
import { createSign } from 'node:crypto';

export function isGoogleWalletConfigured(): boolean {
  return !!(process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_WALLET_ISSUER_ID);
}

export function generateGoogleWalletUrl(data: {
  memberName: string;
  memberId: string;
  clubName: string;
  memberSince: string;
  memberType?: string;
}): string {
  if (!isGoogleWalletConfigured())
    throw new Error('Google Wallet nicht konfiguriert (GOOGLE_WALLET_* ENV fehlen)');

  const sa = JSON.parse(process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_KEY!);
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!;
  const classId = process.env.GOOGLE_WALLET_CLASS_ID ?? 'swingz_member_card';
  const objectId = `${issuerId}.${data.memberId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  const payload = {
    iss: sa.client_email,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    payload: {
      genericObjects: [
        {
          id: objectId,
          classId: `${issuerId}.${classId}`,
          cardTitle: { defaultValue: { language: 'de', value: data.clubName } },
          subheader: { defaultValue: { language: 'de', value: 'Mitgliedskarte' } },
          header: { defaultValue: { language: 'de', value: data.memberName } },
          textModulesData: [
            { id: 'mid', header: 'Mitgliedsnr.', body: data.memberId },
            { id: 'type', header: 'Kategorie', body: data.memberType ?? 'Aktiv' },
            {
              id: 'since',
              header: 'Mitglied seit',
              body: new Date(data.memberSince).toLocaleDateString('de-DE'),
            },
          ],
          barcode: { type: 'QR_CODE', value: data.memberId },
          hexBackgroundColor: '#00599F',
        },
      ],
    },
  };

  const hdr = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const bdy = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createSign('RSA-SHA256').update(`${hdr}.${bdy}`).sign(sa.private_key, 'base64url');
  return `https://pay.google.com/gp/v/save/${hdr}.${bdy}.${sig}`;
}
