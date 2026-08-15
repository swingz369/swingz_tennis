// POST /api/seasons/[id]/planning/remind
// Sendet Erinnerungs-E-Mails an alle planungsrelevanten Mitglieder bzw. Trainer,
// die ihre Präferenzen noch nicht eingereicht haben — auch ohne angefangenen Entwurf.
// Body: { role?: 'member' | 'trainer' } (Default: 'member')

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth } from '@/lib/api-auth';
import { authorizeSeasonAccess } from '@/lib/season-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { db } from '@/src/infrastructure/persistence/db';
import {
  userClubMemberships,
  userTrainingPreferences,
  users,
} from '@/src/infrastructure/persistence/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
import { env } from '@/lib/env';
import { EmailService } from '@/src/infrastructure/email/email.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:planning:remind');

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
        // Zentrale Prüfung statt inline dupliziertem Rollen- und Clubcheck,
        // siehe lib/season-auth.ts. Verhalten identisch: Superadmin und Owner
        // über den Fast-Path, sonst Mitgliedschaft im Club der Saison mit
        // Rolle admin oder superadmin.
        const access = await authorizeSeasonAccess(auth, seasonId, {
          allowedRoles: ['admin', 'superadmin'],
        });
        if (!access.ok) return access.response;
        const { season } = access;

        if (!season.preferences_open) {
          return NextResponse.json(
            { error: 'Präferenzen sind noch nicht geöffnet' },
            { status: 400 }
          );
        }

        if (!season.club_id) {
          return NextResponse.json({ error: 'Saison hat keinen Verein' }, { status: 400 });
        }

        const body = await request.json().catch(() => ({}) as { role?: string });
        const role: 'member' | 'trainer' = body?.role === 'trainer' ? 'trainer' : 'member';

        // Alle aktiven Mitglieder/Trainer des Vereins ohne eingereichte Präferenz —
        // auch die, die noch gar keinen Entwurf angelegt haben (Left Join)
        const roleFilters = [
          eq(userClubMemberships.club_id, season.club_id),
          eq(userClubMemberships.role, role),
          eq(userClubMemberships.is_active, true),
        ];
        if (role === 'member') {
          roleFilters.push(eq(userClubMemberships.include_in_planning, true));
        }

        const unsubmitted = await db
          .selectDistinct({
            user_id: users.id,
            email: users.email,
            full_name: users.full_name,
          })
          .from(userClubMemberships)
          .innerJoin(users, eq(userClubMemberships.user_id, users.id))
          .leftJoin(
            userTrainingPreferences,
            and(
              eq(userTrainingPreferences.user_id, userClubMemberships.user_id),
              eq(userTrainingPreferences.season_id, seasonId)
            )
          )
          .where(
            and(
              ...roleFilters,
              or(
                isNull(userTrainingPreferences.id),
                eq(userTrainingPreferences.is_submitted, false)
              )
            )
          );

        if (unsubmitted.length === 0) {
          return NextResponse.json({
            sent: 0,
            sentCount: 0,
            pendingCount: 0,
            message:
              role === 'trainer'
                ? 'Alle Trainer haben ihre Verfügbarkeiten bereits abgegeben.'
                : 'Alle Mitglieder haben ihre Präferenzen bereits abgegeben.',
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
            const what =
              role === 'trainer'
                ? 'deine Verfügbarkeiten als Trainer'
                : 'deine Trainings-Präferenzen';
            const why =
              role === 'trainer'
                ? 'So können wir die Trainingsgruppen passend zu deinen Zeiten planen.'
                : 'So können wir sicherstellen, dass du in einer passenden Trainingsgruppe eingeteilt wirst.';

            const templates = unsubmitted.map((m) => ({
              to: m.email,
              subject: `Erinnerung: Präferenzen für ${seasonName} - SwingZ`,
              html: `
                <h1>Präferenz-Erinnerung</h1>
                <p>Hallo ${m.full_name || (role === 'trainer' ? 'Trainer' : 'Mitglied')},</p>
                <p>Du hast ${what} für die <strong>${seasonName}</strong> noch nicht abgegeben.</p>
                <p>Bitte melde dich in deinem SwingZ-Konto an und gib deine Verfügbarkeiten und Wünsche bis zum <strong>${deadline}</strong> an.</p>
                <p>${why}</p>
                <br/>
                <p>Sportliche Grüße,<br/>Dein SwingZ-Team</p>
              `,
              text: `Hallo ${m.full_name || (role === 'trainer' ? 'Trainer' : 'Mitglied')},\n\nDu hast ${what} für die ${seasonName} noch nicht abgegeben.\nBitte melde dich in deinem SwingZ-Konto an und gib deine Verfügbarkeiten und Wünsche bis zum ${deadline} an.\n\nSportliche Grüße,\nDein SwingZ-Team`,
            }));

            await emailService.sendBatchEmails(templates);
            sentCount = templates.length;
          } catch (emailError) {
            log.error(
              '[Remind] Email batch failed:',
              emailError instanceof Error ? emailError : undefined
            );
          }
        }

        return NextResponse.json({
          sent: sentCount,
          sentCount,
          pendingCount: unsubmitted.length,
          message: `${sentCount} von ${unsubmitted.length} Erinnerungen versendet`,
        });
      } catch (error) {
        log.error('POST remind error:', error instanceof Error ? error : undefined);
        return internalErrorResponse();
      }
    });
  });
}
