# Infrastruktur & Accounts — wer hostet was, unter welchem Account

> Quelle der Wahrheit für die Frage "wo läuft das eigentlich, und mit wessen Zugang". Entstanden
> aus einem Live-Incident am 21.07.2026 (Saisonplanung down durch Pooler-Portkonflikt), bei dem
> sich zeigte, dass diese Topologie nirgends dokumentiert war.

## Die kurze Version

- **SwingZ-App:** Next.js auf Vercel (Team `bartmz-3856s-projects`).
- **SwingZ-Datenbank/Auth/Storage:** **self-hosted Supabase auf einem eigenen VPS** — **nicht**
  Supabase Cloud. `NEXT_PUBLIC_SUPABASE_URL` und `DATABASE_URL` zeigen auf `supabase.swingz.cloud`.
- Auf **demselben VPS** läuft noch ein zweites, komplett unabhängiges Projekt (`tsow`, ein
  Trainer-/Rechnungsverwaltungs-Tool desselben Users) — geteilte Hardware, getrennte Docker-Stacks.
- **`tsow`'s echte Produktions-DB ist Supabase Cloud** (nicht der VPS) — unter einem weiteren,
  vierten Supabase-Account, auf den die Claude-Code-Supabase-Integration keinen Zugriff hat.

## VPS (self-hosted Supabase)

|          |                                                                                                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host     | `178.254.37.110` (manitu.de)                                                                                                                                            |
| SSH      | `deploy@178.254.37.110`, Key `~/.ssh/manitu_vps` (⚠️ passphrasegeschützt — Details unten)                                                                               |
| Firewall | UFW (nur 22/80/443) + zusätzliche Provider-Firewall bei manitu.de, die **keine weiteren Ports** zulässt — neue Docker-Ports lassen sich nicht einfach nach außen öffnen |

### Zwei Docker-Compose-Stacks auf demselben Host

| Stack             | Verzeichnis                     | Domain                       | Gehört zu                                       |
| ----------------- | ------------------------------- | ---------------------------- | ----------------------------------------------- |
| `swingz-supabase` | `/home/deploy/swingz-supabase/` | `supabase.swingz.cloud`      | **SwingZ** — dieses Repo                        |
| `tsow-supabase`   | `/home/deploy/tsow-supabase/`   | `tsow-supabase.swingz.cloud` | `tsow` (fremdes Projekt, **nicht** dieses Repo) |

Beide Stacks folgen der self-hosted-Supabase-Struktur (Kong, Auth, Rest, Storage, Realtime, Meta,
Studio, DB, Supavisor-Pooler) und liefen bis 21.07.2026 mit identischen Standard-Host-Ports
(`5432`, `6543`) — **das war der Bug**: `tsow-pooler` hat diese Ports zuerst belegt, `swingz`'s
eigener Pooler (`supabase-pooler`, Container) konnte nie starten. Traffic auf
`supabase.swingz.cloud:6543` landete dadurch beim falschen (tsow-)Pooler.

**Aktueller Stand (21.07.2026):** `tsow-pooler` ist gestoppt (nicht gelöscht — `docker start
tsow-pooler` macht es rückgängig). Grund, warum das sicher war: `tsow`'s eigentliche App nutzt für
die Datenbank Supabase Cloud, nicht diesen VPS-Pooler — siehe unten. Alle anderen `tsow-*`-Container
(db, auth, rest, kong, storage) laufen unverändert weiter, `tsow` selbst ist aktiv genutzt und darf
nicht angefasst werden.

### SSH-Zugang zum VPS aus einer Nicht-interaktiven Session (z. B. Claude Code)

Der Key `~/.ssh/manitu_vps` hat eine Passphrase. `ssh -i ~/.ssh/manitu_vps ...` allein schlägt in
einer nicht-interaktiven Shell mit `Permission denied (publickey)` fehl — **obwohl der Key auf
dem Server autorisiert ist** (Debug-Log zeigt `Server accepts key`, aber die Signatur scheitert
mangels entsperrtem Private Key). Funktionierender Workaround:

```bash
# 1. Eigener Agent mit festem Socket-Pfad (Env-Vars überleben keine neuen Shells)
ssh-agent -a /tmp/ssh-agent.sock

# 2. Interaktiv (!) entsperren — Passphrase wird nie an ein Tool durchgereicht
SSH_AUTH_SOCK=/tmp/ssh-agent.sock ssh-add ~/.ssh/manitu_vps

# 3. Alle weiteren SSH-Aufrufe über denselben Socket
SSH_AUTH_SOCK=/tmp/ssh-agent.sock ssh -o IdentitiesOnly=yes -i ~/.ssh/manitu_vps deploy@178.254.37.110 "..."
```

