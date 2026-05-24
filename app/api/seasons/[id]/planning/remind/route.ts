// POST /api/seasons/[id]/planning/remind
// Sendet Erinnerungs-E-Mails an Mitglieder, die noch keine Präferenzen abgegeben haben

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { getDb } from '@/src/infrastructure/persistence/client';
import { seasons, userTrainingPreferences, users } from '@/src/infrastructure/persistence/schema';
import { eq, and } from 'drizzle-orm';
import { env } from '@/lib/env';
import { EmailService } from '@/src/infrastructure/email/email.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, { max: 5, windowMs: 3600000 });
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      try {
        const { id: seasonId } = await context.params;
        const [season] = await getDb().select().from(seasons).where(eq(seasons.id, seasonId));
        if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

        const isAdmin = await verifyRole(auth, 'admin');
        const isSuperadmin = await verifyRole(auth, 'superadmin');
        if (!isAdmin && !isSuperadmin) return forbiddenResponse('Nur Admins');
        if (!isSuperadmin && season.club_id !== auth.clubId)
          return forbiddenResponse('Kein Zugriff');

        if (!season.preferences_open) {
          return NextResponse.json(
            { error: 'Präferenzen sind noch nicht geöffnet' },
            { status: 400 }
          );
        }

        // Find members who haven't submitted preferences
        const unsubmitted = await getDb()
          .select({
            user_id: userTrainingPreferences.user_id,
            email: users.email,
            full_name: users.full_name,
          })
          .from(userTrainingPreferences)
          .innerJoin(users, eq(userTrainingPreferences.user_id, users.id))
          .where(
            and(
              eq(userTrainingPreferences.season_id, seasonId),
              eq(userTrainingPreferences.is_submitted, false),
              eq(userTrainingPreferences.user_role, 'member')
            )
          );

        if (unsubmitted.length === 0) {
          return NextResponse.json({
            sentCount: 0,
            message: 'Alle Mitglieder haben ihre Präferenzen bereits abgegeben.',
          });
        }

        let sentCount = 0;

        if (env.RESEND_API_KEY) {
          try {
            const emailService = new EmailService();
            const seasonName = season.name || `Saison ${season.year}`;
            const deadline = season.preferences_deadline
              ? new Date(season.preferences_deadline).toLocaleDateString('de-DE')
              : 'bald';

            const templates = unsubmitted.map((m) => ({
              to: m.email,
              subject: `Erinnerung: Präferenzen für ${seasonName} - SwingZ`,
              html: `
                <h1>Präferenz-Erinnerung</h1>
                <p>Hallo ${m.full_name || 'Mitglied'},</p>
                <p>Du hast deine Trainings-Präferenzen für die <strong>${seasonName}</strong> noch nicht abgegeben.</p>
                <p>Bitte melde dich in deinem SwingZ-Konto an und gib deine Verfügbarkeiten und Wünsche bis zum <strong>${deadline}</strong> an.</p>
                <p>So können wir sicherstellen, dass du in einer passenden Trainingsgruppe eingeteilt wirst.</p>
                <br/>
                <p>Sportliche Grüße,<br/>Dein SwingZ-Team</p>
              `,
              text: `Hallo ${m.full_name || 'Mitglied'},\n\nDu hast deine Trainings-Präferenzen für die ${seasonName} noch nicht abgegeben.\nBitte melde dich in deinem SwingZ-Konto an und gib deine Verfügbarkeiten und Wünsche bis zum ${deadline} an.\n\nSportliche Grüße,\nDein SwingZ-Team`,
            }));

            await emailService.sendBatchEmails(templates);
            sentCount = templates.length;
          } catch (emailError) {
            console.error('[Remind] Email batch failed:', emailError);
          }
        }

        return NextResponse.json({
          sentCount,
          pendingCount: unsubmitted.length,
          message:
            unsubmitted.length > 0
              ? `${sentCount} von ${unsubmitted.length} Erinnerungen versendet`
              : 'Keine ausstehenden Präferenzen',
        });
      } catch (error) {
        console.error('POST remind error:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Reminder failed' },
          { status: 500 }
        );
      }
    });
  });
}
