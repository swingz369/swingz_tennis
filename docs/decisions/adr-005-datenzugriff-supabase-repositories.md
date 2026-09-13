# ADR-005: Datenzugriff über Supabase-Client in Repositories, nicht über Drizzle+RLS

- **Status:** akzeptiert
- **Datum:** 13. September 2026
- **Betrifft:** `docs/ARCHIV/2026-09-13-architektur-analyse-datenzugriff.md` § 5 (Zielbild, Optionsvergleich), `.dependency-cruiser.cjs` (setzt das Zielbild als Check um)
- **Verwandt:** [ADR-004](adr-004-netzzugang-vps.md) (öffentlicher Postgres-Port, dort als offener Endzustand markiert)

## Kontext

Die App hat zwei parallele Datenzugriffsschichten: ~85 Routes gehen über Drizzle direkt gegen
Postgres (Port 6543, ADR-004), ~86 über den Supabase-Service-Client (RLS umgangen), der Rest
gemischt oder über den RLS-pflichtigen Server-Client. Zwei Typquellen (`schema.ts` handgepflegt
neben generierten Supabase-Typen), keine einheitliche Fehlerabbildung, ein DI-Container
(`tsyringe`) für austauschbare Implementierungen, die nie ausgetauscht wurden. Details und
Zahlen: die Analyse oben, § 3–4.

Zielbild ist in beiden Optionen gleich (Analyse § 5.1): Routes dünn, Fachlogik in
`src/application/<domäne>`, Datenbankzugriff ausschliesslich über ein Repository pro Domäne,
Mandantentrennung durch RLS erzwungen statt durch Anwendungscode. Offen war nur der Weg dorthin.

## Entscheidung

**Option B: Supabase-Client in Repositories**, mit dem Nutzer-Token des Requests
(`getUserDb(auth)`), RLS greift automatisch. Datenbankzugriff ohne RLS
(`systemDb(reason)`) nur für eine begründete Whitelist (Cron, Stripe-Webhook,
Benachrichtigungen, Owner-Funktionen). Eine Typquelle: `supabase gen types` aus den
SQL-Migrationen: Domänen-Typen leiten sich davon ab, `schema.ts` und Drizzle werden am Ende
entfernt (Umsetzungsplan Phase 4).

Komplexe Abfragen und die 9 bestehenden Transaktionen werden zu SQL-Funktionen (`rpc`) — im
Schema existieren bereits 82 solcher Funktionen, das ist kein neues Muster.

## Verworfene Alternativen

**Option A: Drizzle mit RLS-Wrapper.** Technisch möglich (Drizzle unterstützt
`set_config('request.jwt.claims', …)` pro Transaktion) und würde die bestehenden
Drizzle-Repositories erhalten. Verworfen, weil sie ein Problem voraussetzt, das noch nicht
gelöst ist: eine nicht-öffentliche Postgres-Verbindung mit TLS am Pooler, die es nur mit App auf
dem VPS oder Managed Supabase gibt (ADR-004 lässt genau das offen). Zusätzlich bliebe
`schema.ts` eine zweite, handgepflegte Typquelle, jede Anfrage würde zur Transaktion (Latenz,
Pooler-Last bei Serverless-Aufrufen), und die grössere Hälfte des Codes (~157 Routes über den
Supabase-Client) müsste trotzdem umziehen. A wird die richtige Wahl, **wenn** unabhängig davon
feststeht, dass die App auf den VPS zieht oder auf Managed Supabase wechselt — das ist dann eine
eigene, vorgelagerte ADR.

## Konsequenzen

- Nach Abschluss des Umsetzungsplans (Analyse § 6, Phase 4) kann **Port 6543 geschlossen**
  werden — löst den in ADR-004 offen gelassenen Endzustand, ohne dass vorher eine
  Infrastrukturfrage (VPS-Umzug, Managed Supabase) entschieden werden muss.
- `drizzle-orm`, `postgres` und `src/infrastructure/persistence/` werden am Ende der Migration
  aus den Laufzeit-Abhängigkeiten entfernt (Phase 4). Bis dahin bleiben beide Zugriffswege
  parallel in Betrieb, das ist der Zweck der Phasenaufteilung (jede Phase einzeln mergebar).
- Sehr komplexe Abfragen (Clustering-Engine, Konfliktprüfung in der Saisonplanung) werden als
  SQL-Views/-Funktionen formuliert statt in typsicherem TypeScript — weniger "ORM-Komfort", dafür
  ein Weg, den ~60 % des Codes schon geht.
- Das Zielbild ist bereits als `dependency-cruiser`-Regel scharf (`domain-no-infrastructure`,
  `no-circular`) bzw. als Baseline-Warnung (`routes-no-direct-db-baseline`) hinterlegt — neue
  Verstöße gegen diese Entscheidung brechen den Commit ab (AGENTS.md § 3a).
