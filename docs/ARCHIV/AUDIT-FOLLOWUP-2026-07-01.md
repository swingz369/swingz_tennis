# SwingZ — Follow-up-Audit: Fehlerkategorien & offene Punkte

**Datum:** 2026-07-01
**Anlass:** Großer Fix-Batch (16 gemeldete Probleme über alle Rollen) — dieses Dokument
fasst die tatsächlich gefundenen Root Causes zusammen, leitet daraus wiederkehrende
Fehlermuster ab, und listet konkrete weitere Fundstellen, die auf dasselbe Muster
geprüft/gefixt werden sollten.

---

## Zusammenfassung: was in diesem Batch gefixt wurde

| #   | Problem                                                        | Root Cause                                                                                                                                                                                                                                                                                | Status                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Landingpage-Flash nach Login                                   | `app/page.tsx` ohne `dynamic='force-dynamic'`; Login-Redirect ging über `/` statt direkt `/dashboard`                                                                                                                                                                                     | ✅ gefixt                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2   | Admin-Dashboard zeigt Mitglieder/Trainer/Sessions doppelt      | `PremiumAdminHero` + `AdminKpiStrip` beide zeigen dieselben Zahlen                                                                                                                                                                                                                        | ✅ gefixt                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3   | Grüner Banner nur auf manchen Seiten                           | Kein einheitliches Header-Pattern                                                                                                                                                                                                                                                         | ✅ Zunächst fälschlich eine neue `AdminPageHeader`-Komponente gebaut, bevor die bereits existierende `components/ui/page-header.tsx` (`PageHeader`, bisher nur auf `decisions/page.tsx` verwendet) gefunden wurde — Duplikat wieder entfernt, auf `PageHeader` migriert. Jetzt auf **alle 29 Admin-Unterseiten** ausgerollt (Dashboard-Hauptseite + Superadmin-Dashboard bewusst ausgenommen, siehe unten). |
| 4   | Familienkonten: zu schmal, kein Anlegen/Verknüpfen             | Layout `max-w-3xl`, `POST`-Endpoint fehlte komplett                                                                                                                                                                                                                                       | ✅ gefixt                                                                                                                                                                                                                                                                                                                                                                                                   |
| 5   | Arbeitsdienste: Mitgliederauswahl leer                         | **RLS-Policy `users_select_admin` liest `users.role`, Spalte existiert nicht mehr** (Rollen leben jetzt in `user_club_memberships.role`) → Join gibt für alle Fremd-User `null` zurück                                                                                                    | ✅ gefixt (Service-Client)                                                                                                                                                                                                                                                                                                                                                                                  |
| 6   | Nachrichten: Empfängerauswahl kaputt                           | **Cross-Club-Datenleck**: `/api/members?active=true` ignorierte `clubId` komplett, zeigte Mitglieder aus allen 3 Vereinen gemischt; zusätzlich `firstName`/`lastName`-Mapping griff auf nicht-existente Spalten zu, Frontend erwartete ein `fullName`-Feld, das die API nie lieferte      | ✅ gefixt (3 Layer)                                                                                                                                                                                                                                                                                                                                                                                         |
| 7   | E-Mail-Kampagnen: "Nur Mitglieder"/"Nur Trainer" ohne Wirkung  | `targetGroup` wurde gegen eine `groups`-Tabelle nach `name` gesucht, die diese Werte nie enthält → 0 Treffer, nur "Alle" funktionierte. Zusätzlich GET ohne `club_id`-Filter (drittes Cross-Club-Leck)                                                                                    | ✅ gefixt + Einzelauswahl ergänzt                                                                                                                                                                                                                                                                                                                                                                           |
| 8   | Board-Beschlüsse: 2 Console-Errors, keine Mitgliederabstimmung | Unhandled Promise Rejections in `updateStatus`/`confirmCancel`; **`GET /api/decisions` behauptete "RLS filtert Members auf completed", aber der Service nutzt einen Service-Client (RLS greift nicht) — Members konnten `?status=draft` anfragen und unveröffentlichte Beschlüsse sehen** | ✅ gefixt + Voting-UI unter `/decisions`                                                                                                                                                                                                                                                                                                                                                                    |
| 9   | Live-Suche gefordert                                           | War bereits vollständig implementiert (`global-search.tsx`)                                                                                                                                                                                                                               | ℹ️ kein Codeänderung nötig                                                                                                                                                                                                                                                                                                                                                                                  |
| 10  | Wochenstundenplan überladen, KI-Button soll weg                | Tabellenansicht + Sessionliste ungetrennt                                                                                                                                                                                                                                                 | ✅ in Tabs getrennt, Button entfernt                                                                                                                                                                                                                                                                                                                                                                        |
| 11  | Platzverwaltung vs. Wochenstundenplan                          | Unterschiedliche Datenmodelle (courts vs. sessions)                                                                                                                                                                                                                                       | ℹ️ bewusst nicht zusammengelegt                                                                                                                                                                                                                                                                                                                                                                             |
| 12  | KI-Matchmaking nur bei Admin?                                  | War bereits als geteilte Seite `/matchmaking` für alle Rollen vorhanden                                                                                                                                                                                                                   | ℹ️ kein Codeänderung nötig                                                                                                                                                                                                                                                                                                                                                                                  |
| 13  | Abrechnung zeigt Rechnung zu früh als "fertig"                 | Datenmodell erstellt Season-Rechnungen bereits korrekt mit `status='draft'` (DB-Default), kein Auto-Versand                                                                                                                                                                               | ℹ️ **Konsolidierungs-Feature (mehrere Gebührenquellen → 1 Rechnung mit Review/manueller Anpassung) bewusst NICHT gebaut — eigene Session empfohlen (Geld-Feature, hohes Risiko)**                                                                                                                                                                                                                           |
| 14  | Abonnement zeigt 0 Mitglieder                                  | Falsche Tabelle (`club_members` statt `user_club_memberships`)                                                                                                                                                                                                                            | ✅ gefixt                                                                                                                                                                                                                                                                                                                                                                                                   |
| 15  | Dummy-Vereine löschen                                          | 81 Test-Fixture-Vereine aus E2E/Integration-Testläufen gefunden und gelöscht (Cascade über `hours_logs` musste manuell vorgezogen werden — fehlendes `ON DELETE CASCADE`)                                                                                                                 | ✅ erledigt, nur noch 3 echte Vereine                                                                                                                                                                                                                                                                                                                                                                       |
| 16  | Shop nur bei Admin sichtbar                                    | Backend/Member-Route existierte bereits, nur der Sidebar-Link fehlte                                                                                                                                                                                                                      | ✅ gefixt                                                                                                                                                                                                                                                                                                                                                                                                   |
| 17  | Auswertungen & Berichte kaputt                                 | `Promise.all`-Destructuring: 4 Queries in 3 Variablen gepackt → "Buchungen"-KPI zeigte tatsächlich die Trainer-Anzahl                                                                                                                                                                     | ✅ gefixt                                                                                                                                                                                                                                                                                                                                                                                                   |