## Vercel

|                                 |                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| Team                            | `bartmz-3856s-projects` (`team_dSBFnKE7SAwXNOOm7YAAFjCx`)                              |
| SwingZ-Projekt                  | `swingz` (`prj_9HU04ZBawZkaD2O3kJ59qEr4Wj5f`) — dieses Repo, https://swingz.vercel.app |
| Weitere Projekte im selben Team | `tsow` (fremdes Projekt — DB auf Supabase Cloud, s.u.), `zandvoort-trip`               |

**Wichtig für "verwechseltes Repo/Env"-Fehler:** `swingz` und `tsow` liegen im selben Vercel-Team,
sind aber komplett getrennte Projekte mit getrennten Env-Vars. Verwechslungsgefahr besteht eher auf
Infra-Ebene (VPS, s.o.) als bei Vercel selbst.

## Supabase — WARUM es hier "mehrere Accounts" gibt

Es existieren mindestens **drei unterschiedliche Supabase-Kontexte**, die leicht verwechselt werden:

1. **SwingZ selbst nutzt gar kein Supabase Cloud** — nur den self-hosted VPS-Stack (s.o.).
2. **Der Supabase-Account, mit dem die Claude-Code-`mcp__claude_ai_Supabase__*`-Integration
   verbunden ist**, sieht drei Projekte: `tsowapp's Project`, `tsow`, `rechnungsportal` — **alle
   mit Status `INACTIVE`** (pausiert). Das sind vermutlich alte/verwaiste Cloud-Projekte aus einer
   früheren Phase, bevor auf self-hosted (VPS) bzw. auf ein anderes Cloud-Projekt umgestellt wurde.
3. **`tsow`'s tatsächliche, aktiv genutzte Produktions-DB** ist ein Supabase-Cloud-Projekt unter
   einem **vierten, anderen Account**
   (`https://supabase.com/dashboard/project/ovbwbcvnkylgrhucdweh`) — auf den weder die
   Claude-Code-Supabase-Integration noch dieses Repo Zugriff haben. Bestätigt über Vercel
   Environment Variables des `tsow`-Projekts (`DATABASE_URL`/`SUPABASE_URL` → `*.supabase.co`).

**Empfehlung, um das "Durcheinander" dauerhaft aufzulösen:** die drei `INACTIVE`-Projekte in
Punkt 2 entweder endgültig löschen (falls wirklich verwaist) oder klar benennen/dokumentieren,
falls sie noch einen Zweck haben (z. B. Backup, Migration-Testfeld) — aktuell sehen sie aus wie
Altlasten, die bei jeder Supabase-Cloud-Recherche fälschlich wie "die" relevante DB wirken.

## GitHub / Git-Identität

Siehe `CONTRIBUTING.md` Rule 9 — vollständig dokumentiert, kein Handlungsbedarf hier. Kurzfassung:
Vercel validiert den Commit-Autor gegen `Bart Mz <bartmz@gmx.de>`; falscher `git config user.email`
(z. B. durch eine frühere AI-Session überschrieben) blockiert Deployments.

## Bekannte, noch nicht behobene Doku-/Config-Lücken

- `lib/env.ts` validiert `DATABASE_URL` nicht (nur `NEXT_PUBLIC_SUPABASE_URL` u. a.) — obwohl der
  gesamte Drizzle-Layer ohne eine korrekte `DATABASE_URL` sofort bricht. Sollte ergänzt werden.
- `docs/handbook/dev/deployment-vercel.md` beschreibt nur die Vercel-Seite; verweist jetzt auf
  dieses Dokument für die Supabase/VPS-Seite.
- `VPS_SETUP_NEXT_SESSION.md` (Repo-Root, absichtlich ungetrackt, enthält echte Zugangsdaten) ist
  von einer abgebrochenen Migrationsplanung (Umzug auf einen neuen Server) und stellenweise
  überholt — der Portkonflikt wurde stattdessen am 21.07.2026 direkt auf dem bestehenden VPS
  gelöst (s.o.), kein neuer Server nötig. Sollte gelöscht oder klar als historisch markiert werden.
