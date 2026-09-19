// POST /api/seasons/[id]/planning/confirm
// Schritt 6: Final confirmation and plan publishing

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { ApiException, safeErrorMessage } from '@/lib/api-error';
import { SeasonPlanningService } from '@/application/services/season-planning.service';
import { checkRateLimitOrFail, releaseRateLimitSlot } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { conflictRepositoryFor } from '@/infrastructure/persistence/repositories/conflict-detection.repository';
import { detectConflictsForSeason } from '@/lib/season-planning/conflict-detector';
import { seasonConfirmationEmailService } from '@/lib/season-planning/season-confirmation-email.service';
import { env } from '@/lib/env';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:confirm-plan');
import type { ConfirmPlanRequest, ConfirmPlanResponse } from '@/lib/season-planning/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, {
      max: 3,
      windowMs: 3600000,
      message:
        'Zu viele Veröffentlichungsversuche. Bitte warten Sie eine Stunde — Veröffentlichen legt hunderte Trainingseinheiten, E-Mails und Rechnungen an.',
    });
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      try {
        const { id: seasonId } = await context.params;
        const planning = new SeasonPlanningService(auth);
        const season = await planning.season(seasonId);

        const body: ConfirmPlanRequest = await request.json();

        const entries = await planning.planEntries(seasonId);

        if (entries.length === 0) {
          return NextResponse.json(
            {
              error:
                'Keine Planeinträge vorhanden. Bitte zuerst im Schritt "Stundenplan bearbeiten" den Algorithmus ausführen.',
            },
            { status: 400 }
          );
        }

        // Konflikte über denselben Weg erkennen wie Konfliktseite und Wizard —
        // inklusive der persistierten "gelöst"/"ignoriert"-Entscheidungen.
        // Vorher lief hier eine zweite, eigene Erkennung ohne diese
        // Entscheidungen: ein als gelöst markierter kritischer Konflikt
        // verschwand in der Oberfläche, blockierte das Veröffentlichen aber
        // weiter mit 409 — ohne dass der Admin noch etwas tun konnte.
        const conflictRepo = conflictRepositoryFor(auth);
        const { conflicts } = await detectConflictsForSeason(
          seasonId,
          season.club_id,
          conflictRepo
        );
        const unresolvedCritical = conflicts.filter(
          (c) => c.severity === 'critical' && c.status === 'open'
        );

        if (unresolvedCritical.length > 0) {
          // Abgelehnt, nichts angelegt — der Versuch geht nicht aufs Kontingent.
          // Sonst kostet gerade der sorgfältige Admin, der Konflikte behebt und
          // erneut prüft, seine drei Stundenversuche.
          await releaseRateLimitSlot(request);
          return NextResponse.json(
            {
              success: false,
              error: 'Kritische Konflikte müssen behoben werden',
              unresolvedCriticalConflicts: unresolvedCritical.map((c) => ({
                id: c.id,
                type: c.type,
                description: c.description,
              })),
            },
            { status: 409 }
          );
        }

        // Berechnung und atomares Schreiben (Sessions, Buchungen, Status, Konflikte, Protokoll).
        const { publishedCount, publishedIds, bookingsCreated, removedSessions, isRepublish } =
          await planning.publish(season, entries, conflicts, body.adminNotes ?? null);

        // ── Post-transaction (non-critical) ───────────────────────────────
        // These run AFTER the transaction commits.
        // • Holiday sessions are already filtered out during creation
        //   (see isDateInHolidays check in the session loop above).
        // • Email notifications should only go out after a successful publish.
        // Failures here are logged but do not roll back the publish.
        // ──────────────────────────────────────────────────────────────────

        // ---- Auto-generate detailed invoices for season participants ----
        let invoicesCreated = 0;
        if (publishedIds.length > 0) {
          try {
            const { SeasonBillingService } =
              await import('@/application/services/season-billing.service');
            // Beim erneuten Veröffentlichen ändert sich die Zahl der Einheiten —
            // die noch offenen Rechnungen müssen mitziehen, sonst bleibt der
            // Betrag des ersten Publish stehen.
            const result = await new SeasonBillingService(auth).generateInvoices(seasonId, {
              replaceDrafts: isRepublish,
            });
            invoicesCreated = result.created.length;
            log.info('Season invoices created', {
              created: invoicesCreated,
              skipped: result.skipped.length,
            });
          } catch (invoiceError) {
            log.error(
              'Season invoice generation failed',
              invoiceError instanceof Error ? invoiceError : undefined
            );
          }
        }

        // ---- Send personalized email notifications with ICS attachments ----
        let notificationsSent = 0;
        let emailFailures = 0;
        if (env.RESEND_API_KEY && publishedIds.length > 0) {
          try {
            const seasonName = season.name || `Saison ${season.year}`;

            // Build per-recipient email data (group, trainer, first session, etc.)
            const recipients = await seasonConfirmationEmailService.buildRecipients(
              seasonId,
              entries.map((e) => ({
                expected_participants: (e.expected_participants as string[]) ?? null,
                trainer_id: e.trainer_id,
                group_id: e.group_id,
              })),
              publishedIds
            );

            if (recipients.length > 0) {
              const emailResult = await seasonConfirmationEmailService.sendConfirmationEmails({
                seasonId,
                seasonName,
                recipients,
                publishedSessionIds: publishedIds,
              });
              notificationsSent = emailResult.sent;
              emailFailures = emailResult.failed;
              log.info('Season confirmation emails sent', {
                sent: emailResult.sent,
                failed: emailResult.failed,
                total: recipients.length,
              });
            } else {
              log.info('No recipients to notify');
            }
          } catch (emailError) {
            log.error(
              'Email notification batch failed',
              emailError instanceof Error ? emailError : undefined
            );
            emailFailures = 1;
          }
        }

        const response: ConfirmPlanResponse & {
          invoicesCreated: number;
          emailFailures: number;
          bookingsCreated: number;
          removedSessions: number;
          republish: boolean;
        } = {
          success: true,
          publishedSessions: publishedCount,
          publishedSessionIds: publishedIds,
          notificationsSent,
          emailFailures,
          invoicesCreated,
          bookingsCreated,
          removedSessions,
          republish: isRepublish,
          waitlistNotifications: 0,
          unresolvedCriticalConflicts: [],
        };

        return NextResponse.json(response);
      } catch (error) {
        if (error instanceof ApiException) {
          await releaseRateLimitSlot(request);
          return NextResponse.json({ error: safeErrorMessage(error) }, { status: error.status });
        }
        log.error('POST confirm error', error instanceof Error ? error : undefined);
        // Fehlgeschlagener Versuch: die Transaktion ist zurückgerollt, es ist
        // nichts entstanden — also darf er auch nicht aufs Stundenkontingent gehen.
        await releaseRateLimitSlot(request);
        // Die Drizzle-Meldung enthält das komplette Insert-Statement samt aller
        // Parameter (im Fehlerfall ~80.000 Zeichen inklusive Mitglieds-UUIDs) und
        // landete bis hierher unverändert in der Oberfläche. Details gehören ins
        // Server-Log, der Admin bekommt einen verständlichen Satz.
        return NextResponse.json(
          {
            error:
              'Die Saison konnte nicht veröffentlicht werden. Die Planung wurde nicht verändert — bitte erneut versuchen oder den Support kontaktieren.',
            // Nur außerhalb der Produktion: sonst ist der Fehler beim Entwickeln
            // nicht mehr greifbar, ohne im Server-Log zu suchen.
            ...(process.env.NODE_ENV === 'production'
              ? {}
              : { detail: error instanceof Error ? error.message.slice(0, 400) : String(error) }),
          },
          { status: 500 }
        );
      }
    });
  });
}
