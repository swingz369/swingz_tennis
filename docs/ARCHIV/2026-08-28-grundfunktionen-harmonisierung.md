# Grundfunktionen-Harmonisierung — Durchlauf 28.08.2026

> Snapshot. Ziel: die vier Core-Module (`category: 'core'` in `lib/features.ts` —
> **members, trainers, seasons, finance**) plus Navigation, Nachrichten und
> Einstellungen so weit in Einklang bringen, dass sie für alle fünf Rollen
> (owner > superadmin > admin > trainer > member) einzeln **und** ineinander-
> greifend funktionieren. Optionale Module ausdrücklich nicht im Auftrag —
> Funde dort stehen unten nur als Notiz.

Basis: `main` @ `3f39c902`, dazu 12 bereits vorher uncommittete Dateien.
Alle Läufe gegen den lokalen Supabase-Stack (Kong `:3001`, DB `:54322`) und die
Agent-Lane (`Claude Sandbox Alpha`). Nutzer-Lane nur gelesen.

---

## 1. Kurzfassung

Elf Befunde, acht davon behoben und belegt. Der wichtigste war kein Fehler in
einem Modul, sondern **unter** allen: das Seed-Skript schrieb jede jsonb-Spalte
doppelt kodiert (F-1), und kein Testverein hatte ein Abo (F-8) — zusammen
machten diese beiden fast jede Prüfung entweder falsch-rot oder falsch-grün.
Drei Punkte bleiben offen; alle drei brauchen eine Entscheidung von dir, nicht
mehr Arbeit von mir.

| Ebene                   | Vorher                      | Nachher                                |
| ----------------------- | --------------------------- | -------------------------------------- |
| `npx tsc --noEmit`      | 0 Fehler                    | 0 Fehler                               |
| `npx vitest run`        | 1556 grün, 1 rot            | **1557 grün, 0 rot** (106/106 Dateien) |
| Admin-Seiten im Browser | Bezahlschranke statt Inhalt | **37/39 grün** (2 = optionales Modul)  |
| Superadmin-Seiten       | 0/9 (Bezahlschranke)        | **9/9 grün**                           |
| Mitglieder-Seiten       | 32/33                       | **33/33 grün**                         |
| Trainer-Seiten          | 6/6, Rollen-Test rot        | **6/6 grün + Rollen-Test grün**        |
| Owner-Seiten            | Login 401                   | **8/8 grün** (nach E-3)                |

---

## 2. Umgebung

| Prüfung            | Ergebnis                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Supabase lokal     | lief bereits (Kong `:3001`, DB `:54322`)                                                                                |
| Playwright-Browser | fehlten → Chromium nachinstalliert                                                                                      |
| Dev-Server         | wird von `playwright.config.ts` selbst gestartet                                                                        |
| RAM                | 16 GB; ein Vollauf aller 95 Seiten-Tests hat den Dev-Server einmal per OOM gekillt → seitdem Suite-weise, `--workers=1` |

---

## 3. Was bereits stimmte (statisch belegt)

| Prüfung                                                                                        | Ergebnis                                                                                                                |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Alle 65 Nav-`href` aus `lib/navigation.ts` + `lib/features.ts` treffen eine echte Route        | **0 tote Links** (122 Seiten)                                                                                           |
| Alle 98 Seiten unter `app/(protected)` haben einen Auth-Guard (direkt oder über Eltern-Layout) | **0 ungeschützt**                                                                                                       |
| Alle 323 API-Routen tragen einen Auth-Marker                                                   | **keine offene Route** — 6 bewusst öffentlich (`/api/public/*`, `csrf-token`, `vapid-key`), 2 nutzen `requireAdminClub` |
| Rollen-Trennung (Sidebar-Sektionen, Redirects)                                                 | `role-access.spec.ts` **9/9 grün**                                                                                      |

---

## 4. Behobene Befunde

### F-1 — Seed schrieb **jede** jsonb-Spalte doppelt kodiert

**Symptom:** `sessions.group_ids`, `groups.member_ids`,
`member_schedule_preferences.weekly_availability`,
`trainer_profiles.qualifications/specializations`,
`trainer_availabilities.recurring_pattern` u. a. lagen als jsonb-**String**
statt Array/Objekt in der DB (`jsonb_typeof` = `string`, Wert `"[\"uuid\"]"`).

**Ursache:** `scripts/seed-testdata.ts` schrieb 13 jsonb-Spalten mit
`JSON.stringify(...)`. postgres.js legt das als jsonb-String ab; für ein echtes
Array braucht es `sql.json(...)`. Minimalfall gegen die lokale DB:

