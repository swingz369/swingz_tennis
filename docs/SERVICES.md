# Dienste, Links & Zugänge

> Zuletzt verifiziert: 16. August 2026
> Umgebungen und wie man in ihnen arbeitet: [`ENVIRONMENTS.md`](ENVIRONMENTS.md)

Was es in diesem Projekt an Adressen gibt, was sich hinter jeder verbirgt und wo die dazugehörigen Zugangsdaten liegen.

> **Regel für diese Datei:** Hier stehen **keine Passwörter, Keys oder Tokens** — sie ist in Git. Jeder Eintrag nennt stattdessen den Fundort des Geheimnisses. Wer ein Passwort hier einträgt, veröffentlicht es.

---

## 1. Entwicklung (lokal)

Alles hier existiert nur, solange `supabase start` läuft und der Dev-Server oben ist.

| Adresse                                          | Was das ist                                                                                                                                        | Zugang                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| http://localhost:3000                            | Die App selbst (`npm run dev`). Einstieg über `/login`.                                                                                            | Testkonten: `docs/TEST-CREDENTIALS.md`         |
| http://127.0.0.1:3001                            | Lokale Supabase-API (Kong): Auth, REST, Storage, Realtime. Das ist die URL, die in `NEXT_PUBLIC_SUPABASE_URL` steht — nicht zum Anschauen gedacht. | anon/service-Key aus `supabase status`         |
| http://127.0.0.1:54323                           | **Supabase Studio.** Tabellen ansehen und bearbeiten, SQL-Editor, Auth-Benutzerliste. Der schnellste Weg, in die lokale DB zu schauen.             | kein Login                                     |
| http://127.0.0.1:54324                           | **Mailpit.** Fängt jede Mail ab, die die App lokal verschickt — Einladungen, Passwort-Resets, Rechnungen. Nichts davon verlässt den Rechner.       | kein Login                                     |
| `postgresql://postgres:postgres@127.0.0.1:54322` | Postgres direkt, für `psql`, Drizzle Studio und `npm run db:*`.                                                                                    | Passwort ist `postgres` (lokaler Standardwert) |
| http://localhost:3000/api/health                 | Health-Check der App. Praktisch für Skripte, die warten müssen, bis der Server wirklich oben ist — in Produktion derselbe Pfad.                    | kein Login                                     |

```bash
supabase status          # zeigt alle lokalen URLs und Keys auf einmal
npm run db:studio        # Drizzle Studio, alternative Sicht auf dieselbe DB
```

---

## 2. Produktion

| Adresse                               | Was das ist                                                                                                                                                          | Zugang                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| https://swingz.vercel.app             | Die produktive App. Deployt automatisch aus `main`.                                                                                                                  | Owner: `admin@swingz.com`, PW s. u.          |
| https://supabase.swingz.cloud         | Produktions-Supabase (self-hosted auf dem VPS, Kong-Gateway hinter Caddy). Auth + REST + Storage der Live-App. Keine Oberfläche — Aufrufe im Browser liefern JSON.   | Service-Key in `.env.prod.local`             |
| `supabase.swingz.cloud:6543`          | Supavisor-Pooler (Transaction-Mode), Ziel von `DATABASE_URL`. Port 5432 daneben ist der Session-Mode.                                                                | `.env.prod.local`                            |
| `ssh deploy@178.254.37.110`           | Der VPS bei manitu. Beherbergt den Supabase-Stack (`/home/deploy/swingz-supabase/`), die Backups (`/home/deploy/backups/`) und einen fremden zweiten Stack (`tsow`). | Key `~/.ssh/manitu_vps`, passphrasegeschützt |
| http://127.0.0.1:8011 **auf dem VPS** | **Supabase Studio der Produktion.** Nur lokal auf dem Server gebunden, absichtlich nicht öffentlich. Erreichbar über einen SSH-Tunnel, siehe unten.                  | kein Login — der Tunnel ist der Zugang       |
| https://swingz.cloud                  | Vorgesehene Kundendomain. `noreply@swingz.cloud` verschickt bereits Mails darüber; die Web-App liegt noch auf der Vercel-Adresse.                                    | –                                            |

**Studio der Produktion öffnen:**

```bash
ssh -N -L 8011:127.0.0.1:8011 deploy@178.254.37.110   # Tunnel offen lassen
# danach im Browser: http://127.0.0.1:8011
```

---

## 3. Verwaltung & Drittanbieter

| Dienst               | Adresse                                         | Wofür                                                                                                                                                                               |
| -------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub**           | https://github.com/swingz369/swingz             | Quellcode, CI (Actions), Issues. Der `main`-Branch löst den Produktions-Deploy aus.                                                                                                 |
| **Vercel**           | https://vercel.com/bartmz-3856s-projects/swingz | Hosting der App. Hier liegen die produktiven Umgebungsvariablen, die Deploy-Historie, Laufzeit-Logs und die Cron-Jobs.                                                              |
| **Stripe**           | https://dashboard.stripe.com                    | Abos und Zahlungen. Preis-IDs stehen als `STRIPE_PRICE_*` in den Env-Dateien; Konfiguration siehe `STRIPE_SETUP.md`.                                                                |
| **Resend**           | https://resend.com/emails                       | Mailversand (`noreply@swingz.cloud`) inklusive der Supabase-Auth-Mails. Zustellprotokolle und Domain-Status liegen dort.                                                            |
| **Sentry**           | https://sentry.io (Region EU)                   | Laufzeitfehler aus Produktion. Projekt `4511546930561104`, Organisation `4511546928594944`.                                                                                         |
| **Upstash Redis**    | https://console.upstash.com                     | Rate-Limiting der API-Routen. Instanz `ideal-lynx-116494`.                                                                                                                          |
| **Google AI Studio** | https://aistudio.google.com/apikey              | Gemini-Flash-Key für die KI-Funktionen und die Midscene-E2E-Tests.                                                                                                                  |
| **manitu**           | https://mein.manitu.de                          | Anbieter des VPS. Hier laufen Rechnung, Reboot und Rescue-System — nicht mit dem Supabase-Stack darauf verwechseln.                                                                 |
| **nuLiga**           | https://htv.liga.nu                             | Externe Ligaverwaltung des Verbands. Der Import zieht Mannschaften und Spieler daraus; die Vereinsseite steht je Verein in `clubs.nuliga_club_url` (Form: `…/clubTeams?club=<Nr>`). |

