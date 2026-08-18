# E-Mail-Versand (Resend)

> Zuletzt verifiziert: 18. August 2026
>
> Lebendes Dokument. Wer an Versandwegen, Absenderadressen oder Templates etwas ändert,
> aktualisiert diese Datei im selben Zug (siehe `AGENTS.md`).

## Zustand: Versand läuft

`swingz.cloud` ist bei Resend verifiziert, `EMAIL_FROM` steht auf
`SwingZ <noreply@swingz.cloud>`. Am 18.08.2026 mit einer echten Mail belegt
(`npx tsx scripts/send-test-email.ts <adresse>`).

**Offen:** Der neue Key liegt bislang nur in `.env.local`. In Vercel steckt noch der alte
(siehe unten, Falle 3) — in Produktion geht damit weiterhin nichts raus, bis der Key
ersetzt und neu deployt wurde.

## DNS-Einträge (checkdomain, Zone swingz.cloud)

Resend verifiziert die **Root**-Domain. Die Einträge liegen entsprechend auf `send.*` und
`resend._domainkey`, nicht auf einer Sende-Subdomain:

| Name                | Typ | Wert                                       | Prio |
| ------------------- | --- | ------------------------------------------ | ---- |
| `send`              | MX  | `feedback-smtp.eu-west-1.amazonses.com.`   | 10   |
| `send`              | TXT | `v=spf1 include:amazonses.com ~all`        | —    |
| `resend._domainkey` | TXT | `p=MIGf…` (DKIM, aus dem Resend-Dashboard) | —    |

Der MX ist **nicht optional** — Resend verlangt DKIM, SPF und MX für die Verifizierung.
Er dient als Return-Path für Bounce- und Beschwerdemeldungen.

Bei checkdomain liegt der Typ MX **nicht** in der normalen Eintragsliste, sondern unter
_Kundenbereich → Domains → Konfiguration → checkdomain Nameserver → **Profi-Einstellungen**_.

## Drei Fallen, jede davon hat hier real Zeit gekostet

**1. Punkt am Ende des MX-Werts.** Ohne ihn hängt checkdomain die Domain an, und der Wert
wird zu `feedback-smtp.eu-west-1.amazonses.com.swingz.cloud`. Laut Resend der häufigste
Grund für eine scheiternde Verifizierung.

**2. Die Root-MX nicht löschen.** Checkdomains Anleitung sagt „Entfernen Sie vorhandene
Standard-MX-Einträge" — das gilt nur, wenn man die Root-Domain auf einen fremden Mailserver
umbiegt. Am 18.08.2026 sind dabei die Root-MX und die A-Records `mx1`/`mx2` verschwunden;
der Mailempfang für `@swingz.cloud` war weg, bis sie wiederhergestellt waren. Der
Resend-MX hängt an `send.` und kollidiert nicht mit der Root.

Sollstand der betroffenen Einträge:

```
swingz.cloud   MX  10 mx1.swingz.cloud.  /  20 mx2.swingz.cloud.
mx1            A   88.198.20.145
mx2            A   94.130.12.24
mail           A   88.99.101.251
autodiscover   CNAME  autodiscover.nicgate.com.
autoconfig     CNAME  autoconfig.nicgate.com.
```

`mail`, `autodiscover` und `autoconfig` fehlen Stand 18.08.2026 noch — sie betreffen nur
die automatische Kontoeinrichtung in Outlook/Thunderbird, nicht die Zustellung.

**3. Domains und API-Keys hängen am Team, nicht am Login.** Ein Konto kann mehrere Teams
haben. Ein Key aus Team A kann nicht von einer in Team B verifizierten Domain senden — das
Dashboard zeigt dann „Domain verified", die API antwortet trotzdem mit
`403 The swingz.cloud domain is not verified`. Genau so lag der Fall hier. Diagnose: ein
Versand von `onboarding@resend.dev` gelingt (Key ist gültig), einer von der eigenen Domain
scheitert. Lösung: neuen Key **in dem Team anlegen, in dem die Domain steht**.

## Prüfen

```bash
# DNS gegen öffentliche Resolver — nicht gegen ns.checkdomain.de,
# der beantwortet MX-/TXT-Anfragen unzuverlässig
dig +short MX  send.swingz.cloud            @8.8.8.8
dig +short TXT send.swingz.cloud            @8.8.8.8
dig +short TXT resend._domainkey.swingz.cloud @8.8.8.8
dig +short MX  swingz.cloud                 @8.8.8.8   # Postfächer, muss mx1/mx2 zeigen

# Echter Versand
npx tsx scripts/send-test-email.ts <eigene-adresse>
```

Rechnungsversand über die App setzt die Rechnung auf `sent`; sie erscheint dann beim
Mitglied unter `/billing`. Solange sie `draft` ist, bleibt sie für Mitglieder bewusst
unsichtbar (`lib/billing/invoice-visibility.ts`).

## Supabase-Auth-Mails laufen getrennt

Passwort-Reset und Bestätigungsmails verschickt nicht die App, sondern das selbstgehostete
GoTrue auf dem VPS. Konfiguration in `/home/deploy/swingz-supabase/.env`:

```
SMTP_HOST=smtp.resend.com
SMTP_ADMIN_EMAIL=noreply@swingz.cloud
SMTP_SENDER_NAME=SwingZ
```

`SMTP_PASS` muss ein Resend-Key aus demselben Team wie die Domain sein — siehe Falle 3.
Nach einer Änderung: `docker compose up -d auth` im selben Verzeichnis.
**Stand 18.08.2026 nicht verifiziert**, weil kein SSH-Zugang zur Hand war.

## Ausweichlösung, die eingebaut bleibt

Damit ein nicht zustellbarer Versand keinen Verein aussperrt, weichen beide Einladungswege
bei einem Mailfehler auf einen **Einladungslink** aus: Der Nutzer wird per
`admin/generate_link` ohne Mailversand angelegt, die Antwort trägt `mailSent: false` und
`inviteLink`, und die Oberfläche zeigt den Link dauerhaft mit „Link kopieren" an
(`lib/invite-feedback.ts`).

Das ist ein Sicherheitsnetz, kein Ersatz: Es hält das Onboarding offen, ersetzt aber weder
Rechnungsversand noch Mahnwesen.

## Absenderadressen

- `noreply@swingz.cloud` — automatische Mails (Einladungen, Rechnungen, Benachrichtigungen)
- `info@swingz.cloud` — Antwortadresse für Menschen
- Keine `@mail.swingz.cloud`-Adressen: Diese Subdomain hat zwar einen A-Record, aber keine
  Mail-Konfiguration.