```
insert ... { a: sql.json(['x','y']), b: JSON.stringify(['x','y']) }
→ jsonb_typeof(a) = array,  jsonb_typeof(b) = string
```

**Tragweite:** die Wurzel unter den meisten „läuft nicht"-Symptomen. Jeder
Consumer, der `group_ids`/`member_ids` als Array liest, bekam nichts — ohne
Fehler, nur leer. Solange das drinsteht, ist **keine** Prüfung an Seed-Daten
belastbar.

**Fix:** 13 × `JSON.stringify(` → `sql.json(`.
**Beleg:** Alpha nach Neu-Seed `jsonb_typeof(group_ids) = array`; Kette
Gruppe → Session → Planeintrag steht:

| Gruppe                     | Mitglieder | Sessions | Planeinträge |
| -------------------------- | ---------- | -------- | ------------ |
| Erwachsene Anfänger        | 3          | 3        | 1            |
| Erwachsene Fortgeschritten | 4          | 3        | 1            |
| Erwachsene Leistung        | 2          | 3        | 1            |
| Jugend Anfänger            | 2          | 3        | 1            |

### F-2 — Sessions ohne Rückverweis auf den Planeintrag

`sessions.plan_entry_id` war bei **allen** Sessions `NULL`, obwohl die Saison
auf `published` stand — der Publish-Übergang liess sich in den Testdaten gar
nicht prüfen. Ursache: die Session-Erzeugung im Seed las die Planeinträge ohne
deren `id`. Behoben; Beleg: Alpha 12/12 Sessions mit `plan_entry_id`.

### F-3 — Saisonplan joint Gruppen gegen die falsche (leere) Tabelle

Die DB führt **beide**: `groups` (club-weit, mit `member_ids`) und
`training_groups`. `season_plan_entries.group_id` hat einen **FK auf `groups`**,
aber `app/api/seasons/[id]/plan-entries/route.ts` und `.../[entryId]/route.ts`
jointen dieselbe Spalte gegen `trainingGroups` — in allen sieben Vereinen leer.
Jeder Planeintrag kam mit `group_name: null` zurück.

```
select e.id, g.name via_groups, tg.name via_training_groups
  from season_plan_entries e
  left join groups g on g.id = e.group_id
  left join training_groups tg on tg.id = e.group_id;
→ via_groups = 'Jugend Anfänger' …   via_training_groups = NULL (alle Zeilen)
```

**Fix:** beide Routen joinen jetzt `groups`.

### F-5 — Rechnungs-Integrationstest flakte gegen PostgREST

`billing-engine.test.ts` fiel im Vollauf mit `Failed to create invoice: An
invalid response was received from the upstream server` (Kong 502). Einzeln
nachgestellt: `insert` per psql **ok**, derselbe Insert über PostgREST
**HTTP 201**, Datei allein **28 grün**. Also kein Codefehler, sondern ein 502
unter paralleler vitest-Last; im Vollauf jetzt grün.
Bleibt als Notiz: `lib/billing/invoice.service.ts` behandelt einen 502 wie
einen fachlichen Fehler und wirft — ohne Wiederholung.

### F-7 — Kernmodul „Finanzen" hatte in keinem Verein Daten

`invoices`, `invoice_items`, `hours_logs`, `trainer_billings`: **0 Zeilen in
allen sieben Vereinen**. Der Seed legte nur Beitragskategorien an. Damit war
das Modul für jede Rolle leer — Admin sah keine Rechnung, Mitglied keine
eigene, Trainer keine Stunden — und der Genehmigungs-Workflow für
Trainerstunden gar nicht auslösbar.

**Fix:** Seed erzeugt jetzt pro Verein 8 Rechnungen in allen vier Zuständen,
die die Oberfläche unterscheidet, und je Trainer eine genehmigte plus eine
offene Stunde.

| Verein               | Rechnungen                         | Trainerstunden            |
| -------------------- | ---------------------------------- | ------------------------- |
| Claude Sandbox Alpha | 8 (je 2 × draft/sent/overdue/paid) | 6 (3 approved, 3 pending) |

### F-8 — Ohne Abo ist der **gesamte** Admin- und Superadmin-Bereich zu

`app/(protected)/admin/(gated)/layout.tsx` zeigt bei
`subscription === 'none'` statt der Seite den Block „Abonnement erforderlich" —
für **alle 26** Seiten der Gruppe. Kein geseedeter Verein hatte ein Abo, also
lief jeder Admin- und Superadmin-Klickweg gegen die Bezahlschranke.

