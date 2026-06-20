import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { EmailService as InfraEmailService } from '@/src/infrastructure/email/email.service';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface OnboardingEmailData {
  recipientName: string;
  recipientEmail: string;
  clubName: string;
  memberType: string;
  startDate?: Date;
  assignedGroup?: string;
  temporaryPassword?: string;
  welcomeGuideUrl?: string;
  clubAddress?: string;
  clubPhone?: string;
  clubEmail?: string;
}

export class EmailService {
  /**
   * Generate welcome email for new members
   */
  static generateWelcomeEmail(data: OnboardingEmailData): EmailTemplate {
    const {
      recipientName,
      clubName,
      memberType,
      startDate,
      assignedGroup,
      temporaryPassword,
      welcomeGuideUrl,
      clubAddress,
      clubPhone,
      clubEmail,
    } = data;

    const subject = `Willkommen bei ${clubName}!`;

    const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Willkommen bei ${clubName}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 28px;
      font-weight: bold;
    }
    .header p {
      margin: 0;
      font-size: 16px;
      opacity: 0.9;
    }
    .content {
      padding: 40px 30px;
    }
    .welcome-text {
      font-size: 18px;
      line-height: 1.8;
      margin-bottom: 20px;
    }
    .info-box {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 15px;
      margin: 20px 0;
    }
    .info-box h3 {
      margin: 0 0 10px 0;
      font-size: 16px;
      color: #667eea;
    }
    .info-box p {
      margin: 0;
      font-size: 14px;
      color: #666;
    }
    .info-box ul {
      margin: 10px 0 0 20px;
      padding-left: 20px;
    }
    .info-box li {
      margin-bottom: 5px;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      padding: 12px 30px;
      border-radius: 5px;
      font-weight: bold;
      margin: 20px 0;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .divider {
      border-top: 1px solid #e5e5e5;
      margin: 30px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎾 Willkommen bei ${clubName}!</h1>
      <p>Deine Tennis-Reise beginnt jetzt</p>
    </div>

    <div class="content">
      <p class="welcome-text">
        Hallo ${recipientName},
      </p>

      <p class="welcome-text">
        herzlich willkommen bei ${clubName}! Wir freuen uns sehr, dass du dich für unseren Tennisclub entschieden hast.
        ${memberType === 'member' ? 'Als neues Mitglied wirst du Teil unserer Tennis-Community.' : ''}
      </p>

      ${
        startDate
          ? `
      <div class="info-box">
        <h3>📅 Dein Starttermin</h3>
        <p>
          Dein Training beginnt am <strong>${format(startDate, 'EEEE, dd. MMMM yyyy', { locale: de })}</strong>.
          Wir freuen uns darauf, dich beim ersten Training begrüßen zu dürfen!
        </p>
      </div>
      `
          : ''
      }

      ${
        assignedGroup
          ? `
      <div class="info-box">
        <h3>👥 Deine Trainingsgruppe</h3>
        <p>
          Du wurdest der Gruppe <strong>${assignedGroup}</strong> zugeteilt.
          Unser Trainer wird dich bei deinem ersten Training begrüßen und dich in die Gruppe integrieren.
        </p>
      </div>
      `
          : ''
      }

      ${
        temporaryPassword
          ? `
      <div class="info-box">
        <h3>🔐 Dein temporäres Passwort</h3>
        <p>
          Hier ist dein temporäres Passwort für den ersten Login:
        </p>
        <p style="font-family: monospace; background: #f0f0f0; padding: 10px; border-radius: 4px; font-size: 16px; letter-spacing: 2px;">
          ${temporaryPassword}
        </p>
        <p style="font-size: 12px; color: #999; margin-top: 10px;">
          Bitte ändere dein Passwort nach dem ersten Login.
        </p>
      </div>
      `
          : ''
      }

      <div class="info-box">
        <h3>📋 Nächste Schritte</h3>
        <ul>
          <li>Logge dich mit deinen Zugangsdaten ein</li>
          <li>Vervollständige dein Profil unter "Mein Profil"</li>
          <li>Buche deine ersten Trainingssessions</li>
          <li>Stelle deine Benachrichtigungseinstellungen ein</li>
        </ul>
      </div>

      ${
        welcomeGuideUrl
          ? `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${welcomeGuideUrl}" class="cta-button">
          📖 Willkommensguide ansehen
        </a>
      </div>
      `
          : ''
      }

      <div class="divider"></div>

      <div class="info-box">
        <h3>📍 Club-Informationen</h3>
        <p>
          <strong>${clubName}</strong><br>
          ${clubAddress || ''}<br>
          ${clubPhone ? `Tel: ${clubPhone}` : ''}<br>
          ${clubEmail ? `E-Mail: ${clubEmail}` : ''}
        </p>
      </div>

      <p class="welcome-text">
        Bei Fragen oder Problemen stehen wir dir gerne zur Verfügung.
        Wir wünschen dir viel Spaß und Erfolg beim Training!
      </p>

      <p class="welcome-text">
        Beste Grüße,<br>
        Dein ${clubName}-Team
      </p>
    </div>

    <div class="footer">
      <p>Diese E-Mail wurde automatisch generiert. Bitte antworte nicht direkt auf diese E-Mail.</p>
      <p>
        © ${new Date().getFullYear()} ${clubName}. Alle Rechte vorbehalten.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Willkommen bei ${clubName}!

Hallo ${recipientName},

herzlich willkommen bei ${clubName}! Wir freuen uns sehr, dass du dich für unseren Tennisclub entschieden hast.

${startDate ? `Dein Training beginnt am ${format(startDate, 'EEEE, dd. MMMM yyyy', { locale: de })}.` : ''}

${assignedGroup ? `Du wurdest der Gruppe ${assignedGroup} zugeteilt.` : ''}

${temporaryPassword ? `Dein temporäres Passwort: ${temporaryPassword}` : ''}

Nächste Schritte:
- Logge dich mit deinen Zugangsdaten ein
- Vervollständige dein Profil
- Buche deine ersten Trainingssessions
- Stelle deine Benachrichtigungseinstellungen ein

Bei Fragen stehen wir dir gerne zur Verfügung.

Beste Grüße,
Dein ${clubName}-Team
    `.trim();

    return { subject, html, text };
  }

  /**
   * Generate trial training confirmation email
   */
  static generateTrialTrainingEmail(data: OnboardingEmailData): EmailTemplate {
    const { recipientName, clubName, startDate, clubAddress, clubPhone, clubEmail } = data;

    const subject = `Dein Probetraining bei ${clubName}`;

    const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Probetraining bei ${clubName}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 28px;
      font-weight: bold;
    }
    .header p {
      margin: 0;
      font-size: 16px;
      opacity: 0.9;
    }
    .content {
      padding: 40px 30px;
    }
    .welcome-text {
      font-size: 18px;
      line-height: 1.8;
      margin-bottom: 20px;
    }
    .info-box {
      background: #f8f9fa;
      border-left: 4px solid #10b981;
      padding: 15px;
      margin: 20px 0;
    }
    .info-box h3 {
      margin: 0 0 10px 0;
      font-size: 16px;
      color: #10b981;
    }
    .info-box p {
      margin: 0;
      font-size: 14px;
      color: #666;
    }
    .info-box ul {
      margin: 10px 0 0 20px;
      padding-left: 20px;
    }
    .info-box li {
      margin-bottom: 5px;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .footer a {
      color: #10b981;
      text-decoration: none;
    }
    .divider {
      border-top: 1px solid #e5e5e5;
      margin: 30px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎾 Probetraining bei ${clubName}</h1>
      <p>Dein erstes Training steht bevor!</p>
    </div>

    <div class="content">
      <p class="welcome-text">
        Hallo ${recipientName},
      </p>

      <p class="welcome-text">
        vielen Dank für dein Interesse an ${clubName}! Wir freuen uns sehr, dass du unser Probetraining buchen möchtest.
      </p>

      ${
        startDate
          ? `
      <div class="info-box">
        <h3>📅 Dein Probetraining</h3>
        <p>
          Dein Probetraining findet am <strong>${format(startDate, 'EEEE, dd. MMMM yyyy', { locale: de })}</strong> statt.
          Bitte komme 10 Minuten vor Beginn an, damit wir pünktlich starten können.
        </p>
      </div>
      `
          : ''
      }

      <div class="info-box">
        <h3>📋 Was erwartet dich beim Probetraining?</h3>
        <ul>
          <li>Kostenlose 60-minütige Trainingseinheit</li>
          <li>Professionelle Trainerführung</li>
          <li>Kennenlernen unserer Anlagen und Trainer</li>
          <li>Individuelle Beratung zu passenden Trainingsgruppen</li>
        </ul>
      </div>

      <div class="info-box">
        <h3>📍 Wichtige Informationen</h3>
        <p>
          <strong>Treffpunkt:</strong> ${clubAddress || 'Wird nach Bestätigung mitgeteilt'}<br>
          <strong>Dauer:</strong> 60 Minuten<br>
          <strong>Kleidung:</strong> Sportliche Kleidung und Tennisschuhe
        </p>
      </div>

      <div class="divider"></div>

      <div class="info-box">
        <h3>📞 Kontakt</h3>
        <p>
          Bei Fragen erreichbar unter:<br>
          ${clubPhone ? `Tel: ${clubPhone}` : ''}<br>
          ${clubEmail ? `E-Mail: ${clubEmail}` : ''}
        </p>
      </div>

      <p class="welcome-text">
        Wir freuen uns darauf, dich beim Probetraining begrüßen zu dürfen!
      </p>

      <p class="welcome-text">
        Beste Grüße,<br>
        Dein ${clubName}-Team
      </p>
    </div>

    <div class="footer">
      <p>Diese E-Mail wurde automatisch generiert. Bitte antworte nicht direkt auf diese E-Mail.</p>
      <p>
        © ${new Date().getFullYear()} ${clubName}. Alle Rechte vorbehalten.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Probetraining bei ${clubName}

Hallo ${recipientName},

vielen Dank für dein Interesse an ${clubName}! Wir freuen uns sehr, dass du unser Probetraining buchen möchtest.

${startDate ? `Dein Probetraining findet am ${format(startDate, 'EEEE, dd. MMMM yyyy', { locale: de })} statt.` : ''}

Was erwartet dich beim Probetraining?
- Kostenlose 60-minütige Trainingseinheit
- Professionelle Trainerführung
- Kennenlernen unserer Anlagen und Trainer
- Individuelle Beratung zu passenden Trainingsgruppen

Wichtige Informationen:
- Treffpunkt: ${clubAddress || 'Wird nach Bestätigung mitgeteilt'}
- Dauer: 60 Minuten
- Kleidung: Sportliche Kleidung und Tennisschuhe

Bei Fragen erreichbar unter:
${clubPhone ? `Tel: ${clubPhone}` : ''}
${clubEmail ? `E-Mail: ${clubEmail}` : ''}

Wir freuen uns darauf, dich beim Probetraining begrüßen zu dürfen!

Beste Grüße,
Dein ${clubName}-Team
    `.trim();

    return { subject, html, text };
  }

  /**
   * Generate membership approval email
   */
  static generateMembershipApprovalEmail(data: OnboardingEmailData): EmailTemplate {
    const {
      recipientName,
      clubName,
      memberType,
      startDate,
      assignedGroup,
      clubAddress,
      clubPhone,
      clubEmail,
    } = data;

    const subject = `Deine Mitgliedschaft bei ${clubName} wurde genehmigt`;

    const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mitgliedschaft genehmigt - ${clubName}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 28px;
      font-weight: bold;
    }
    .header p {
      margin: 0;
      font-size: 16px;
      opacity: 0.9;
    }
    .content {
      padding: 40px 30px;
    }
    .welcome-text {
      font-size: 18px;
      line-height: 1.8;
      margin-bottom: 20px;
    }
    .info-box {
      background: #f8f9fa;
      border-left: 4px solid #10b981;
      padding: 15px;
      margin: 20px 0;
    }
    .info-box h3 {
      margin: 0 0 10px 0;
      font-size: 16px;
      color: #10b981;
    }
    .info-box p {
      margin: 0;
      font-size: 14px;
      color: #666;
    }
    .info-box ul {
      margin: 10px 0 0 20px;
      padding-left: 20px;
    }
    .info-box li {
      margin-bottom: 5px;
    }
    .success-box {
      background: #d4edda;
      border-left: 4px solid #28a745;
      padding: 15px;
      margin: 20px 0;
    }
    .success-box h3 {
      margin: 0 0 10px 0;
      font-size: 16px;
      color: #28a745;
    }
    .success-box p {
      margin: 0;
      font-size: 14px;
      color: #155724;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .footer a {
      color: #10b981;
      text-decoration: none;
    }
    .divider {
      border-top: 1px solid #e5e5e5;
      margin: 30px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Willkommen als Mitglied!</h1>
      <p>Deine Mitgliedschaft bei ${clubName} wurde genehmigt</p>
    </div>

    <div class="content">
      <p class="welcome-text">
        Hallo ${recipientName},
      </p>

      <p class="welcome-text">
        großartig! Deine Mitgliedschaft bei ${clubName} wurde erfolgreich genehmigt.
        Wir freuen uns sehr, dass du nun offiziell Teil unserer Tennis-Community bist.
      </p>

      <div class="success-box">
        <h3>✅ Mitgliedschaft aktiviert</h3>
        <p>
          Dein Account ist jetzt aktiv und du kannst alle Funktionen des Clubs nutzen.
          ${memberType === 'member' ? 'Als vollwertiges Mitglied hast du Zugriff auf alle Trainingsgruppen und Buchungen.' : ''}
        </p>
      </div>

      ${
        startDate
          ? `
      <div class="info-box">
        <h3>📅 Dein Starttermin</h3>
        <p>
          Dein Training beginnt am <strong>${format(startDate, 'EEEE, dd. MMMM yyyy', { locale: de })}</strong>.
          Wir empfehlen dir, dich vorab mit unserem Trainer abzustimmen.
        </p>
      </div>
      `
          : ''
      }

      ${
        assignedGroup
          ? `
      <div class="info-box">
        <h3>👥 Deine Trainingsgruppe</h3>
        <p>
          Du wurdest der Gruppe <strong>${assignedGroup}</strong> zugeteilt.
          Unser Trainer wird dich bei deinem ersten Training begrüßen und dich in die Gruppe integrieren.
        </p>
      </div>
      `
          : ''
      }

      <div class="info-box">
        <h3>📋 Nächste Schritte</h3>
        <ul>
          <li>Logge dich mit deinen Zugangsdaten ein</li>
          <li>Vervollständige dein Profil unter "Mein Profil"</li>
          <li>Buche deine ersten Trainingssessions</li>
          <li>Stelle deine Benachrichtigungseinstellungen ein</li>
          <li>Informiere dich über unsere Trainingsgruppen</li>
        </ul>
      </div>

      <div class="divider"></div>

      <div class="info-box">
        <h3>📍 Club-Informationen</h3>
        <p>
          <strong>${clubName}</strong><br>
          ${clubAddress || ''}<br>
          ${clubPhone ? `Tel: ${clubPhone}` : ''}<br>
          ${clubEmail ? `E-Mail: ${clubEmail}` : ''}
        </p>
      </div>

      <p class="welcome-text">
        Bei Fragen oder Problemen stehen wir dir gerne zur Verfügung.
        Wir wünschen dir viel Spaß und Erfolg beim Training!
      </p>

      <p class="welcome-text">
        Beste Grüße,<br>
        Dein ${clubName}-Team
      </p>
    </div>

    <div class="footer">
      <p>Diese E-Mail wurde automatisch generiert. Bitte antworte nicht direkt auf diese E-Mail.</p>
      <p>
        © ${new Date().getFullYear()} ${clubName}. Alle Rechte vorbehalten.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Mitgliedschaft genehmigt - ${clubName}

Hallo ${recipientName},

großartig! Deine Mitgliedschaft bei ${clubName} wurde erfolgreich genehmigt.
Wir freuen uns sehr, dass du nun offiziell Teil unserer Tennis-Community bist.

${startDate ? `Dein Training beginnt am ${format(startDate, 'EEEE, dd. MMMM yyyy', { locale: de })}.` : ''}

${assignedGroup ? `Du wurdest der Gruppe ${assignedGroup} zugeteilt.` : ''}

Nächste Schritte:
- Logge dich mit deinen Zugangsdaten ein
- Vervollständige dein Profil
- Buche deine ersten Trainingssessions
- Stelle deine Benachrichtigungseinstellungen ein
- Informiere dich über unsere Trainingsgruppen

Bei Fragen stehen wir dir gerne zur Verfügung.

Beste Grüße,
Dein ${clubName}-Team
    `.trim();

    return { subject, html, text };
  }

  /**
   * Generate rejection email
   */
  static generateRejectionEmail(data: OnboardingEmailData & { reason: string }): EmailTemplate {
    const { recipientName, clubName, clubPhone, clubEmail, reason } = data;

    const subject = `Deine Bewerbung bei ${clubName}`;

    const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bewerbung - ${clubName}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 28px;
      font-weight: bold;
    }
    .header p {
      margin: 0;
      font-size: 16px;
      opacity: 0.9;
    }
    .content {
      padding: 40px 30px;
    }
    .welcome-text {
      font-size: 18px;
      line-height: 1.8;
      margin-bottom: 20px;
    }
    .info-box {
      background: #f8f9fa;
      border-left: 4px solid #ef4444;
      padding: 15px;
      margin: 20px 0;
    }
    .info-box h3 {
      margin: 0 0 10px 0;
      font-size: 16px;
      color: #ef4444;
    }
    .info-box p {
      margin: 0;
      font-size: 14px;
      color: #666;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .footer a {
      color: #ef4444;
      text-decoration: none;
    }
    .divider {
      border-top: 1px solid #e5e5e5;
      margin: 30px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>❌ Bewerbung abgelehnt</h1>
      <p>Deine Bewerbung bei ${clubName}</p>
    </div>

    <div class="content">
      <p class="name">
        Hallo ${recipientName},
      </p>

      <p class="welcome-text">
        leider müssen wir dir mitteilen, dass deine Bewerbung bei ${clubName} zum aktuellen Zeitpunkt abgelehnt werden musste.
      </p>

      <div class="info-box">
        <h3>📋 Grund der Ablehnung</h3>
        <p>
          ${reason}
        </p>
      </div>

      <div class="info-box">
        <h3>💡 Was kannst du tun?</h3>
        <ul>
          <li>Warte 30 Tage und bewirb dich erneut</li>
          <li>Verbessere deine Tennisfähigkeiten und bewirb dich später wieder</li>
          <li>Kontaktiere uns für eine persönliche Beratung</li>
          <li>Erwäge eine Mitgliedschaft in einem anderen Tennisclub</li>
        </ul>
      </div>

      <div class="divider"></div>

      <div class="info-box">
        <h3>📞 Kontakt</h3>
        <p>
          Bei Fragen erreichbar unter:<br>
          ${clubPhone ? `Tel: ${clubPhone}` : ''}<br>
          ${clubEmail ? `E-Mail: ${clubEmail}` : ''}
        </p>
      </div>

      <p class="welcome-text">
        Wir bedauern die Entscheidung und wünschen dir alles Gute für deine weitere Tennis-Karriere.
      </p>

      <p class="welcome-text">
        Beste Grüße,<br>
        Dein ${clubName}-Team
      </p>
    </div>

    <div class="footer">
      <p>Diese E-Mail wurde automatisch generiert. Bitte antworte nicht direkt auf diese E-Mail.</p>
      <p>
        © ${new Date().getFullYear()} ${clubName}. Alle Rechte vorbehalten.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Bewerbung abgelehnt - ${clubName}

Hallo ${recipientName},

leider müssen wir dir mitteilen, dass deine Bewerbung bei ${clubName} zum aktuellen Zeitpunkt abgelehnt werden musste.

Grund der Ablehnung:
${reason}

Was kannst du tun?
- Warte 30 Tage und bewirb dich erneut
- Verbessere deine Tennisfähigkeiten und bewirb dich später wieder
          - Kontaktiere uns für eine persönliche Beratung
          - Erwäge eine Mitgliedschaft in einem anderen Tennisclub

Wir bedauern die Entscheidung und wünschen dir alles Gute für deine weitere Tennis-Karriere.

Beste Grüße,
Dein ${clubName}-Team
    `.trim();

    return { subject, html, text };
  }

  /**
   * Send email via Resend infrastructure service
   */
  static async sendEmail(to: string, email: EmailTemplate): Promise<boolean> {
    try {
      const infraEmail = new InfraEmailService();
      await infraEmail.sendEmail({ to, ...email });
      return true;
    } catch (error) {
      console.error('Email send error:', error);
      return false;
    }
  }

  /**
   * Send welcome email
   */
  static async sendWelcomeEmail(data: OnboardingEmailData): Promise<boolean> {
    const email = this.generateWelcomeEmail(data);
    return this.sendEmail(data.recipientEmail, email);
  }

  /**
   * Send trial training email
   */
  static async sendTrialTrainingEmail(data: OnboardingEmailData): Promise<boolean> {
    const email = this.generateTrialTrainingEmail(data);
    return this.sendEmail(data.recipientEmail, email);
  }

  /**
   * Send membership approval email
   */
  static async sendMembershipApprovalEmail(data: OnboardingEmailData): Promise<boolean> {
    const email = this.generateMembershipApprovalEmail(data);
    return this.sendEmail(data.recipientEmail, email);
  }

  /**
   * Send rejection email
   */
  static async sendRejectionEmail(
    data: OnboardingEmailData & { reason: string }
  ): Promise<boolean> {
    const email = this.generateRejectionEmail(data);
    return this.sendEmail(data.recipientEmail, email);
  }

  /**
   * Generate admin notification email for new trial training request
   */
  static generateNewTrialRequestEmail(data: {
    adminName: string;
    participantName: string;
    participantEmail: string;
    participantPhone: string;
    preferredDate: string;
    preferredTime: string;
    experienceLevel?: string;
    notes?: string;
    clubName: string;
    adminDashboardUrl: string;
  }): EmailTemplate {
    const {
      adminName,
      participantName,
      participantEmail,
      participantPhone,
      preferredDate,
      preferredTime,
      experienceLevel,
      notes,
      clubName,
      adminDashboardUrl,
    } = data;

    const subject = `Neue Probetraining-Anfrage – ${participantName}`;

    const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Neue Probetraining-Anfrage</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 24px;
      font-weight: bold;
    }
    .header p {
      margin: 0;
      font-size: 16px;
      opacity: 0.9;
    }
    .content {
      padding: 30px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
    }
    .info-box {
      background: #f8f9fa;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-box h3 {
      margin: 0 0 10px 0;
      font-size: 16px;
      color: #d97706;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
    }
    .info-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #eee;
      font-size: 14px;
    }
    .info-table td:first-child {
      font-weight: bold;
      color: #555;
      width: 40%;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white;
      text-decoration: none;
      padding: 12px 30px;
      border-radius: 5px;
      font-weight: bold;
      margin: 20px 0;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎾 Neue Probetraining-Anfrage</h1>
      <p>${clubName}</p>
    </div>

    <div class="content">
      <p class="greeting">
        Hallo ${adminName},
      </p>

      <p>
        eine neue Probetraining-Anfrage ist über die öffentliche Buchungsseite eingegangen.
        Bitte überprüfe die Details und weise einen Trainer und Platz zu.
      </p>

      <div class="info-box">
        <h3>👤 Teilnehmer</h3>
        <table class="info-table">
          <tr><td>Name</td><td>${participantName}</td></tr>
          <tr><td>E-Mail</td><td>${participantEmail}</td></tr>
          <tr><td>Telefon</td><td>${participantPhone}</td></tr>
          ${experienceLevel ? `<tr><td>Spielstärke</td><td>${experienceLevel}</td></tr>` : ''}
        </table>
      </div>

      <div class="info-box">
        <h3>📅 Wunschtermin</h3>
        <table class="info-table">
          <tr><td>Datum</td><td>${preferredDate}</td></tr>
          <tr><td>Uhrzeit</td><td>${preferredTime} Uhr</td></tr>
        </table>
      </div>

      ${
        notes
          ? `
      <div class="info-box">
        <h3>📝 Anmerkungen</h3>
        <p style="font-size: 14px; color: #666;">${notes}</p>
      </div>
      `
          : ''
      }

      <div style="text-align: center; margin: 30px 0;">
        <a href="${adminDashboardUrl}" class="cta-button">
          📋 Zum Admin-Dashboard
        </a>
      </div>

      <p style="font-size: 14px; color: #888;">
        Du kannst die Anfrage im Admin-Bereich unter <strong>Probetrainings</strong> annehmen oder ablehnen.
      </p>
    </div>

    <div class="footer">
      <p>Diese E-Mail wurde automatisch von SwingZ generiert.</p>
      <p>© ${new Date().getFullYear()} SwingZ. Alle Rechte vorbehalten.</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Neue Probetraining-Anfrage – ${participantName}

Hallo ${adminName},

eine neue Probetraining-Anfrage ist eingegangen:

Teilnehmer: ${participantName}
E-Mail: ${participantEmail}
Telefon: ${participantPhone}
${experienceLevel ? `Spielstärke: ${experienceLevel}` : ''}

Wunschtermin: ${preferredDate} um ${preferredTime} Uhr
${notes ? `\nAnmerkungen: ${notes}` : ''}

Zum Admin-Dashboard: ${adminDashboardUrl}

Du kannst die Anfrage unter "Probetrainings" annehmen oder ablehnen.

Dein SwingZ-Team
    `.trim();

    return { subject, html, text };
  }

  /**
   * Send notification email to admins about a new trial training request
   */
  static async sendNewTrialRequestNotification(data: {
    adminEmail: string;
    adminName: string;
    participantName: string;
    participantEmail: string;
    participantPhone: string;
    preferredDate: string;
    preferredTime: string;
    experienceLevel?: string;
    notes?: string;
    clubName: string;
    adminDashboardUrl: string;
  }): Promise<boolean> {
    const email = this.generateNewTrialRequestEmail(data);
    return this.sendEmail(data.adminEmail, email);
  }

  /**
   * Generate participant confirmation email for a new trial training request.
   * Sent immediately after submission — before admin review.
   */
  static generateTrialRequestConfirmationEmail(data: {
    participantName: string;
    participantEmail: string;
    preferredDate: string;
    preferredTime: string;
    clubName: string;
  }): EmailTemplate {
    const { participantName, preferredDate, preferredTime, clubName } = data;

    const subject = `Deine Probetraining-Anfrage bei ${clubName} ist eingegangen`;

    const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Probetraining-Anfrage eingegangen</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 26px;
      font-weight: bold;
    }
    .header p {
      margin: 0;
      font-size: 16px;
      opacity: 0.9;
    }
    .content {
      padding: 30px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
    }
    .info-box {
      background: #f8f9fa;
      border-left: 4px solid #10b981;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-box h3 {
      margin: 0 0 10px 0;
      font-size: 16px;
      color: #059669;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
    }
    .info-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #eee;
      font-size: 14px;
    }
    .info-table td:first-child {
      font-weight: bold;
      color: #555;
      width: 40%;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Anfrage eingegangen!</h1>
      <p>${clubName}</p>
    </div>

    <div class="content">
      <p class="greeting">
        Hallo ${participantName},
      </p>

      <p>
        vielen Dank fuer deine Probetraining-Anfrage! Wir haben deine Anfrage erhalten und melden uns
        in Kuerze mit einer Bestaetigung bei dir.
      </p>

      <div class="info-box">
        <h3>Dein Wunschtermin</h3>
        <table class="info-table">
          <tr><td>Datum</td><td>${preferredDate}</td></tr>
          <tr><td>Uhrzeit</td><td>${preferredTime} Uhr</td></tr>
          <tr><td>Verein</td><td>${clubName}</td></tr>
        </table>
      </div>

      <div class="info-box">
        <h3>Wie geht es weiter?</h3>
        <p style="font-size: 14px; color: #666;">
          Unser Team prueft deinen Wunschtermin und weist einen Trainer sowie einen Platz zu.
          Du erhaeltst eine separate Bestaеtigungs-E-Mail, sobald alles organisiert ist.
          Bei Rueckfragen antworte einfach auf diese E-Mail.
        </p>
      </div>

      <p style="font-size: 14px; color: #555;">
        Wir freuen uns darauf, dich beim Probetraining begruessen zu duerfen!
      </p>

      <p style="font-size: 14px; color: #555;">
        Beste Gruesse,<br>
        Dein ${clubName}-Team
      </p>
    </div>

    <div class="footer">
      <p>Diese E-Mail wurde automatisch von SwingZ generiert.</p>
      <p>&copy; ${new Date().getFullYear()} SwingZ. Alle Rechte vorbehalten.</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Probetraining-Anfrage eingegangen - ${clubName}

Hallo ${participantName},

vielen Dank fuer deine Probetraining-Anfrage! Wir haben deine Anfrage erhalten und melden uns
in Kuerze mit einer Bestaetigung bei dir.

Dein Wunschtermin:
- Datum: ${preferredDate}
- Uhrzeit: ${preferredTime} Uhr
- Verein: ${clubName}

Wie geht es weiter?
Unser Team prueft deinen Wunschtermin und weist einen Trainer sowie einen Platz zu.
Du erhaeltst eine separate Bestaеtigungs-E-Mail, sobald alles organisiert ist.

Wir freuen uns darauf, dich beim Probetraining begruessen zu duerfen!

Beste Gruesse,
Dein ${clubName}-Team
    `.trim();

    return { subject, html, text };
  }

  /**
   * Send confirmation email to the participant after a trial training request is submitted.
   */
  static async sendTrialRequestConfirmation(data: {
    participantName: string;
    participantEmail: string;
    preferredDate: string;
    preferredTime: string;
    clubName: string;
  }): Promise<boolean> {
    const email = this.generateTrialRequestConfirmationEmail(data);
    return this.sendEmail(data.participantEmail, email);
  }
}
