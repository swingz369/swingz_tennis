# ADR-004: Postgres bleibt öffentlich erreichbar, Tailscale sichert nur die Administration

- **Status:** akzeptiert
- **Datum:** 16. August 2026
- **Betrifft:** VPS `178.254.37.110`, [`docs/SERVICES.md`](../SERVICES.md) § 5
- **Verwandt:** [ADR-003](adr-003-datenbank-umgebungen.md) (Umgebungstrennung)

## Kontext

Der Supavisor-Pooler auf dem VPS band auf `0.0.0.0:5432` und `0.0.0.0:6543`. Postgres war damit aus dem gesamten Internet erreichbar, geschützt allein durch das Passwort; in den Pooler-Logs stand entsprechend Scanner-Rauschen.

Beim Prüfen zeigte sich zweierlei. Erstens: `ufw` ist auf dem Server aktiv, führte aber keine Regel für die beiden Ports — Docker schreibt seine Portfreigaben direkt in die `nat`-Tabelle und umgeht ufw. Der Server war also weniger geschützt, als der Blick auf `ufw status` nahelegt. Zweitens: der naheliegende Ausweg funktioniert nicht. Vercels Serverless-Funktionen können keinem Tailscale-Tailnet beitreten — kein Daemon, keine Raw Sockets, keine Prozesse zwischen den Aufrufen.

Und die App braucht den direkten Postgres-Zugang wirklich: 61 Dateien nutzen Drizzle zur Laufzeit, verteilt auf 23 Repositories, an denen 40 API-Routen hängen. Der Zugriff über die HTTPS-Schnittstelle (Kong/PostgREST) deckt nur den anderen Teil des Codes ab.

## Entscheidung

**Port 6543 bleibt öffentlich**, begrenzt auf 30 neue Verbindungen pro Minute und Quell-IP. Die Regel steht in der Kette `DOCKER-USER` — in ufw hätte sie keine Wirkung — und wird nach jedem Neustart von der systemd-Unit `supavisor-ratelimit.service` gesetzt, weil die Kette beim Booten leer ist.

**Port 5432 wird geschlossen** (`127.0.0.1:5432` statt `0.0.0.0:5432`). Die App verbindet ausschliesslich über den Transaction-Mode auf 6543; der Session-Mode-Port war Angriffsfläche ohne Nutzen.

**Tailscale sichert den Administrationsweg**, nicht den Anwendungsweg: SSH, Prod-Studio, `psql` und Migrationen laufen künftig über das Tailnet (`swingz-vps`, `100.117.232.25`). Der öffentliche SSH-Port bleibt so lange offen, bis die Dev-Maschine im Tailnet ist.

## Verworfene Alternativen

**Tailscale zwischen Vercel und VPS.** Wäre die saubere Lösung und war die erste Idee — sie existiert technisch nicht. Vercels Laufzeitumgebung lässt keinen Tailscale-Client zu. Diese ADR hält das fest, damit der Vorschlag nicht in einem halben Jahr erneut Zeit kostet.

**Vercel-IP-Bereiche in der Firewall freischalten.** Feste Ausgangs-IPs gibt es bei Vercel nur mit Secure Compute (Enterprise-Tarif). Die dokumentierten Bereiche der normalen Funktionen sind weder stabil noch verbindlich.

**`iptables-persistent` statt systemd-Unit.** Speichert den gesamten Regelsatz einschliesslich Dockers dynamischer Regeln und spielt ihn beim Booten zurück — ein bekannter Weg, sich mit veralteten Docker-Regeln den Netzwerk-Stack zu zerlegen. Die Unit setzt genau zwei Regeln, idempotent.

**Die Drizzle-Nutzung zur Laufzeit ablösen**, um den Port ganz zu schliessen. 61 Dateien, 23 Repositories, 40 Routen — das ist ein eigenes Vorhaben, keine Sicherheitsmassnahme nebenbei.

## Konsequenzen

- Der öffentliche Postgres-Port bleibt bestehen und damit ein Restrisiko, das mit einem starken Passwort und der Ratenbegrenzung getragen wird. Das ist eine bewusste Abwägung für die Phase vor dem ersten zahlenden Verein, keine Endlösung.
- Wer künftig einen Docker-Port veröffentlicht, muss wissen: ufw sieht ihn nicht. Neue Freigaben gehören geprüft (`docker ps` gegen `ufw status`), nicht angenommen.
- Der Endzustand ist offen und gehört entschieden, bevor echte Vereinsdaten in der Datenbank liegen. Zwei Wege schliessen den Port wirklich: die App auf den VPS holen (dann ist die Datenbank localhost) oder auf Managed Supabase wechseln (dann liegt die Härtung beim Anbieter). Beides ist eine eigene ADR wert.
