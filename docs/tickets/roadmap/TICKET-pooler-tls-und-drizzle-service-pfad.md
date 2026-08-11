# TLS am Supavisor-Pooler + Drizzle als Service-Pfad

> Zuletzt verifiziert: 12. August 2026

Zwei Befunde aus dem Sicherheitsdurchgang vom 12.08.2026, die beide einen
Eingriff außerhalb des Repos brauchen. Der Code-Teil ist jeweils schon drin.

---

## 1. Der Pooler nimmt kein TLS an

**Befund, live geprüft:** `supabase.swingz.cloud:6543` terminiert überhaupt
kein TLS. Nicht „nimmt auch Klartext an" — `sslmode=require` wird aktiv
abgewiesen:

| Verbindungsoption | Ergebnis                                |
| ----------------- | --------------------------------------- |
| `ssl: false`      | Verbindung OK                           |
| `ssl: 'require'`  | abgelehnt, `tls_validate_record_header` |

Damit läuft **jede** Query von Vercel zur Datenbank unverschlüsselt über das
öffentliche Netz — einschließlich des DB-Passworts im Startup-Paket, das
postgres-js beim Verbindungsaufbau sendet.

### Code-Seite: erledigt

`src/infrastructure/persistence/db.ts` liest die SSL-Option jetzt aus
`DATABASE_SSL`. Default bleibt `false`. Ein fest verdrahteter Umschalter
wäre gefährlich gewesen: geht der Code live, bevor der Server TLS spricht,
schlägt jede Query fehl. So sind Code-Deploy und Server-Umstellung
entkoppelt, und der Rollback ist dieselbe Variable statt eines Deploys.

### Server-Seite: offen, muss der Betreiber ausführen

Mutierende Kommandos auf dem VPS werden dem Agenten geblockt, und
`~/.ssh/manitu_vps` ist passphrasegeschützt. Reihenfolge:

1. **Zertifikat prüfen.** Caddy hält bereits ein gültiges Zertifikat für
   `supabase.swingz.cloud` (laut Notiz von 07/2026 bis Oktober 2026).
   Supavisor braucht Key und Cert als Datei im Container.
2. **Supavisor auf TLS umstellen** in `/home/deploy/swingz-supabase/`.
   Supavisor liest die TLS-Optionen aus seiner Runtime-Config; die
   entsprechenden Keys heißen in aktuellen Releases `ssl_certfile` und
   `ssl_keyfile`. **Vor dem Anwenden gegen die Doku der tatsächlich
   installierten Supavisor-Version abgleichen** — die Namen haben sich
   zwischen Releases geändert, und aus der Ferne war nur die Portlage
   prüfbar, nicht die Version.
3. **Auf einem Zweitport testen**, bevor 6543 umgestellt wird. So bleibt
   die laufende App unberührt, falls die Konfiguration nicht greift.
4. **Verifizieren** — ein Klartext-Verbindungsversuch muss danach
   scheitern, nicht nur der TLS-Versuch klappen. Sonst ist TLS zwar
   möglich, aber nicht erzwungen, und der Befund bleibt bestehen.
5. **`DATABASE_SSL=require`** in den Vercel-Projekt-Env-Vars setzen
   (Projekt `swingz`, `prj_9HU04ZBawZkaD2O3kJ59qEr4Wj5f`), Redeploy oder
   Neustart der Functions abwarten.
6. **Rollback**, falls etwas klemmt: `DATABASE_SSL` wieder entfernen. Der
   Code fällt dann auf `ssl: false` zurück, ohne Deploy.

> Achtung: `tsow-supabase` läuft auf demselben Host. Nur den Stack unter
> `/home/deploy/swingz-supabase/` anfassen.

---

## 2. Drizzle verbindet als `postgres` mit BYPASSRLS

**Befund, live geprüft:** `current_user` = `postgres`, `rolbypassrls` = true.
Kein Codepfad setzt `request.jwt.claims` oder `SET ROLE`.

Der naheliegende Fix — eine eigene Rolle ohne BYPASSRLS und eine neue
`DATABASE_URL` — **funktioniert nicht** und wurde deshalb verworfen. Ohne
JWT-Kontext ist `auth.uid()` immer NULL, jede Policy schlägt fehl, und die
Routes bekommen nicht etwa Fehler, sondern leere Ergebnisse:

| Tabelle          | als `postgres` | als `authenticated` ohne JWT |
| ---------------- | -------------- | ---------------------------- |
| invoices         | 982            | 0                            |
| users            | 447            | 0                            |
| courts           | 36             | 0                            |
| hours_logs       | 25             | 0                            |
| trainer_absences | 24             | 0                            |

Ein reiner URL-Tausch hätte die App also still zerlegt: überall leere
Listen, keine einzige Fehlermeldung.

### Entschieden: Drizzle ist ein vertrauenswürdiger Service-Pfad

Analog zu `createServiceClient()`. RLS bleibt für die Supabase-Client-Pfade
scharf; auf dem Drizzle-Pfad wird die Mandantentrennung **im Query**
erzwungen und ist damit Sache des Route-Codes, nicht der Datenbank.

Der Audit dazu ist gelaufen. Ergebnis: alle Routes prüfen die
Club-Zugehörigkeit — zwei taten es nicht und sind gefixt:

- `GET /api/seasons/[id]/planning/inactive-weeks` — nur globale Rollenprüfung,
  fremde Wochenplanung lesbar (Commit `2de761e1`)
- `POST /api/schedule/optimize` — fremde Trainingspräferenzen inklusive
  Mitgliedsnamen lesbar, dazu ein ungeprüfter `clubId` aus dem Body. Route
  war toter Code und wurde entfernt (Commit `14230770`)

### Offene Folgearbeit

`authorizeSeasonAccess()` aus `lib/season-auth.ts` wurde gebaut, um das
~22-fach duplizierte Auth-Muster abzulösen — übernommen haben es bisher
**2 von 19** Saison-Routes. Beide gefundenen Lücken sind genau die Folge
davon: bei zentraler Prüfung kann ein Handler den Club-Check nicht
vergessen. Die Adoption auf alle Routes zu heben ist mechanisch, aber
sicherheitsrelevant und betrifft 17 Dateien mit teils unterschiedlichen
`allowedRoles` — gehört in einen eigenen PR mit laufender Testsuite, nicht
nebenbei.

Zwei kleinere Abweichungen, nicht ausnutzbar, aber inkonsistent:
`seasons/[id]/plan-entries/[entryId]` und `seasons/[id]/preferences` prüfen
`m.club_id === season.club_id` **ohne** Rollenfilter im Prädikat, im
Gegensatz zu den übrigen 15 Routes.
