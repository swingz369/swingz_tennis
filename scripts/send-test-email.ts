import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM || 'SwingZ <noreply@swingz.cloud>';
const to = process.argv[2] || 'mike.swinger@gmx.de';

if (!apiKey) {
  console.error('❌ RESEND_API_KEY not set in .env.local');
  process.exit(1);
}

console.log(`📧 Sending test email...`);
console.log(`   From: ${from}`);
console.log(`   To:   ${to}`);

const resend = new Resend(apiKey);

const year = new Date().getFullYear();

resend.emails
  .send({
    from,
    to,
    subject: '🎾 SwingZ Test-E-Mail — Domain-Verifizierung erfolgreich!',
    html: `<!DOCTYPE html>
<html lang="de">
  <head><meta charset="utf-8" /></head>
  <body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;">
    <div style="max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:#1B4332;color:white;padding:24px;text-align:center;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;font-size:24px;">🎾 SwingZ</h1>
      </div>
      <div style="background:#f9f9f9;padding:32px 24px;">
        <h2 style="margin-top:0;color:#1B4332;">Domain-Verifizierung erfolgreich!</h2>
        <p>Diese Test-E-Mail bestätigt, dass <strong>noreply@swingz.cloud</strong> korrekt konfiguriert ist.</p>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0;"><strong>✅ Von:</strong> ${from}</p>
          <p style="margin:8px 0 0;"><strong>✅ Domain:</strong> swingz.cloud</p>
          <p style="margin:8px 0 0;"><strong>✅ Provider:</strong> Resend</p>
          <p style="margin:8px 0 0;"><strong>✅ Zeit:</strong> ${new Date().toLocaleString('de-DE')}</p>
        </div>
        <p style="color:#666;font-size:14px;">Alle automatischen E-Mails (Passwort-Reset, Buchungsbestätigungen, Mahnungen, Saison-Bestätigungen) werden jetzt über diese Domain versendet.</p>
      </div>
      <div style="text-align:center;margin-top:20px;color:#888;font-size:13px;">
        <p>© ${year} SwingZ – Premium Tennis Club Management</p>
      </div>
    </div>
  </body>
</html>`,
    text: `SwingZ Test-E-Mail\n\nDomain-Verifizierung erfolgreich!\n\nnoreply@swingz.cloud ist korrekt konfiguriert.\nVon: ${from}\nDomain: swingz.cloud\nProvider: Resend\n\n© ${year} SwingZ`,
  })
  .then(({ data, error }) => {
    if (error) {
      console.error('❌ Resend error:', JSON.stringify(error, null, 2));
      process.exit(1);
    }
    console.log('✅ E-Mail erfolgreich gesendet!');
    console.log(`   Message ID: ${data?.id}`);
  })
  .catch((err) => {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
  });
