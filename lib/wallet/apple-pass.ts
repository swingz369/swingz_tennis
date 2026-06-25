/**
 * F10: Apple Wallet Mitgliedskarte (.pkpass)
 *
 * ENV vars:
 *   APPLE_WALLET_CERT_P12_BASE64  — base64-kodiertes .p12 (Zertifikat + Schlüssel)
 *   APPLE_WALLET_CERT_PASSWORD    — .p12-Passwort
 *   APPLE_WALLET_PASS_TYPE_ID     — z.B. pass.de.swingz.mitglied
 *   APPLE_WALLET_TEAM_ID          — Apple Developer Team ID (10 Zeichen)
 *
 * Setup:
 *   1. CSR → Apple Developer Portal → Pass Type ID → .cer erhalten
 *   2. openssl pkcs12 -export -in pass.cer -inkey private.key -out pass.p12
 *   3. base64 pass.p12 | tr -d '\n'  → APPLE_WALLET_CERT_P12_BASE64
 */

import { PKPass } from 'passkit-generator';

export interface MemberPassData {
  memberName: string;
  memberId: string;
  clubName: string;
  memberSince: string;
  membershipEnd?: string;
  memberType?: string;
}

export function isAppleWalletConfigured(): boolean {
  return !!(
    process.env.APPLE_WALLET_CERT_P12_BASE64 &&
    process.env.APPLE_WALLET_CERT_PASSWORD &&
    process.env.APPLE_WALLET_PASS_TYPE_ID &&
    process.env.APPLE_WALLET_TEAM_ID
  );
}

export async function generateMemberPass(data: MemberPassData): Promise<Buffer> {
  if (!isAppleWalletConfigured())
    throw new Error('Apple Wallet nicht konfiguriert (APPLE_WALLET_* ENV fehlen)');

  const p12 = Buffer.from(process.env.APPLE_WALLET_CERT_P12_BASE64!, 'base64');

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_WALLET_PASS_TYPE_ID!,
    serialNumber: data.memberId,
    teamIdentifier: process.env.APPLE_WALLET_TEAM_ID!,
    organizationName: data.clubName,
    description: `${data.clubName} — Mitgliedskarte`,
    logoText: data.clubName,
    foregroundColor: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(27, 67, 50)',
    generic: {
      primaryFields: [{ key: 'name', label: 'MITGLIED', value: data.memberName }],
      secondaryFields: [
        { key: 'id', label: 'MITGLIEDSNR.', value: data.memberId },
        { key: 'type', label: 'KATEGORIE', value: data.memberType ?? 'Aktiv' },
      ],
      auxiliaryFields: [
        { key: 'club', label: 'VEREIN', value: data.clubName },
        {
          key: 'since',
          label: 'SEIT',
          value: new Date(data.memberSince).toLocaleDateString('de-DE'),
        },
      ],
      backFields: [{ key: 'info', label: 'Info', value: 'Digitale Mitgliedskarte via SwingZ' }],
    },
    barcodes: [
      { message: data.memberId, format: 'PKBarcodeFormatQR', messageEncoding: 'iso-8859-1' },
    ],
    ...(data.membershipEnd && { expirationDate: new Date(data.membershipEnd).toISOString() }),
  };

  // Apple WWDR G4 Intermediate Certificate (öffentlich)
  const wwdrRes = await fetch('https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer');
  const wwdr = Buffer.from(await wwdrRes.arrayBuffer());

  // ponytail: passkit-generator types expect directory path for model; inline Buffer-Map requires cast
  const pass = await PKPass.from(
    {
      model: { 'pass.json': Buffer.from(JSON.stringify(passJson)) } as unknown as string,
      certificates: {
        wwdr,
        signerCert: p12,
        signerKey: p12,
        signerKeyPassphrase: process.env.APPLE_WALLET_CERT_PASSWORD!,
      },
    },
    {}
  );

  return pass.getAsBuffer();
}
