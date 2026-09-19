# SwingZ — Business Rules

> Zuletzt aktualisiert: 19.09.2026 (Buchungsregeln, Rechnung/SEPA/Mail-Absender = Vereinsdaten ergänzt)

> Verbindliche Produktregeln. Bei Widersprüchen zwischen Code und diesem Dokument gilt dieses Dokument als Referenz.

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

### Admin ist selbst Mitglied (Oberflächen-Trennung)

Die DB erlaubt **eine** Membership-Zeile pro `(user, club)` (UNIQUE-Constraint
`user_club_memberships_user_club_unique`). Ein Admin ist deshalb **bereits Mitglied** seines
Vereins — es gibt **keine** zweite „member"-Rolle zu vergeben und bewusst **keinen** zweiten
Account. **Eine Person, ein Login, eine Rolle pro Verein.**

- **Trennung der Oberflächen:** Admin-Konsole (`/admin/…`) = verwalten; Mitglieder-Oberfläche (`/partner-finder`, `/member/…`) = spielen.
- **Rollen-Switcher:** Admins sehen in der Sidebar einen Schalter „Verwalten (Admin)" ↔ „Spielen (Mitglied)" — ohne dass jemand (schon gar kein fremder Admin) etwas freischaltet. Der Modus ist eine reine UI-Präferenz, **keine** Sicherheitsgrenze — autorisiert wird über die echte `user_club_memberships`-Zeile. Persistiert als Cookie (`swingz_role_mode`), damit auch die serverseitigen Guards (z. B. `member/layout.tsx`) denselben Modus sehen und Admins im Spieler-Modus nicht nach `/admin` zurückwerfen.
- **Konsequenz Spielpartner-Suche:** `/admin/partner-finder` ist nur eine **Übersicht** (Kennzahlen, Niveau-Verteilung). Die persönliche Suche (`/partner-finder`) erlaubt echte Vereinsmitglieder (`member`/`trainer`/`admin`); Plattform-Staff (`owner`/`superadmin`) ohne eigene Mitgliedschaft erhält keine persönlichen Matches.

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

### Pflicht-Abo — kein Freemium, keine Testphase

**Der Vereinsbereich ist kostenpflichtig ab dem ersten Tag.** Es gibt bewusst
keine Probephase: wer nicht zahlen _muss_, zahlt nicht — das ist keine
Feature-Frage, sondern das Geschäftsmodell. Entscheidung vom 18.08.2026.

Konkret (siehe `lib/subscription-gate.ts`):

| Zustand    | Bedeutung                             | Was der Kunde sieht               |
| ---------- | ------------------------------------- | --------------------------------- |
| `ok`       | bezahltes, laufendes Abo              | den Vereinsbereich                |
| `past_due` | Abbuchung gescheitert                 | Sperre mit Link ins Stripe-Portal |
| `none`     | kein Abo (`subscription_tier='free'`) | Sperre mit Tarifauswahl           |

Die Sperre greift **nach** der Onboarding-Weiche: ein Neukunde durchläuft
erst den Einrichtungs-Wizard und sieht, was er kauft; danach steht die Kasse.
`/admin/subscription` und `/superadmin/subscription` liegen deshalb ausserhalb
der `(gated)`-Gruppe — sonst führte die Sperre auf eine gesperrte Seite.

Nicht betroffen: Mitglieder und Trainer (die zahlen nichts) sowie
Plattform-Personal (`owner`).

### Preispläne

Vier Pläne, Quelle ist `lib/plans.ts`:

| Key        | Name           | Preis/Monat | Für                |
| ---------- | -------------- | ----------- | ------------------ |
| `solo_s`   | Starter        | 29 €        | bis 200 Mitglieder |
| `solo_l`   | Professional   | 49 €        | ab 201 Mitglieder  |
| `school_s` | Tennisschule S | 79 €        | bis 5 Vereine      |
| `school_l` | Tennisschule L | 99 €        | mehr als 5 Vereine |

