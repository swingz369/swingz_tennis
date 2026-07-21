# VPS Setup & Migration Handoff für nächste Session

## Aktueller Zustand (Stand: 2026-07-14, 20:30 UTC)

### Alte manitu.de VPS (178.254.37.110)

**Status:** Läuft nur `tsow-supabase` (Live)

- **IP:** 178.254.37.110
- **SSH:** `ssh deploy@178.254.37.110` (ed25519-Key, `/home/aeugeln/.ssh/manitu_vps`)
- **Firewall:** UFW, nur SSH (22), HTTP (80), HTTPS (443)
- **RAM:** 3,8 GB / 2 vCPU (knapp für 2 Stacks — daher Aufteilung)
- **Docker Stacks:**
  - ✅ `tsow-supabase` läuft (live auf https://tsow-supabase.swingz.cloud)
  - ❌ `swingz-supabase` gestoppt (Daten liegen noch unter `/home/deploy/swingz-supabase/volumes/db/data/`)

### Lokale Maschine (Laptop)

- **Backup-Verzeichnis:** `~/swingz-backups/` — enthält age-verschlüsselte Dumps
- **Private Key:** `~/.age/swingz-backup-key.txt` (für Entschlüsselung)
- **Backup-SSH-Key:** `~/.ssh/swingz_backup_pull` (read-only via rrsync zu 178.254.37.110)
- **Systemd Timer:** `swingz-backup-sync.timer` — zieht täglich um 08:00 Uhr Backups vom Server

---

## Aufgabe für nächste Session: Migration zu neuem 8GB-Server

### Voraussetzungen

1. **Neuer Server muss vorhanden sein** — User kauft separaten VPS mit mind. 8 GB RAM + 2 vCPU
2. **SSH-Zugang zum neuen Server** — am besten ed25519-Key wie auf dem alten Server
3. **Neue IP-Adresse** — für DNS-Cutover später notwendig

### Schritte (in dieser Reihenfolge)

#### Phase 1: Neuer Server Vorbereitung (Grundhärtung)

```bash
# 1. SSH-Zugang testen
ssh root@<NEUE_IP> "hostname"

# 2. Deploy-User anlegen + Grundhärtung (identisch zum alten Setup)
# → siehe CLAUDE.md → "VPS hardening" oder alte Session-Historie
# Kurz: Root-Key lockdown, deploy-User mit sudo, UFW, Swap, fail2ban, unattended-upgrades

# 3. Docker + Docker Compose installieren
ssh deploy@<NEUE_IP> "docker --version && docker-compose --version"

# 4. Verzeichnis anlegen
ssh deploy@<NEUE_IP> "mkdir -p /home/deploy/swingz-supabase"
```

#### Phase 2: Daten vom alten Server übertragen

```bash
# 1. Rohdaten-Kopie (Bind-Mount DB-Verzeichnis + volumes)
rsync -avz deploy@178.254.37.110:/home/deploy/swingz-supabase/ \
  /tmp/swingz-backup-transfer/

# 2. Auf neuem Server empfangen
rsync -avz /tmp/swingz-backup-transfer/ \
  deploy@<NEUE_IP>:/home/deploy/swingz-supabase/

# 3. Permissions prüfen (sollten vom rsync passen, ansonsten: `sudo chown -R deploy:deploy /home/deploy/swingz-supabase`)
ssh deploy@<NEUE_IP> "ls -la /home/deploy/swingz-supabase/volumes/db/data/ | head"
```

#### Phase 3: Caddy-Setup auf neuem Server (anders als alten!)

**WICHTIG:** Der neue Server läuft nur `swingz`, braucht KEINEN geteilten Loopback-Caddy!

- `docker-compose.yml` hat bereits `caddy`-Service (original, nicht die Loopback-Variante)
- `docker-compose.local-proxy.yml` NICHT verwenden (war für alten Server mit Loopback-Ports)
- Starten mit: `docker compose -f docker-compose.yml up -d`

```bash
ssh deploy@<NEUE_IP> "cd /home/deploy/swingz-supabase && docker compose up -d"
```

#### Phase 4: Verifikation VOR DNS-Cutover

```bash
# 1. Container-Health prüfen
ssh deploy@<NEUE_IP> "docker ps --format '{{.Names}}: {{.Status}}' | grep supabase"

# 2. Auth-API testen (via curl --resolve, damit DNS noch nicht geändert ist)
curl -v --resolve supabase.swingz.cloud:443:<NEUE_IP> \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgzOTU0OTc3LCJleHAiOjIwOTkzMTQ5Nzd9.mfOqTZ5mQe35sjHYrOkgiXIfhtzRvD-PS9OPv7VZCZc" \
  https://supabase.swingz.cloud/auth/v1/health

# Erwartet: HTTP 200
```

#### Phase 5: DNS-Cutover (User führt selbst aus)

1. Bei checkdomain.de anmelden
2. A-Record `supabase.swingz.cloud` ändern:
   - **Alt:** 178.254.37.110
   - **Neu:** <NEUE_IP>
3. Propagierung prüfen:
   ```bash
   dig +short A supabase.swingz.cloud @8.8.8.8
   ```
4. Nach ~5-10 Minuten sollte neue IP antwortet

#### Phase 6: Login-Verifizierung

```bash
# Sollte jetzt automatisch zur neuen Instanz gehen
curl https://swingz.vercel.app/api/auth/health
# oder direkter Login-Test via Browser
```

#### Phase 7: Backup-Migration

```bash
# 1. backup-db.sh vom alten Server kopieren
rsync deploy@178.254.37.110:/home/deploy/swingz-supabase/backup-db.sh \
  deploy@<NEUE_IP>:/home/deploy/swingz-supabase/

# 2. Cron-Job auf neuem Server einrichten
ssh deploy@<NEUE_IP> "
  (crontab -l 2>/dev/null; echo '0 3 * * * /home/deploy/swingz-supabase/backup-db.sh >> /home/deploy/swingz-backups/backup.log 2>&1') | crontab -
"

# 3. Lokalen rsync-Pull-Mechanismus zur neuen IP umleiten
# ~/.ssh/swingz_backup_pull bleibt unverändert (key-basiert)
# aber systemd-Timer muss neue IP kennen
# (in nächster Session: edit swingz-backup-sync.service, adresse anpassen)
```

#### Phase 8: Aufräumen auf altem Server

```bash
# swingz-supabase-Stack + Verzeichnis vom alten Server löschen
ssh deploy@178.254.37.110 "
  cd /home/deploy/swingz-supabase && docker compose down
  rm -rf /home/deploy/swingz-supabase
  docker system prune -a --volumes
"

# Caddy-Config cleanup: supabase.swingz.cloud-Block aus Caddyfile entfernen
ssh deploy@178.254.37.110 "
  sudo nano /home/deploy/reverse-proxy/Caddyfile
  # oder sed zum entfernen
"
# Dann Caddy reload: docker exec shared-caddy caddy reload
```

---

## Wichtige Zugangsinfos für nächste Session

### Aktuelle Backup-Zugangsdaten

```
Lokale Backup-SSH-Key:     ~/.ssh/swingz_backup_pull
Private Age-Key:            ~/.age/swingz-backup-key.txt
Backup-Verzeichnis:         ~/swingz-backups/
Systemd-Timer-Cron:         0 8 * * * (täglich um 08:00 Uhr)
```

### Alte Server-Zugangsdaten (bleiben gleich!)

```
Host:                       178.254.37.110
SSH-Key:                    ~/.ssh/manitu_vps (ed25519)
SSH-User:                   deploy
Aktive Stacks:              tsow-supabase (Live)
Gestoppte Stacks:           swingz-supabase (Daten noch vorhanden)
```

### Test-Accounts (funktionieren auf beiden Instanzen, Daten identisch)

```
E-Mail: admin@swingz.com
Passwort: AdminPass123!
Rolle: owner

E-Mail: admin@rheinland-tennis.de
Passwort: Test2026!
Rolle: admin (TC Rheinland e.V.)

→ Siehe docs/TEST-CREDENTIALS.md im Projekt für alle Accounts
```

### Supabase-Keys (identisch auf alten + neuen Server)

```
Anon-Key:           eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgzOTU0OTc3LCJleHAiOjIwOTkzMTQ5Nzd9.mfOqTZ5mQe35sjHYrOkgiXIfhtzRvD-PS9OPv7VZCZc

Service-Role-Key:   eyJhbGciOiJIUzI1NiIsInR5cCI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgzOTU0OTc3LCJleHAiOjIwOTkzMjMzMDl9.JHSb5pey---qBBz5T0Aja2HHbBno395G-3Z4KQ1Owlc
```

---

## Checkliste für nächste Session

- [ ] Neue Server-IP vom User bekommen
- [ ] SSH-Zugang testen → `ssh deploy@<NEUE_IP>`
- [ ] Grundhärtung durchführen (siehe Phase 1)
- [ ] Daten vom alten Server kopieren (Phase 2)
- [ ] Docker compose up (Phase 3)
- [ ] Health-Checks bestätigen (Phase 4)
- [ ] User: DNS-Cutover durchführen (Phase 5)
- [ ] Login-Verifizierung (Phase 6)
- [ ] Backup-Migration (Phase 7)
- [ ] Cleanup auf altem Server (Phase 8)
- [ ] Uptime-Kuma-Monitor für neuen Server anlegen