---

## Fehlerkategorien (Muster über den ganzen Batch)

### Kategorie A: RLS-Policy verweist auf nicht mehr existierende Spalte

`get_user_role()` (Migration `004_enhanced_rls_policies.sql`) liest `users.role` —
diese Spalte wurde entfernt, als Rollen auf `user_club_memberships.role` umgestellt
wurden (5-Rollen-Hierarchie). Jede Seite/Route, die mit dem **RLS-scoped Client**
(`requireAdminClub()`'s `supabase`, oder `auth.supabase` in API-Routes) einen Join
`user_club_memberships → users(...)` für **fremde** User macht, bekommt für diese
Fremd-User `null` zurück — meist ohne sichtbaren Fehler, nur leere/fehlende Namen.

**Bereits gefixt:** Arbeitsdienste, Familienkonten, E-Mail-Kampagnen.

**Noch zu prüfen** (gefunden per Grep, gleiches Muster wahrscheinlich):

- `app/(protected)/admin/(gated)/page.tsx` (Admin-Dashboard — Aktivitäts-Feed zeigt bereits "Unbekannt" als Namen, siehe Screenshot dieser Session, sehr wahrscheinlich betroffen)
- `app/(protected)/admin/(gated)/leagues/[id]/page.tsx`
- `app/api/bookings/route.ts`
- `app/api/tournaments/[id]/draw/route.ts`
- `app/api/admin/bookings/route.ts`

**Empfohlener Fix pro Fundstelle:** RLS-Client durch `createServiceClient()` ersetzen
(Caller ist bereits durch `requireAdminClub()`/`verifyRole()` autorisiert), ODER
langfristig sauberer: die RLS-Policy selbst auf `user_club_memberships.role` umstellen
(neue Migration, Supabase-seitig — betrifft alle Tabellen, die auf `get_user_role()`
verweisen, nicht nur `users`).

### Kategorie B: Service-Client ohne club_id-Scoping (Cross-Club-Datenleck)

Sobald ein Service-Client verwendet wird (bypasst RLS by design), muss die
Club-Zugehörigkeit **im Code** geprüft werden — sonst sehen Admins/Mitglieder Daten
aus fremden Vereinen. Drei Instanzen in diesem Batch gefunden (alle gefixt):
`/api/members` (`active`+`search`-Branches), `/api/email-campaigns` (`GET`).

**Empfehlung:** Jede neue/bestehende Route, die `createServiceClient()` nutzt, sollte
per Code-Review-Checkliste auf ein explizites `.eq('club_id', ...)` geprüft werden —
das ist strukturell leicht zu vergessen, weil der Service-Client "einfach funktioniert"
auch ohne den Filter (kein Fehler, nur zu viele Daten).

### Kategorie C: Frontend/Backend-Vertragsbruch bei Feldnamen

Messaging erwartete `m.fullName`/`m.full_name`, die API lieferte `firstName`/
`lastName`. Kein TypeScript-Fehler, weil `any` im Response-Mapping verwendet wurde.
**Empfehlung:** An den API-Grenzen (insb. `/api/members`) einen gemeinsamen typisierten
Response-Typ exportieren und in allen Konsumenten importieren, statt `any`-gecastete
inline-Mappings mehrfach zu duplizieren.

### Kategorie D: Off-by-one bei `Promise.all`-Destructuring

Analytics-Seite: 4 Queries in ein 3-elementiges Array-Pattern destrukturiert. TypeScript
hat das nicht gefangen, weil die Tuple-Länge nicht streng typisiert war. Kein weiterer
Fund dieses exakten Musters in diesem Audit, aber generell ein Risiko bei jedem
`Promise.all([...])` mit mehr als 2-3 Elementen.

### Kategorie E: Features gebaut, aber nicht in Navigation/Notifications verdrahtet

Shop-Route existierte für Member, aber kein Sidebar-Link. Arbeitsdienst-Zuweisung
schreibt keine Notification. **Empfehlung:** Bei jedem neuen Feature-Merge prüfen:
(a) Sidebar-Link für alle relevanten Rollen vorhanden? (b) Löst die Aktion eine
Notification aus, falls ein anderer User informiert werden muss?

### Kategorie F: Kommentare, die Sicherheits-/Filterverhalten falsch behaupten

Mehrfach gefunden: Code-Kommentare wie "gefiltert durch RLS" oder "RLS enforced" an
Stellen, die tatsächlich einen Service-Client nutzen (kein RLS aktiv). Das hat in
diesem Batch mehrere reale Bugs verschleiert (Board-Beschlüsse, `/api/members`,
E-Mail-Kampagnen). **Empfehlung:** Solche Kommentare grundsätzlich misstrauisch prüfen
statt für bare Münze zu nehmen — sie spiegeln oft eine frühere Code-Version wider.

---

## Bewusst nicht umgesetzt (verschoben)

1. **Rechnungs-Konsolidierung (Punkt 13, Phase 7b):** Admin-getriggerte
   Zusammenführung aller offenen Gebühren (Saison + Mitgliedschaft + Ad-hoc) in eine
   Rechnung mit Review-/Validierungs-Screen und manueller Anpassung. Größtes offenes
   Einzelthema — verdient eine eigene Session mit dediziertem End-to-End-Test, da es
   Finanzdaten direkt betrifft.
2. **Nachrichten-Vorlagen (Punkt 6) & analog für E-Mail-Kampagnen:** Neue
   `message_templates`-Tabelle + CRUD-UI wurde nicht gebaut (nur die
   Empfängerauswahl-Bugs wurden gefixt). Eigenständiges, klar abgegrenztes Feature.
3. **`PageHeader`-Rollout:** In einer Folge-Iteration auf alle 29 Admin-Unterseiten
   ausgerollt (nachdem die zunächst gebaute `AdminPageHeader`-Duplikat-Komponente
   wieder entfernt und durch die bereits existierende `components/ui/page-header.tsx`
   ersetzt wurde). Bewusst ausgenommen: `admin/(gated)/page.tsx` (Haupt-Dashboard,
   behält `PremiumAdminHero` + `AdminInboxBanner` als eigenes Identity-Element) und
   `admin/(gated)/dashboard/page.tsx` (Superadmin-Dashboard, eigener
   `SuperadminDashboardClient` mit eigenem Look). `PageHeaderAction` wurde dabei um
   ein `disabled`-Feld erweitert (rückwärtskompatibel), da mind. eine Seite
   (Shop) einen deaktivierbaren Action-Button benötigte.
4. **Session-Card → Court-Kalender Cross-Link** (Punkt 11, "nice to have"): nicht
   umgesetzt, da nicht kernrelevant für die Trennung von Tabellen-/Listenansicht.

---

## Verifikation in dieser Session

- `npx tsc --noEmit` nach jeder Phase grün.
- Mehrere Bugs live im Browser reproduziert (Chrome DevTools MCP), bevor sie gefixt
  wurden: Login-Flash, Arbeitsdienst-Mitgliedersuche, Nachrichten-Empfängerliste.
- DB-Cleanup wurde vor jeder Löschung mit einer Read-only-Query gegen die echte
  Dev-DB verifiziert (nicht nur gegen Seed-Skripte geraten).