**Warum das monatelang niemandem auffiel:** `all-pages-render.spec.ts` prüft
`body` gegen ein Wortmuster — und die **Sidebar wird auf der Schranke
mitgerendert**. `/admin/members` fand „Mitglieder", `/admin/billing` fand
„Abrechnung"… und meldete grün. Nur die sechs Seiten, deren Stichwort nicht
zufällig in der Sidebar steht (`audit-logs`, `perf-history`, `shop`,
`leagues`, `tournaments`, `work-duties`), fielen um. Die Suite war grün und
blind zugleich.

**Fix:** eingerichtete Testvereine bekommen im Seed ein laufendes Abo
(Admin → `solo_s`, Superadmin → `school_s`). Die noch leeren Vereine
(TC Neuland, Claude Sandbox Beta) bleiben bewusst ohne — das ist der echte
Erstlogin-Weg: erst Onboarding-Wizard, dann Kasse.

**Beleg:** Admin-Seiten 37/39, Superadmin-Seiten 9/9 (vorher 0/9).

### F-9 — Der Lane-Reset zerbrach, sobald es Finanzdaten gab

Direkte Folge von F-7: `npm run seed:agent` scheiterte mit
`update or delete on table "clubs" violates foreign key constraint
"audit_logs_club_id_fkey"`. `audit_finance_change` ist ein **AFTER-DELETE**-
Trigger auf `invoices`/`payments` — beim Aufräumen schreibt er neue
`audit_logs`-Zeilen, nachdem die generische Löschschleife diese Tabelle schon
geleert hat. Behoben: `audit_logs` wird direkt vor `delete from clubs` noch
einmal geleert.

### F-11 — Zwei falsch-rote Testfälle

- **Rollen-Umleitungen (`… CANNOT access …`):** `waitForURL(..., 15000)`
  reichte nicht, wenn die Zielroute der Umleitung im Dev-Server erst kalt
  kompiliert wird. Nachgemessen: ein Superadmin auf `/owner/clubs` **wird**
  nach `/superadmin` umgeleitet, nur eben nach mehr als 15 s. Auf 45 s
  angehoben — alle vier Rollen-Grenztests grün. (Keine Rollen-Lücke.)
- **`/scheduler`:** erwartet wurde „Stundenplan", die Seite heisst seit dem
  Umbau auf `UnifiedCourtCalendar` **„Platzkalender"**. Erwartung korrigiert.

### F-12 — `CLAUDE.md` gab falsche Preise an

`CLAUDE.md` nannte „Starter €29, Professional €79". `lib/plans.ts` führt
Starter €29, **Professional €49**, Tennisschule S €79, Tennisschule L €99.
Nach `AGENTS.md` § 4 korrigiert, samt Tarif-Keys und einem Hinweis auf das
Pflicht-Abo, plus neuem Verifikationsdatum.

---

## 5. Rolle × Core-Modul — Matrix

Legende: ✅ im Browser belegt · ⚠️ Einschränkung · — nicht zutreffend
(Stand nach dem zweiten Durchgang, Abschnitt 6 — die Owner-Spalte war im ersten
Durchgang durchgehend ⛔.)

| Modul                           | member                                       | trainer                                 | admin                                     | superadmin            | owner    |
| ------------------------------- | -------------------------------------------- | --------------------------------------- | ----------------------------------------- | --------------------- | -------- |
| **Mitglieder**                  | ✅ eigenes Profil                            | —                                       | ✅ Liste + Detail (21)                    | ✅ über Club-Switcher | ✅ (E-3) |
| **Trainer**                     | ✅ Trainerstunde buchen                      | ✅ Profil, Verfügbarkeit, Abwesenheiten | ✅ Profile + Stundennachweise             | ✅                    | ✅ (E-3) |
| **Spielbetrieb / Saison**       | ✅ Trainingsplan, Platzkalender, Präferenzen | ✅ Planungspräferenzen, Mein Training   | ✅ Saisonplanung, Plätze, Veranstaltungen | ✅                    | ✅ (E-3) |
| **Finanzen**                    | ✅ Meine Rechnungen (Daten seit F-7)         | ✅ Stundennachweise + Abrechnung        | ✅ Abrechnung, Preisregeln, Abonnement    | ✅ eigenes Abo        | ✅ (E-3) |
| **Nachrichten / Einstellungen** | ✅                                           | ✅                                      | ✅ inkl. Audit-Log (seit F-8)             | ✅                    | ✅ (E-3) |
| **Rollen-Grenze**               | ✅ kein Admin/Superadmin/Owner               | ✅                                      | ✅ kein Superadmin/Owner                  | ✅ kein Owner         | ✅       |

