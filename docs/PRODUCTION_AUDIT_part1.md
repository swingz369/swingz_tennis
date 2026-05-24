# SwingZ — Production Readiness Audit

**Datum:** 2026-05-18 | **Branch:** main | **Stack:** Next.js 16 / React 18 / Supabase

---

## Gesamtbewertung: 28/100 — BLOCKED

Die App ist **nicht produktionsreif**. Kritische Sicherheitslücken, umfangreiche Mock-Implementierungen und ein Billing-System mit Datenverlust-Szenarien blockieren den Launch.

| Bereich              | Score  | Status                     |
| -------------------- | ------ | -------------------------- |
| Auth & Security      | 45/100 | Kritische Lücken           |
| Billing & Payments   | 15/100 | Fundamentale Fehler        |
| Buchungen & Training | 30/100 | 60% Mock-Implementierungen |
| UI & Deployment      | 50/100 | Solide Basis, grobe Fehler |

---

## Rollen-Übersicht

| Rolle        | Beschreibung               | club_id in DB       |
| ------------ | -------------------------- | ------------------- |
| `superadmin` | Plattform-weit, alle Clubs | NULL                |
| `admin`      | Verwaltet einen Club       | spezifische Club-ID |
| `trainer`    | Trainiert in einem Club    | spezifische Club-ID |
| `member`     | Mitglied eines Clubs       | spezifische Club-ID |

Hierarchie: `superadmin (4) > admin (3) > trainer (2) > member (1)`

Zusätzlich existiert eine undokumentierte `demo`-Rolle (Wert 0) in `lib/auth/guards.ts`, die in `lib/types/index.ts` fehlt.

**Demo-Modus kann vollständig gelöscht werden:**

- `lib/auth/guards.ts:8` — `'demo'` aus `UserRole`-Union entfernen
- `lib/auth/guards.ts:47` — `demo: 0` aus Hierarchie-Objekt entfernen
- `lib/actions/booking.actions.ts:21` — `if (user.role === 'demo')` Branch entfernen
- `middleware.ts:77-81` — Test-Mode-Cookie (hängt zusammen, ebenfalls entfernen, siehe S1)

Kein produktiver Code-Pfad benötigt die Demo-Rolle.

---

## TEIL 1: SICHERHEIT & AUTH

### S1 — KRITISCH: Test-Mode-Bypass umgeht alle Auth-Guards

**`middleware.ts:77-81`**

```typescript
const testModeCookie = request.cookies.get('swingz_test_mode');
if (testModeCookie?.value === 'true') {
  return response; // Alle Auth-Checks übersprungen!
}
```

Dieses Cookie ist **clientseitig setzbar** (`document.cookie = "swingz_test_mode=true"`). Es wird nirgends als `HttpOnly` gesetzt. Jeder Angreifer kann damit alle Middleware-Auth-Guards umgehen.

**Fix:** Entfernen oder auf serverseitiges `NODE_ENV === 'test'` beschränken.

---

### S2 — KRITISCH: Role-Bleeding bei Multi-Club-Mitgliedschaft

**`lib/api-auth.ts:60-89`**

Wenn ein User in Club A `trainer` und in Club B `admin` ist, bekommt er global `role: 'admin'`. Die `effectiveClubId` zeigt jedoch auf den **ersten** zurückgegebenen Club in DB-Reihenfolge, unabhängig davon, in welchem Club die höhere Rolle gilt.

Resultat: Ein Trainer aus Club A erhält Admin-Rechte auf Club B-Daten, wenn API-Routes nur `verifyRole(auth, 'admin')` prüfen ohne `verifyClubAccess()`.

---

### S3 — HOCH: Messages/Notifications nutzen SERVICE_ROLE_KEY (bypasses RLS)

**`app/api/messages/route.ts:20` / `app/api/notifications/route.ts:19`**

Beide Routen erstellen den Supabase-Client mit `SUPABASE_SERVICE_ROLE_KEY`. Dieser bypassed alle RLS-Policies. Wenn der Auth-Check fehlschlägt oder umgangen wird, können alle Nachrichten aller User gelesen werden.

---

### S4 — HOCH: CSP mit `unsafe-eval` und `unsafe-inline`

**`next.config.js`** — `script-src` enthält `'unsafe-eval'` und `'unsafe-inline'`. Dies macht die CSP weitgehend wirkungslos gegen XSS.

---

### S5 — HOCH: 24 API-Routen ohne standardisierten Auth-Wrapper

Die folgenden Routes nutzen keinen `withAuth`/`requireAuth` aus `lib/api-auth.ts` und implementieren manuelle, inkonsistente Auth-Checks:

- `app/api/admin/approvals/route.ts` — `(supabase as any)` Typsicherheit aufgegeben
- `app/api/bookings/series/route.ts` — Serienbuchung ohne Standard-Guard
- `app/api/email-campaigns/route.ts` — E-Mail-Blast ohne Standard-Guard
- `app/api/messages/route.ts` — SERVICE_ROLE_KEY (siehe S3)
- `app/api/notifications/route.ts` — SERVICE_ROLE_KEY (siehe S3)
- `app/api/emails/onboarding/route.ts` — kein Auth-Guard überhaupt

---

### Auth-Positives

- `getUser()` statt `getSession()` — verifiziert JWT beim Auth-Provider ✓
- Timing-safe CSRF-Vergleich (`timingSafeEqual`) ✓
- CSRF-Cookie: `httpOnly: true, sameSite: strict` ✓
- Superadmin-Club-Selektion mit DB-Validierung ✓
- 141 von 162 API-Routen haben Auth-Guards ✓
- RLS aktiviert für: trainer_availability, trainer_absences, email_campaigns, shop_products, shop_orders ✓
