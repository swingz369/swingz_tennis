# Notifications — Service-Client-Pattern, Templates, Dispatch

> Wie eine Benachrichtigung von "Member bucht" zu "Mitglied bekommt E-Mail" fließt.

## 🏗 Pipeline

```
[Auslöser: API-Route, Cron, …]
   │
   ▼
lib/notifications/notification.service.ts
   │ supabase = createServiceClient()  (RLS umgangen!)
   │ INSERT INTO notifications { actor_id, recipient_ids, type, payload, channel }
   ▼
[DB: notifications + notification_dispatch]
   │
   ▼
POST /api/cron/notification-dispatch   (alle 5 min via Vercel-Cron)
   │ SELECT WHERE dispatched_at IS NULL AND channel_priority fits
   │ FOR EACH: send via Resend + Web-Push (falls push_subscriptions exist)
   │ UPDATE notifications SET dispatched_at = now(), error = ?
   ▼
[E-Mail raus via Resend + Push an Browser]
```

## 📨 `notifications`-Tabelle

Spalten:

| Spalte          | Typ       | Zweck                                                                                                     |
| --------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| `id`            | uuid      | Primary                                                                                                   |
| `type`          | varchar   | `booking_created` \| `booking_cancelled` \| `invoice_due` \| `dunning_escalation` \| `team_invite` \| `…` |
| `actor_id`      | uuid      | Wer hat's ausgelöst (oder null bei Cron)                                                                  |
| `recipient_ids` | uuid[]    | Wer bekommt's (User-IDs)                                                                                  |
| `payload`       | jsonb     | Template-Variablen (bookingId, slot, amount, …)                                                           |
| `channel`       | varchar[] | `["email"]` \| `["email", "push"]`                                                                        |
| `priority`      | varchar   | `low` \| `normal` \| `high` \| `urgent`                                                                   |
| `send_at`       | timestamp | Wann senden (default `now()`)                                                                             |
| `dispatched_at` | timestamp | NULL wenn offen, gesetzt wenn gesendet                                                                    |
| `error`         | varchar   | Sendefehler                                                                                               |
| `retry_count`   | int       | Anzahl Retry-Versuche                                                                                     |

## ✍️ Notifications-Trigger schreiben

```ts
// Beispiel: in app/api/bookings/route.ts, nach erfolgreichem create
import { notifyBookingCreated } from '@/lib/notifications/notification.service';

const booking = await bookingUseCase.create(...);
await notifyBookingCreated({
  bookingId: booking.id,
  memberId: booking.memberId,
  sessionId: booking.sessionId,
});

// In der Service-Funktion:
export async function notifyBookingCreated(input: { bookingId: string; memberId: string; sessionId: string; }) {
  const supabase = createServiceClient();
  await supabase.from('notifications').insert({
    type: 'booking_created',
    actor_id: input.memberId,
    recipient_ids: [input.memberId],  // später: auch Trainer, ggf. Co-Members
    channel: ['email', 'push'],
    priority: 'normal',
    payload: { bookingId: input.bookingId, sessionId: input.sessionId },
  });
}
```

**Warum Service-Client?** Notifications werden **server-seitig im Namen anderer User** geschrieben. RLS würde das verbieten (User X darf nicht in `notifications` von User Y schreiben).

## 📨 E-Mail-Versand (Resend)

Absender (CLAUDE.md):

- `noreply@swingz.cloud`
- `info@swingz.cloud`
- ❌ NICHT `@mail.swingz.cloud` (Subdomain nicht konfiguriert)

Templates in `lib/notifications/templates/`. HTML + Plaintext parallel.

```ts
import { sendEmail } from '@/lib/notifications/email-sender';

await sendEmail({
  templateId: 'booking_created',
  to: recipient.email,
  vars: { firstName: recipient.firstName, sessionTime, courtName },
});
```

## 🔔 Web-Push (Browser)

User-Registrierung: `POST /api/push/subscribe` mit Endpoint aus `serviceWorker.pushManager.subscribe`. Gespeichert in `push_subscriptions` (Migration `20260715_push_subscriptions.sql`).

```ts
// lib/notifications/push-sender.ts
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:info@swingz.cloud',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPush(userId: string, payload: PushPayload) {
  const subs = await fetchPushSubscriptionsForUser(userId);
  await Promise.allSettled(
    subs.map((sub) => webpush.sendNotification(sub, JSON.stringify(payload)))
  );
}
```

## ⏰ Dispatch-Cron

**Datei:** `app/api/cron/notification-dispatch/route.ts` (in `cron-routes`).

Vercel-Cron: alle 5 min. Konfiguration in `vercel.json`.

```json
{
  "crons": [{ "path": "/api/cron/notification-dispatch", "schedule": "*/5 * * * *" }]
}
```

Logic:

1. `SELECT FROM notifications WHERE dispatched_at IS NULL AND send_at <= now() AND retry_count < 3`
2. Batch-größe: 50 pro Run (Performance)
3. Pro Notification: send via alle Kanäle → `dispatched_at = now()`
4. Bei Fehler: `retry_count += 1`, `error = msg`, sende nächsten Cron-Run erneut

## ⚠️ Bekannte Probleme

| Problem                                                         | Severity | Finding |
| --------------------------------------------------------------- | -------- | ------- |
| Kein Dunning-Notification-Trigger nach `invoice.payment_failed` | 🔴 P0    | P0-8    |
| `notification_dispatch`-Cron kann bei Last überlaufen           | 🟡 P1    | –       |
| Kein Template-Test-Framework                                    | 🟡 P2    | –       |
| PDF-Attachment für Rechnungen fehlt im E-Mail                   | 🟡 P2    | –       |

## 🧪 Tests

- `src/__tests__/lib/notifications/notification.service.test.ts`
  - Service-Client wird benutzt
  - Insert korrekt mit allen Pflichtfeldern
  - Recipient-Resolution (Member, Trainer, Owner) je nach Type
- **E2E**: Echte Resend-Sandbox (`@resend.dev`-Domain) für Dev-Tests

## 📚 Verwandte Kapitel

- [`supabase-setup.md`](./supabase-setup.md) — Service-Client-Discipline
- [`auth-rbac.md`](./auth-rbac.md) — wer darf Cross-User-Notifications triggern?
- [`background-jobs.md`](./background-jobs.md) — Cron-Worker-Pattern
- [`data-model.md`](./data-model.md) — `notifications`, `notification_dispatch`, `push_subscriptions`