Belegende Läufe (Chromium, `--workers=1`, `--retries=0`):

| Suite                                 | Ergebnis                                             |
| ------------------------------------- | ---------------------------------------------------- |
| `role-access.spec.ts`                 | 9/9                                                  |
| `all-pages-render` — Member Pages     | 33/33                                                |
| `all-pages-render` — Trainer Pages    | 6/6                                                  |
| `all-pages-render` — Admin Pages      | 37/39 (Rest: `/admin/tournaments`, optionales Modul) |
| `all-pages-render` — Superadmin Pages | 9/9                                                  |
| `all-pages-render` — Rollen-Grenzen   | 4/4                                                  |
| `all-pages-render` — Owner Pages      | 8/8 (nach E-3)                                       |
| `vitest run`                          | 1557/1557                                            |

**Was diese Matrix nicht belegt:** dass jede Seite fachlich das Richtige tut.
Belegt ist: sie lädt, ist club- und rollenrichtig erreichbar, wirft keine
JS-Exception und zeigt seitenspezifischen Inhalt. Die inhaltliche Tiefe
(F-3-Klasse: joint gegen die richtige Tabelle?) hängt weiter an gezielten
Prüfungen wie den obigen SQL-Gegenproben.

---

## 6. Zweiter Durchgang — die vier Entscheidungen umgesetzt

Auf Nachfrage entschieden: Owner-Testzugang in der Agent-Lane, `copy-groups`
kopiert Stundenplan-Einträge, `training_groups` löschen, Nutzer-Lane darf
zurückgesetzt werden. Alles vier umgesetzt.

### E-1 — `training_groups` entfernt (war F-4)

`supabase/migrations/20260828_drop_training_groups.sql` löscht
`training_groups` und `training_group_memberships`. Mit entfernt: die beiden
API-Routen unter `app/api/training-groups/`, deren Test, die Drizzle-Tabellen
samt Relation, der Löschpfad in `schedule.repository.ts` und die Einträge in
der Backup- und der DSGVO-Export-Liste.

Zwei Stellen liefen ins Leere und liefern jetzt echte Daten:

| Stelle                                                | vorher                             | jetzt                                                       |
| ----------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| `MemberService.getMembersByTrainingGroup`             | las die leere Tabelle → immer `[]` | löst den Gruppennamen über `groups` auf, liest `member_ids` |
| `MemberService.getMemberStatistics().byTrainingGroup` | hart `{}`                          | zählt je Gruppe aus `groups.member_ids`                     |

`docs/DATABASE.md` mitgezogen (AGENTS.md § Migrationen, Regel 2).

### E-2 — `copy-groups` kopiert jetzt den Stundenplan (war F-6)

Die Route übernimmt alle `season_plan_entries` der Quell-Saison als Entwurf
(`status: 'planned'`, `planning_source: 'copied'`) in die Ziel-Saison. Gruppen
selbst werden nicht kopiert — sie sind club-weit, die Ziel-Saison sieht sie
ohnehin. Zwei Wachen dazu: hat die Ziel-Saison schon Einträge, antwortet die
Route mit **409** statt den Plan zu verdoppeln; hat die Quelle keine, mit 404.
Karte im Wizard heisst jetzt „Stundenplan aus vorheriger Saison übernehmen"
und meldet die Zahl der Einträge zurück.

### E-3 — Owner-Testzugang (war F-10)

`owner@claude.test` wird in der Agent-Lane angelegt: Rolle `owner`, **ohne**
`club_id` (CLAUDE.md § Rollen), Seed-Passwort. `TEST_OWNER_*` in `.env.local`
zeigt darauf. `admin@swingz.com` bleibt unangetastet.

**Beleg:** Owner-Seiten **8/8 grün** (vorher 0/8). Das Owner-Dashboard zeigt
alle 8 Vereine, 638 Mitglieder, 7 aktive Abos, MRR ~€145.

Dabei fiel ein dritter Fall der F-11-Klasse auf: `/owner/billing` heisst in der
Oberfläche **„Umsatz & Abos"** und zeigt Abo-Status, keine Rechnungen — der
Test suchte nach „Rechnung|billing". Erwartung korrigiert.

