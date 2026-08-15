# ADR-002: Migrations-Tracking über eine eigene Tabelle statt der Supabase-CLI-Tabelle

- Status: angenommen
- Datum: 16. August 2026
- Betrifft: `scripts/migrate.ts`, `public.schema_migrations`, `supabase/migrations/`

## Kontext

`supabase/migrations/` enthielt 175 Dateien. Die Tracking-Tabelle der Supabase-CLI,
`supabase_migrations.schema_migrations`, enthielt **8 Zeilen** — und zwar nicht,
weil 167 Migrationen offen waren, sondern weil nie ein Verfahren existierte, das
Datei und Anwendung zuverlässig verknüpft.

Zwei Ursachen, beide in `docs/DATABASE.md` belegt:

1. **Der Schlüssel ist zu grob.** `schema_migrations.version` ist der
   Zahlen-Präfix des Dateinamens und Primärschlüssel. Zwei Dateien mit
   demselben Präfix kollabieren zu einer Zeile — im Bestand kam das vor
   (`20260815170000` zweimal). Die Tabelle kann den Ist-Zustand also
   konstruktionsbedingt nicht abbilden.
2. **Das Befüllen war ein Einmal-Skript.** `scripts/bulk-track-only-migrations.sh`
   akzeptierte nur 8-stellige Datumspräfixe und übersprang die 14-stelligen
   Zeitstempel stillschweigend. Nach dem Lauf sah die Tabelle gepflegt aus und
   war es nicht.

Die praktische Folge: niemand konnte einer Migrationsdatei ansehen, ob sie live
angewendet war. Mehrere Policy-Generationen liefen gleichzeitig, eine Tabelle
existierte nur, weil sie jemand von Hand im Dashboard angelegt hatte, und die
zuletzt geschriebene Migration (`20260815180000_billing_tables_club_scoping.sql`)
war nie angewendet worden, ohne dass das jemandem auffiel.

## Entscheidung

Das Tracking läuft über eine **eigene Tabelle `public.schema_migrations`**, mit
dem **vollständigen Dateinamen als Primärschlüssel** und einer SHA-256-Prüfsumme
des Dateiinhalts. Bedient wird sie ausschließlich von `scripts/migrate.ts`:

```bash
npm run db:status     # was ist offen
npm run db:dry        # alle offenen Migrationen testen, danach Rollback
npm run db:migrate    # anwenden
npm run db:baseline   # als angewendet markieren, ohne DDL auszuführen
```

Vier Eigenschaften, die die Alternativen nicht haben:

- **Dateiname als Schlüssel** — zwei Dateien mit gleichem Zeitstempel bleiben
  zwei Zeilen. Der Ursprungsfehler ist damit strukturell ausgeschlossen.
- **Prüfsumme** — wird eine bereits angewendete Migrationsdatei nachträglich
  editiert (was AGENTS.md verbietet), meldet das jeder Lauf. Vorher fiel es
  niemandem auf.
- **`dry` in einer einzigen Transaktion** — alle offenen Migrationen laufen
  nacheinander und werden am Ende zurückgerollt. Aufeinander aufbauende
  Migrationen werden dadurch korrekt geprüft; getrennte Transaktionen je Datei
  hätten Folgemigrationen fälschlich als fehlerhaft gemeldet.
- **`baseline`** — der Erstlauf gegen eine DB, die den Altbestand bereits trägt,
  markiert ihn ohne DDL. Genau das brauchte der Bestand hier: 173 Dateien lagen
  auf der DB, 2 waren wirklich offen.

## Verworfene Alternativen

**`supabase_migrations.schema_migrations` reparieren.** Hätte bedeutet, die
Dateien mit doppeltem Präfix umzubenennen, damit der Präfix eindeutig wird —
also Historie zu ändern, um ein Schema zu retten, das ohnehin nur die
Supabase-CLI braucht. Die CLI wird hier nicht zum Anwenden von Migrationen
benutzt (`scripts/apply-migration.ts` existiert genau deshalb), also wird auch
ihre Buchhaltung nicht gebraucht.

**`drizzle-kit migrate`.** Stand als `db:migrate` in `package.json`, wurde aber
nie verwendet: Drizzle nutzt den `pg`-Treiber, der gegen den self-hosted
Supavisor nicht zuverlässig verbindet — der Grund, aus dem
`scripts/apply-migration.ts` überhaupt geschrieben wurde. Das Skript hier nutzt
denselben `postgres-js`-Treiber wie die Anwendung.

**Nichts tun und weiter von Hand anwenden.** Der Status quo. Er hat in vier
Monaten drei Klassen von Schäden erzeugt, die alle in `docs/DATABASE.md` stehen.

## Konsequenzen

- `scripts/bulk-track-only-migrations.sh` und `scripts/apply-migration.ts` sind
  abgelöst. Sie bleiben vorerst liegen, werden aber nicht mehr aufgerufen.
- `supabase_migrations.schema_migrations` bleibt unangetastet und ohne Bedeutung.
  Wer künftig `supabase db push` benutzen will, muss diese ADR revidieren.
- `npm run db:status` gehört vor jede Arbeit an der Datenbank — und `npm run
db:dry` vor jedes Anwenden. Der Probelauf hat den Fehler in
  `20260815180000` gefunden, bevor er die DB erreichte.
- Die Regel „Migrationsdateien sind Historie" (AGENTS.md § Migrationen, Regel 3)
  wird jetzt maschinell gestützt: die Prüfsumme meldet jede nachträgliche
  Änderung.
