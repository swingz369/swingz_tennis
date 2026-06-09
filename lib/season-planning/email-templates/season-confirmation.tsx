/**
 * Season Confirmation Email Template (React-Email TSX)
 *
 * Cross-client compatible email body for season-plan publications.
 * Rendered via @react-email/render → static HTML string.
 *
 * Used by: lib/season-planning/season-confirmation-email.service.ts
 */

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export interface SeasonConfirmationEmailProps {
  fullName: string;
  groupName: string;
  trainerName: string;
  totalSessions: number;
  seasonName: string;
  firstSessionTime: string | null;
  appUrl: string;
  /** Pre-formatted de-DE date string (e.g. "Montag, 15. März 2026") */
  formattedFirstSessionDate: string;
}

/**
 * Format helper exposed so the renderer can pass a stable de-DE label
 * without doing locale work at render time (React-Email renders server-side).
 */
export function formatDateDEDisplay(date: Date | null): string {
  if (!date) return 'wird noch festgelegt';
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function SeasonConfirmationEmail({
  fullName,
  groupName,
  trainerName,
  totalSessions,
  seasonName,
  firstSessionTime,
  appUrl,
  formattedFirstSessionDate,
}: SeasonConfirmationEmailProps) {
  const safeName = fullName || 'Mitglied';
  const firstSessionLine = firstSessionTime ? `um ${firstSessionTime} Uhr` : null;

  return (
    <Html lang="de">
      <Head>
        <title>Dein Trainingsplan für {seasonName}</title>
      </Head>
      <Preview>Dein Trainingsplan für {seasonName} ist da</Preview>
      <Body
        style={{
          backgroundColor: '#f6f7f9',
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          color: '#1a1a1a',
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            backgroundColor: '#ffffff',
            maxWidth: '600px',
            margin: '32px auto',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {/* Header */}
          <Section
            style={{
              background: 'linear-gradient(135deg,#1e3a8a 0%,#3b82f6 100%)',
              padding: '32px 32px 24px 32px',
              color: '#ffffff',
            }}
          >
            <Heading
              as="h1"
              style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 700,
                color: '#ffffff',
              }}
            >
              🏆 Dein Trainingsplan steht!
            </Heading>
            <Text style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
              Saison {seasonName}
            </Text>
          </Section>

          {/* Body */}
          <Section style={{ padding: '32px' }}>
            <Text style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
              Hallo <strong>{safeName}</strong>,
            </Text>
            <Text
              style={{
                margin: '0 0 24px 0',
                fontSize: '15px',
                lineHeight: 1.5,
                color: '#4a5568',
              }}
            >
              schön, dass du wieder dabei bist! Hier sind deine Zuordnungen für die kommende Saison:
            </Text>

            {/* Group + Trainer Card */}
            <Section
              style={{
                backgroundColor: '#f0f9ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '16px',
              }}
            >
              <Text
                style={{
                  margin: '0 0 6px 0',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  color: '#1e40af',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                }}
              >
                Deine Gruppe
              </Text>
              <Text
                style={{
                  margin: '0 0 16px 0',
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#1e3a8a',
                }}
              >
                {groupName}
              </Text>

              <Text
                style={{
                  margin: '0 0 6px 0',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  color: '#1e40af',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                }}
              >
                Dein Trainer
              </Text>
              <Text
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#1a1a1a',
                }}
              >
                {trainerName}
              </Text>
            </Section>

            {/* First Session Card */}
            <Section
              style={{
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '24px',
              }}
            >
              <Text
                style={{
                  margin: '0 0 6px 0',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  color: '#047857',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                }}
              >
                Erster Trainingstag
              </Text>
              <Text
                style={{
                  margin: '0 0 8px 0',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#064e3b',
                }}
              >
                {formattedFirstSessionDate}
              </Text>
              {firstSessionLine ? (
                <Text style={{ margin: 0, fontSize: '14px', color: '#065f46' }}>
                  ⏰ {firstSessionLine}
                </Text>
              ) : null}
              <Text
                style={{
                  margin: '12px 0 0 0',
                  fontSize: '13px',
                  color: '#047857',
                }}
              >
                Insgesamt <strong>{totalSessions}</strong> Trainingseinheiten in dieser Saison.
              </Text>
            </Section>

            {/* ICS Hint */}
            <Section
              style={{
                backgroundColor: '#fef3c7',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                padding: '16px 20px',
                marginBottom: '24px',
              }}
            >
              <Text style={{ margin: 0, fontSize: '14px', color: '#78350f' }}>
                📅 <strong>Kalender-Anhang:</strong> Im Anhang findest du eine{' '}
                <code
                  style={{
                    backgroundColor: '#fffbeb',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                  }}
                >
                  .ics
                </code>
                -Datei mit allen deinen Trainingsterminen. Importiere sie in deinen Kalender
                (Google, Apple, Outlook), damit du keinen Termin verpasst.
              </Text>
            </Section>

            <Text
              style={{
                margin: '0 0 16px 0',
                fontSize: '15px',
                lineHeight: 1.5,
                color: '#4a5568',
              }}
            >
              Du findest deine Trainingszeiten auch jederzeit in deinem{' '}
              <Link
                href={`${appUrl}/member`}
                style={{ color: '#3b82f6', textDecoration: 'underline' }}
              >
                SwingZ-Konto
              </Link>{' '}
              unter <em>„Meine Trainings"</em>.
            </Text>

            <Text
              style={{
                margin: '0 0 4px 0',
                fontSize: '15px',
                lineHeight: 1.5,
                color: '#4a5568',
              }}
            >
              Bei Fragen wende dich bitte direkt an deinen Trainer oder die Club-Administration.
            </Text>
          </Section>

          {/* Footer */}
          <Section
            style={{
              backgroundColor: '#f9fafb',
              padding: '20px 32px',
              borderTop: '1px solid #e5e7eb',
              textAlign: 'center',
            }}
          >
            <Text style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#6b7280' }}>
              Sportliche Grüße,
            </Text>
            <Text
              style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: 600,
                color: '#1a1a1a',
              }}
            >
              Dein SwingZ-Team 🎾
            </Text>
            <Hr style={{ borderColor: '#e5e7eb', margin: '16px 0' }} />
            <Text style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
              Diese E-Mail wurde automatisch generiert, da dein neuer Trainingsplan veröffentlicht
              wurde.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default SeasonConfirmationEmail;