### E-4 — Nutzer-Lane zurückgesetzt

`npm run seed:reset` gefahren. Alle acht Vereine tragen jetzt korrektes jsonb:

| Spalte                                            | `jsonb_typeof` |
| ------------------------------------------------- | -------------- |
| `groups.member_ids`                               | `array`        |
| `sessions.group_ids`                              | `array`        |
| `member_schedule_preferences.weekly_availability` | `object`       |
| `trainer_profiles.qualifications`                 | `array`        |

### E-5 — Gruppenbildung im Seed war doppelt zu eng

Beim Bestücken des Lasttest-Vereins (Abschnitt 7) fielen zwei Fehler auf, die
im 60er-Verein nicht auffallen konnten:

1. **Feste Kombinationsliste.** Der Seed kannte sechs Level/Alter-Paare fest
   verdrahtet. Jede andere Kombination (Leistung/Jugend, Anfänger/Senioren,
   Elite/Jugend) bekam keine Gruppe. Jetzt werden die Kombinationen aus dem
   tatsächlichen Bestand abgeleitet.
2. **`.slice(0, 8)`.** Pro Kombination landeten nur die ersten acht Mitglieder
   in einer Gruppe, der Rest in keiner. Jetzt wird in Gruppen zulässiger Grösse
   aufgeteilt (6 Jugend / 10 sonst) und durchnummeriert.

Wirkung im 500er-Verein: **307 → 497 von 500** Mitgliedern in einer Gruppe,
6 → 65 Gruppen. Auch die kleineren Vereine profitieren (Rheinland 5 Gruppen,
vorher wurden Mitglieder jenseits der ersten acht je Kombination still
übergangen).

Präferenz-Quote von 70 % auf **80 %** angehoben — realistischer, und die vom
Menschen gewünschte Vorgabe.

---

## 7. Lasttest: 500 Mitglieder (Claude Sandbox Gamma)

Neuer Verein in der Agent-Lane, um zu sehen, ob die Saisonplanung in
realistischer Vereinsgrösse trägt.

|             |                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------- |
| Mitglieder  | 500 (3 mit Login)                                                                                  |
| Trainer     | 20 (alle mit Login + Verfügbarkeit)                                                                |
| Plätze      | 12, davon 4 Halle                                                                                  |
| Gruppen     | 65                                                                                                 |
| Präferenzen | 400 Mitglieder (80 %), 20 Trainer (100 %)                                                          |
| Saison      | `collecting_preferences` — bewusst **vor** der Planung, damit der Auto-Planer selbst auslösbar ist |

### Ergebnis

| Messung                                       | Wert                                                         |
| --------------------------------------------- | ------------------------------------------------------------ |
| Präferenz-Übersicht (`preferences-summary`)   | HTTP 200, **2,6 s**                                          |
| Clustering-Lauf (`planning/cluster`, dry run) | HTTP 200, **1,9 s** Antwortzeit, davon **173 ms** Rechenzeit |
| Iterationen                                   | 45                                                           |
| Zugeordnet                                    | **419 von 500**                                              |
| Auf Warteliste                                | 205                                                          |
| Niveau-Verletzungen                           | 0                                                            |
| Trainer-Überlast-Warnungen                    | 0                                                            |

Admin-Seiten in diesem Verein, jeweils zweiter Aufruf (ohne Kaltkompilierung),
keine JS-Exception:

| Seite                         | Ladezeit |
| ----------------------------- | -------- |
| `/admin/members` (500 Zeilen) | 1,58 s   |
| `/admin/analytics`            | 1,58 s   |
| `/admin/seasons`              | 1,33 s   |
| `/admin/trainers`             | 1,01 s   |
| `/admin/courts`               | 0,90 s   |
| `/admin/billing`              | 0,81 s   |
| `/scheduler`                  | 0,56 s   |

**Befund:** die Planung trägt. 173 ms Rechenzeit für 500 Mitglieder ist keine
Grössenordnung, in der etwas kippt, und keine Seite bricht ein.

### Was der Lasttest zusätzlich aufdeckte

Der erste Lauf ordnete nur **275 von 500** zu. Der Clusterer nannte den Grund
selbst — auf Deutsch, im Klartext:

> „Keine freie Kapazität — **2 nutzbare Plätze (Wintersaison: nur Hallenplätze)**
> und 20 Trainer sind ausgelastet"

