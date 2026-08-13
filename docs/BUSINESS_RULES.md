# SwingZ — Business Rules

> Zuletzt aktualisiert: 13.08.2026 (Stand der letzten Code-Änderung an diesem Dokument)

> Verbindliche Produktregeln. Bei Widersprüchen zwischen Code und diesem Dokument gilt dieses Dokument als Referenz.
> Letzte Aktualisierung: 17. Juni 2026

---

## 1. Rollen & Berechtigungen

### Rollenhierarchie

```
superadmin  →  admin  →  trainer  →  member
```

| Rolle        | Beschreibung                                                               |
| ------------ | -------------------------------------------------------------------------- |
| `superadmin` | Plattform-Admin — verwaltet mehrere Vereine, hat Zugriff auf `/superadmin` |
| `admin`      | Vereins-Admin — verwaltet **genau einen** Verein                           |
| `trainer`    | Trainer — sieht seine Gruppen, Verfügbarkeit, Anwesenheit                  |
| `member`     | Mitglied — bucht Plätze, sieht Trainingsplan, Rechnungen                   |

### Kernregel: Admin = 1 Verein

Ein Benutzer mit Rolle `admin` darf **nur einem einzigen Verein** zugeordnet sein.

- **Grund:** Admin-Kontext (`ADMIN_CLUB_COOKIE`) ist auf einen Verein ausgelegt. Mehrere aktive Admin-Memberships führen zu inkonsistenter Darstellung.
- **Mehrere Vereine verwalten:** → Rolle `superadmin` verwenden. Superadmins können zwischen Vereinen wechseln (Club-Switcher in der Sidebar).

### Trainer & Member: Mehrfachmitgliedschaft erlaubt

Trainer und Mitglieder können in mehreren Vereinen gleichzeitig aktiv sein (z.B. Gasttrainer, Doppelmitgliedschaft).

---

## 2. Authentifizierung & Dashboard-Dispatch

Nach dem Login leitet `/dashboard` automatisch weiter:

```
superadmin → /superadmin
admin      → /admin
trainer    → /trainer
member     → /member
```

Priorität: höchste Rolle gewinnt. Basis: `user_club_memberships.role` mit `is_active = true`.

**Kein aktives Membership:** Benutzer landet auf `/member` mit Hinweis "Kein aktives Mitgliedschaft — Admin kontaktieren". Kein Probetraining-Formular nach dem Login.

---

## 3. Probetraining

- Probetraining-Buchung ist **ausschließlich öffentlich** — erreichbar über `/trial-training` ohne Login.
- Nach dem Login erscheint **kein** Probetraining-Onboarding, auch wenn das Mitglied noch keinem Verein zugeordnet ist.
- Einstiegspunkt: Landing Page → "Probetraining buchen" Button.

---

## 4. Vereine (Clubs)

- Nur Vereine mit `status = 'active'` erscheinen in Auswahllisten und der Navigation.
- Jeder Verein hat `opening_hours` (JSONB) — Pflichtfeld bei der Registrierung.
- Feature-Flags pro Verein (`clubs.features` JSONB) steuern, welche Module in der Sidebar sichtbar sind.
- Jeder Verein hat ein **Bundesland** (`clubs.bundesland`) — Pflichtfeld im Onboarding. Es bestimmt
  die Schulferien, welche die Saisonplanung aussparen soll. Ohne den Wert entstehen Trainingstermine
  in den Weihnachtsferien.
- **Keinen Vereinswechsler für Trainer und Mitglieder** (Entscheidung 13.08.2026): Diese beiden
  Rollen arbeiten immer im Kontext genau eines Vereins; ihr Verein ergibt sich aus der aktiven
  Mitgliedschaft, nicht aus einer Auswahl. Nur `superadmin` und `owner` wechseln zwischen Vereinen
  (Cookie `ADMIN_CLUB_COOKIE`). Technisch: `withApiAuth` setzt `auth.clubId` für member/trainer aus
  der **einzigen** aktiven Mitgliedschaft; bei mehreren bleibt der Wert `null`, weil es ohne
  Auswahlmöglichkeit keine richtige Antwort gäbe.

---

## 5. Test-Accounts (Entwicklung)

| E-Mail                           | Rolle      | Verein                                              |
| -------------------------------- | ---------- | --------------------------------------------------- |
| `admin@swingz.com`               | superadmin | Tennis Club Berlin, Badminton Club Hamburg, weitere |
| `admin@tc-rheinland.de`          | admin      | TC Rheinland e.V.                                   |
| `trainer.1-8@tc-rheinland.de`    | trainer    | TC Rheinland e.V.                                   |
| `mitglied.1-120@tc-rheinland.de` | member     | TC Rheinland e.V.                                   |

Passwörter: siehe `TEST-CREDENTIALS.md` (nicht in Git einchecken).

---

## 6. Billing & Stripe

- Zwei Preispläne: **Starter** (€29/Monat) und **Professional** (€79/Monat).
- Stripe-Checkout wird client-seitig über `@/lib/stripe/client.ts` initiiert (gibt `null` zurück wenn nicht konfiguriert).
- Webhook-Verarbeitung über `@/lib/stripe/stripe-client.ts` (wirft Fehler wenn nicht konfiguriert — bewusst streng).
- SEPA-Lastschrift: PAIN.008-XML-Export unter `/admin/billing/sepa`.

---

## 7. E-Mail

- Absender-Domain: `@swingz.cloud` (verifiziert bei Resend).
- Erlaubte Absenderadressen: `noreply@swingz.cloud`, `info@swingz.cloud`, `mail@swingz.cloud`.
- Supabase Auth-E-Mails: SMTP via Resend, Absender `noreply@swingz.cloud`.
- Keine `@mail.swingz.cloud`-Adressen — Subdomain nicht konfiguriert.
