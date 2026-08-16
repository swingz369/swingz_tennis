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
| https://swingz.vercel.app/status      | Öffentliche Statusseite: App, Datenbank, Alter der letzten Datensicherung. Ohne Login erreichbar, damit sie gerade dann hilft, wenn die Anmeldung klemmt.            | kein Login                                   |
| https://swingz.vercel.app/api/health  | Dieselben Prüfungen als JSON. Quelle der Überwachung in `.github/workflows/monitor.yml`.                                                                             | kein Login                                   |
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

## 5. Netzzugang zum VPS

Stand 16.08.2026 nach der Härtung. Begründung und verworfene Alternativen: [`decisions/adr-004-netzzugang-vps.md`](decisions/adr-004-netzzugang-vps.md).

| Port               | Zustand                                                              | Warum                                                                                                                        |
| ------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 6543 (Transaction) | **öffentlich**, begrenzt auf 30 neue Verbindungen/Minute je Quell-IP | Vercel-Funktionen haben keine festen IP-Adressen und können keinem Tailnet beitreten — ohne diesen Port läuft die App nicht. |
| 5432 (Session)     | **geschlossen**, nur noch `127.0.0.1`                                | Die App nutzt ausschliesslich 6543. Der zweite Port war reine Angriffsfläche.                                                |
| 22 (SSH)           | öffentlich, fail2ban aktiv                                           | Bleibt offen, bis die Dev-Maschine im Tailnet ist — sonst sperrt man sich selbst aus.                                        |
| 80/443             | öffentlich (Caddy)                                                   | Kong/Supabase-Gateway und Studio-Weiterleitung.                                                                              |

> **Falle, über die man hier stolpert:** `ufw` ist aktiv, hatte aber **nie** eine Regel für 5432 oder 6543 — die Ports waren trotzdem offen. Docker schreibt seine Portfreigaben direkt in die `nat`-Tabelle und umgeht ufw vollständig. Eine ufw-Regel für einen von Docker veröffentlichten Port hat keine Wirkung; sie gehört in die Kette `DOCKER-USER`. Wer das nicht weiss, hält den Server für dichter, als er ist.

Die Ratenbegrenzung steht deshalb in `DOCKER-USER` und wird nach jedem Neustart von der systemd-Unit `supavisor-ratelimit.service` neu gesetzt (die Kette ist beim Booten leer). Bewusst kein `iptables-persistent`: das würde Dockers dynamische Regeln mit einfrieren.

### Tailscale

Der VPS ist als **`swingz-vps`** (`100.117.232.25`) im Tailnet. Gedacht ist es für den Administrationsweg — SSH, Prod-Studio, `psql`, Migrationen —, nicht für die App: Vercels Serverless-Funktionen können einem Tailnet nicht beitreten.

```bash
# Weiteren Rechner aufnehmen (Auth-Key aus der Tailscale-Konsole, Settings → Keys):
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --hostname=<name>

# Prod-Studio danach ohne öffentlichen Umweg:
ssh -N -L 8011:127.0.0.1:8011 swingz-vps
```

**Nächster Schritt:** Sobald die Dev-Maschine im Tailnet ist, kann SSH auf dem VPS auf das Tailnet-Interface beschränkt werden (`ufw delete allow OpenSSH`, `tailscale up --ssh`). Vorher nicht — dann ist der Server nur noch über die manitu-Konsole erreichbar.

---

## 6. Betriebsüberwachung

Eingerichtet am 16.08.2026, bewusst ohne zusätzlichen Anbieter — GitHub Actions und die eigene Datenbank reichen dafür.

| Baustein                 | Wo                                          | Was es tut                                                                                                                                                                                       |
| ------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Backup-Lebenszeichen** | `public.ops_heartbeats`, Zeile `vps-backup` | Das VPS-Backup schreibt nach jedem erfolgreichen Lauf einen Zeitstempel in die Produktions-DB. Ein Backup, das aufhört, wird dadurch sichtbar statt still.                                       |
| **`/api/health`**        | App                                         | Prüft Datenbank und Alter des letzten Backups (überfällig ab 36 h). Datenbankausfall → HTTP 503; überfälliges Backup → HTTP 200 mit `status: error`, weil Vereine dann ungestört weiterarbeiten. |
| **`monitor`-Workflow**   | `.github/workflows/monitor.yml`             | Alle 30 Minuten: App, Datenbank, Backup-Alter, Supabase-Gateway auf dem VPS. Schlägt einer fehl, verschickt GitHub eine Mail. Läuft nur vom `main`-Branch.                                       |
| **Statusseite**          | https://swingz.vercel.app/status            | Öffentlich, ohne Login. Beantwortet die Frage „liegt es an euch oder an mir?" ohne Rückruf.                                                                                                      |
| **Abhängigkeiten**       | `.github/dependabot.yml`                    | Wöchentliche Update-PRs (Patch/Minor gebündelt, Major einzeln), monatlich für die Actions selbst.                                                                                                |
| **Fehler mit Kontext**   | Sentry                                      | `createLogger` hängt Modulname als Tag und die übergebenen Daten als `extra` an jedes Sentry-Ereignis — vorher kam dort nur die nackte Meldung an.                                               |

### Noch offen

**Rechtliches vor dem ersten zahlenden Verein (Halbtag, nicht technisch).** Impressum, Datenschutzerklärung, AGB und Auftragsverarbeitungsverträge mit Vercel, Resend, Stripe, Upstash und Google. Wer Vereinsdaten verarbeitet, braucht die AV-Verträge und ein Verarbeitungsverzeichnis, bevor der erste Vertrag unterschrieben wird — nicht danach.

**Durchsuchbare Logs.** Sentry hält Ausnahmen und Warnungen samt Kontext. Was darunter liegt — Cron-Ergebnisse, langsame Anfragen, Zugriffsmuster — lebt weiterhin nur in Vercels kurzlebigen Laufzeit-Logs. Ein Anbieter mit Gratis-Kontingent (Betterstack, Axiom) schliesst das, sobald jemand rückblickend eine Frage stellt, die Sentry nicht beantwortet.

Bewusst **nicht** empfohlen, weil es für ein Ein-Personen-Projekt mehr Pflege kostet als es einbringt: eigenes Grafana/Prometheus, Kubernetes, ein zweiter VPS zur Ausfallsicherheit, Feature-Flag-Dienste (die `clubs.features`-Spalte reicht), Session-Recording-Werkzeuge.