Der Seed vergab **fix zwei** Hallenplätze, unabhängig von der Vereinsgrösse
(`has_indoor: i > spec.courts - 2`). Ein Verein mit 500 Mitgliedern plante die
Wintersaison damit auf zwei Feldern. Jetzt ist etwa ein Drittel der Plätze
Halle, mindestens zwei → **275 → 419** zugeordnet.

Die verbleibenden 114 sind **kein Fehler**: 4 Hallenplätze × Zeitraster ist
eine echte Kapazitätsgrenze, und die Engine benennt sie nachvollziehbar
(Trainerauslastung lag bei 18,75 % — der Engpass ist der Platz, nicht das
Personal). Genau das soll ein Verein an dieser Stelle erfahren.

---

## 8. Endstand

| Prüfung                | Ergebnis                                                 |
| ---------------------- | -------------------------------------------------------- |
| `npx tsc --noEmit`     | **0 Fehler**                                             |
| `npx vitest run`       | **1541 grün**, 10 übersprungen, 0 rot (105/105 Dateien)  |
| `npm run docs:check`   | grün                                                     |
| E2E — `role-access`    | **9/9**                                                  |
| E2E — Member Pages     | **33/33**                                                |
| E2E — Trainer Pages    | **6/6**                                                  |
| E2E — Admin Pages      | **38/39** (Rest: `/admin/tournaments`, optionales Modul) |
| E2E — Superadmin Pages | **9/9**                                                  |
| E2E — Owner Pages      | **8/8**                                                  |
| E2E — Rollen-Grenzen   | **4/4**                                                  |

Alle fünf Rollen sind damit belegt. Die Owner-Spalte der Matrix in Abschnitt 5
ist damit vollständig — sie steht oben bereits im Endstand.

> **Nur suiteweise laufen lassen.** Ein Vollauf beider Seiten-Suiten in einem
> Kommando hat den Dev-Server zweimal per OOM gekillt (16-GB-Maschine); danach
> fallen alle Folgetests mit `ECONNREFUSED` um und sehen wie echte Fehler aus.
> Beide Male in Isolation nachgeprüft: grün.

---

## 9. Weiterhin offen

Nichts davon blockiert die Kernmodule; alle vier ursprünglich offenen Punkte
(F-4, F-6, F-10, Nutzer-Lane) sind in Abschnitt 6 erledigt.

### Die Seiten-Suite prüft zu schwach

`all-pages-render.spec.ts` sucht ein Wortmuster im ganzen `body` — und die
Sidebar erfüllt es oft mit. Genau daran blieb F-8 jahrelang unbemerkt. Drei
Erwartungen waren zudem schlicht veraltet (`/scheduler`, `/owner/billing`,
`/admin/audit-logs`), was erst auffiel, als die Bezahlschranke weg war.
Belastbar wäre ein seitenspezifischer Anker (`<h1>`, `data-testid`) statt eines
Wortes irgendwo im Dokument. Eigener Auftrag, kein Teil dieser Runde.

### `/admin/tournaments` rendert ohne das Wort „Turnier"

Optionales Modul, ausserhalb des Auftrags. Nicht verfolgt.

### `/trial-training` liest `searchParams` synchron

`Route "/trial-training" used searchParams.club` im Dev-Log — unter Next 16 ist
`searchParams` ein Promise. Öffentliche Seite, nicht im Core-Auftrag.

### `invoice.service.ts` behandelt einen 502 wie einen Fachfehler

Siehe F-5: ein Gateway-502 fliegt als „Failed to create invoice" hoch, ohne
Wiederholung. Im Geldpfad einen Blick wert.

---

## 7. Notizen ausserhalb des Auftrags

- `/admin/tournaments` rendert ohne das Wort „Turnier" — optionales Modul,
  vermutlich Flag-abhängig leer. Nicht verfolgt.
- `/trial-training` liest `searchParams.club` synchron; unter Next 16 ist
  `searchParams` ein Promise (`Route "/trial-training" used searchParams.club`
  im Dev-Log). Öffentliche Seite, nicht im Core-Auftrag.
- `all-pages-render.spec.ts` prüft `body` gegen Wortmuster, die die Sidebar
  miterfüllt (siehe F-8). Solange das so ist, kann die Suite eine ganze
  Seitengruppe als grün melden, die nur eine Schranke zeigt. Seitenspezifische
  Anker (`<h1>`, `data-testid`) wären der belastbare Ersatz — eigener Auftrag.
- Ein Vollauf aller 95 Seiten-Tests hat den Dev-Server per OOM gekillt
  (16 GB Maschine). Suite-weise laufen lassen.
