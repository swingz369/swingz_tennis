# Sicherheitstest — 13.08.2026

> Einmaliger Befund (Archiv). Durchgeführt auf Branch `refactor/season-auth-helper-adoption`.
> Die zwei Low-severity-Befunde wurden im Anschluss behoben (siehe „Nachbehandlung").

## 1. Automatisierte Tests — alles grün

| Prüfung                                                                    | Ergebnis                                                                                       |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| RLS-Policy-Integrationstests (gegen Test-Supabase)                         | 33 ✅ (u. a. „superadmin can DELETE billing periods", „club members can view trial trainings") |
| Tenant-Isolation (statisch: alle `seasons/[id]/**`-Routen scopen per Club) | 2 ✅                                                                                           |
| `api-auth` Dunning-Gate (Schreib-Sperre bei `past_due`)                    | 9 ✅                                                                                           |
| `season-auth` (Cross-Club-IDOR-Schutz, Rollen-Whitelist)                   | 15 ✅                                                                                          |
| `use-user-role` (Rollen-Priorität, Exhaustiveness)                         | 19 ✅                                                                                          |
| `pnpm audit` (Abhängigkeiten)                                              | „No known vulnerabilities found" ✅                                                            |

**Summe: 78/78 Sicherheitstests grün.**

## 2. Code-Review der kritischen Schichten

**Solide (keine Mängel):**

- **`lib/api-auth.ts`** — Rollen-Hierarchie, P0-3-Rollen-Bleed-Fix (Rolle wird pro
  Club neu aufgelöst), `verifyClubAccess`/`verifyTrainerInClub`, Dunning-Gate,
  httpOnly-Cookie.
- **Hard-Delete-Token** (`lib/security/hard-delete-token.ts`) — `DEV_FALLBACK_SECRET`
  ist kein Leck: `assertSafeSecret()` wirft in Production bei fehlendem Env-Var.
  HMAC + `timingSafeEqual` + 5-min-TTL + `(user, club)`-Scope.
- **Stripe-Webhook** (`app/api/webhooks/stripe/route.ts`) — Signatur via
  `constructEvent` verifiziert, Idempotenz über `check_and_record_stripe_event`.
- **XSS-Fläche** — Nachrichten-Inhalt via `DOMPurify.sanitize`; Branding-CSS-Vars
  über `hexToHsl` neutralisiert; übrige `dangerouslySetInnerHTML` sind statische
  Theme-/Service-Worker-/GA-Skripte ohne User-Input.
- **Fehlende-Auth-Scan** über alle `route.ts` — nur 4 ohne Guard, alle korrekt:
  `messages/[id]/read` prüft `getUser()` + scoped `receiver_id = user.id`;
  `logout`/`csrf-token`/`vapid-key` sind absichtlich öffentlich.

## 3. Low-severity-Befunde (bei Testzeitpunkt offen)

1. **`app/api/contact/route.ts`** — Felder ohne Max-Length; `firstName/lastName/
message` landeten unescaped im HTML der internen Benachrichtigungs-E-Mail
   (Rate-Limiting STRICT war vorhanden). Risiko: HTML-Injection im Postfach des Operators.
2. **Branding-Farben** — Injection nur durch `hexToHsl`-NaN-Koerzierung entschärft;
   keine explizite Hex-Validierung beim Konsum.

## 4. Nachbehandlung (gleicher Tag)

Beide Low-severity-Punkte behoben:

- `app/api/contact/route.ts`: Längen-Limits (firstName 100, lastName 100,
  email 254, clubName 200, message 5000) + `escapeHtml()` auf alle Nutzereingaben.
- `lib/branding.ts`: `HEX_COLOR_REGEX` + `isHexColor()` als geteilte Quelle;
  `brandingToCSSVars` validiert explizit und fällt auf den Marken-Default zurück.

Verifikation danach: Typecheck 0 Fehler · ESLint sauber · Branding-API-Test (4/4)

- Security-/API-Suite (214/214) grün.

## 5. Nicht ausgeführt

Browser-E2E (`role-access.spec.ts`, `auth.spec.ts`) — brauchen laufenden Dev-Server

- Browser. Die RLS-/Autorisierungs-Logik ist über die Unit/Integration-Suite abgedeckt.