Solo-Pläne rechnet der Admin ab, Schul-Pläne der Superadmin. Ein Verein, der
zu einer Tennisschule gehört, sieht deshalb keinen eigenen Abo-Eintrag.

### Sonstiges

- Stripe-Checkout wird client-seitig über `@/lib/stripe/client.ts` initiiert (gibt `null` zurück wenn nicht konfiguriert).
- Webhook-Verarbeitung über `@/lib/stripe/stripe-client.ts` (wirft Fehler wenn nicht konfiguriert — bewusst streng).
- SEPA-Lastschrift: PAIN.008-XML-Export unter `/admin/billing/sepa`. Gläubiger-IBAN und
  Gläubiger-ID kommen aus dem Verein (Einstellungen → Rechtliches), nicht aus
  Plattform-Umgebungsvariablen; ein Mandat trägt die Gläubiger-ID seines Vereins.
- Rechnungs-PDF: Logo, Akzentfarbe, Steuernummer, Register, Bankverbindung, Rechnungstext
  und Fusszeile stammen aus dem Verein der Rechnung. Der Empfänger kommt aus der
  Rechnung, nicht vom Betrachter.
- Die Webhook-Handler prüfen ihre Datenbank-Updates auf Fehler und werfen bei
  einem Fehlschlag, damit Stripe erneut zustellt. Grund: bis 18.08.2026 kannte
  der CHECK-Constraint auf `users.subscription_tier` die Plan-Keys nicht, jedes
  Update nach einem Checkout schlug fehl — und lautlos, weil niemand den Fehler
  las. Ein Kunde konnte bezahlen und blieb auf `free`.

---

## 6a. Sichtbarkeit über Vereinsgrenzen

**Mitglieder sehen ausschliesslich Nutzer aus ihren eigenen Vereinen.**
Entscheidung vom 18.08.2026. Damit ist eine vereinsübergreifende
Spielpartner-Suche bewusst ausgeschlossen — der Partner-Finder arbeitet
innerhalb eines Vereins.

Durchgesetzt wird das von der RLS-Policy `Members can view club members` auf
`public.users` über die Funktion `shares_active_club_with()`. Ebenso getrennt
sind die Abrechnungstabellen: ein Superadmin mit drei Vereinen sieht die
Zahlen jedes Vereins nur einzeln.

Nachgewiesen (nicht behauptet) durch
`src/__tests__/integration/cross-tenant-isolation.test.ts`; Details in
`docs/DATABASE.md`.

---

## 6b. Platzbuchung

Ein Klick im Kalender bucht nicht sofort: Ein Bestätigungsdialog zeigt Platz, Zeit und
Verbrauch (Tag/Woche/offen) nach Vorprüfung über `POST /api/bookings/check`.

Der Server prüft die Buchungsregeln des Vereins vollständig (`lib/booking/booking-rules.ts`):
Dauer, Vorlauf, Wochenende, Prime-Time, Tages-, Wochen- und Gleichzeitig-Limit,
Saisonfenster und Freigabepflicht. „Woche" ist Montag bis Sonntag nach Berliner Zeit,
nicht Serverzeit. `clubId` und `courtId` werden gegen den Nutzer geprüft — Buchungen
in einem fremden Verein werden abgelehnt.

---

## 7. E-Mail

- Absender-Domain: `@swingz.cloud` (verifiziert bei Resend).
- Erlaubte Absenderadressen: `noreply@swingz.cloud`, `info@swingz.cloud`, `mail@swingz.cloud`.
- Supabase Auth-E-Mails: SMTP via Resend, Absender `noreply@swingz.cloud`.
- Keine `@mail.swingz.cloud`-Adressen — Subdomain nicht konfiguriert.
- Anzeigename und Reply-To sind der Verein (`lib/email/club-sender.ts`); die Absenderadresse
  bleibt eine der erlaubten `@swingz.cloud`-Adressen.