> Für Sentry sind `SENTRY_ORG` und `SENTRY_PROJECT` noch nicht gesetzt — ohne sie lädt der Build keine Source-Maps hoch, Fehler erscheinen dort also ohne lesbare Stacktraces.

---

## 4. Wo welche Zugangsdaten liegen

| Was                                  | Fundort                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------ |
| Alle Testkonten (Admins, Trainer, …) | `docs/TEST-CREDENTIALS.md` — vom Seed erzeugt, nicht in Git              |
| Owner `admin@swingz.com`             | ebenda; die Quelle ist `OWNER_PASSWORD` in `.env.local`                  |
| Lokale Supabase-Keys                 | `supabase status` (Standardwerte, kein Geheimnis)                        |
| Produktions-Keys und -Secrets        | `.env.prod.local` (nicht in Git) und die Vercel-Umgebungsvariablen       |
| VPS-SSH                              | `~/.ssh/manitu_vps`, passphrasegeschützt                                 |
| Backup-Entschlüsselung               | `~/.age/swingz-backup-key.txt` — ohne diese Datei ist kein Backup lesbar |

---

## 5. Beobachtung: der Pooler steht offen im Netz

`supabase-pooler` bindet auf dem VPS an `0.0.0.0:5432` und `0.0.0.0:6543` — Postgres ist damit aus dem gesamten Internet erreichbar, geschützt nur durch das Passwort. In den Logs tauchte deshalb schon Port-Scanner-Rauschen auf.

Solange die App von Vercel aus verbindet, braucht es die öffentliche Bindung; Vercel-Funktionen haben keine festen IP-Adressen, die man freischalten könnte. Wer das enger ziehen will, hat zwei Wege: die Vercel-IP-Bereiche in der Firewall führen (aufwendig, ändert sich) oder eine Tailscale-/WireGuard-Verbindung zwischen Vercel und VPS. Beides ist erst dann verhältnismäßig, wenn echte Vereinsdaten in der DB liegen — dann aber zügig.

---

## 6. Was ein Projekt dieser Art sonst noch braucht

Nach Nutzen sortiert, nicht nach Aufwand. Nichts davon ist eingerichtet.

**1. Totmannschalter für die Backups (30 Minuten).** Das Backup läuft täglich, aber niemand erfährt es, wenn es aufhört. Ein kostenloser Dienst wie healthchecks.io bekommt am Ende des Backup-Skripts einen Ping; bleibt er aus, kommt eine Mail. Das ist die einzige Maßnahme hier, die einen stillen Totalverlust verhindert — ein Backup, das seit sechs Wochen nicht mehr läuft, sieht von außen aus wie eines, das läuft.

**2. Erreichbarkeitsüberwachung (20 Minuten).** Ein Ping auf `https://swingz.vercel.app` alle fünf Minuten (UptimeRobot, Betterstack — beide mit ausreichendem Gratis-Kontingent). Aktuell erfährt man einen Ausfall dadurch, dass ein Verein anruft. Sinnvollerweise zusätzlich auf `https://supabase.swingz.cloud`, denn der VPS ist der Teil ohne Betreiber-SLA.

**3. Abhängigkeiten aktuell halten (15 Minuten).** Renovate oder Dependabot legt wöchentlich Update-PRs an, die CI prüft sie automatisch. `pnpm audit` in der CI meldet heute nur Lücken, es behebt sie nicht — und bei 100+ Paketen wächst der Rückstand schneller, als man ihn von Hand aufholt.

**4. Rechtliches vor dem ersten zahlenden Verein (Halbtag, nicht technisch).** Impressum, Datenschutzerklärung, AGB und Auftragsverarbeitungsverträge mit Vercel, Resend, Stripe, Upstash und Google. Wer Vereinsdaten verarbeitet, braucht die AV-Verträge und ein Verarbeitungsverzeichnis, bevor der erste Vertrag unterschrieben wird — nicht danach.

**5. Logs, die einen Tag überleben (1–2 Stunden).** Vercels Laufzeit-Logs sind kurzlebig, `docker logs` auf dem VPS ebenso. Für die Fehlersuche nach einem Vorfall reicht das nicht. Sentry deckt Ausnahmen bereits ab; für alles darunter (langsame Anfragen, Cron-Ergebnisse) fehlt eine Ablage — Betterstack Logs oder Axiom haben Gratis-Kontingente, die für diese Größe reichen.

**6. Statusseite (später).** Erst sinnvoll, wenn mehrere Vereine produktiv sind und man Störungen einmal statt fünfmal erklären will.

Bewusst **nicht** empfohlen, weil es für ein Ein-Personen-Projekt mehr Pflege kostet als es einbringt: eigenes Grafana/Prometheus, Kubernetes, ein zweiter VPS zur Ausfallsicherheit, Feature-Flag-Dienste (die `clubs.features`-Spalte reicht), Session-Recording-Werkzeuge.
