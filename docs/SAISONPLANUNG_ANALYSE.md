# 🎾 Saisonplanung SwingZ — Vollständige Analyse

**Datum:** 2026-07-22  
**Analyst:** Codebuff AI (DeepSeek v4)  
**Umfang:** Gesamter Codebase-Durchlauf des Saisonplanungs-Features  

---

## 📋 Executive Summary

Die Saisonplanung in SwingZ hat eine **solide technische Basis** (Drizzle-ORM-Schema, Clustering-Engine, Conflict-Detector), aber weicht **massiv vom Design-Spec ab** und hat **gravierende funktionale Lücken** für den realen Einsatz in einem Tennisverein. Der Wizard ist in der aktuellen Form **nicht produktionsreif** — mehrere API-Endpoints sind kaputt, zentrale Workflow-Schritte fehlen, und die Publishing-Logik erzeugt fehlerhafte Sessions.

**Dringlichkeit:** 🔴 HOCH — Vor einem Launch muss der Wizard grundlegend überarbeitet werden.

---

## 1. Design-Spec vs. Implementierung — Gap-Analyse

### 1.1 Der Design-Spec (Soll-Zustand)

Das [Design-Dokument](./superpowers/specs/2026-05-19-season-planning-wizard-design.md) definiert einen **5-stufigen Wizard** mit diesen Schritten:

| Schritt | Name | Route | Kern-Feature |
|---------|------|-------|-------------|
| 1 | Einstellungen | `/wizard/preferences` | Saison-Parameter, Fristen, Court-Verfügbarkeiten |
| 2 | Gruppen konfigurieren | `/wizard/groups` | Trainingsgruppen CRUD, Trainer-Zuweisung |
| 3 | KI-Plan + Kanban | `/wizard/plan` | KI-Clustering + Drag&Drop-Kanban-Board |
| 4 | Rechnungen | `/wizard/billing` | Rechnungsvorschau & Generierung |
| 5 | Veröffentlichen | `/wizard/publish` | Checkliste, finale Bestätigung |

### 1.2 Die Implementierung (Ist-Zustand)

Der tatsächliche Wizard hat **6 Schritte** auf einer komplett anderen Route:

| Schritt | Name | Route | Tatsächliches Feature |
|---------|------|-------|----------------------|
| 1 | Mitglieder | `/planning` (client-state) | Mitglieder-Selektionstabelle |
| 2 | Präferenzen | `/planning` (client-state) | Read-only Präferenz-Übersicht |
| 3 | Trainer | `/planning` (client-state) | Read-only Trainer-Auslastung |
| 4 | Clustering | `/planning` (client-state) | KI-Clustering-Ergebnisse |
| 5 | Review | `/planning` (client-state) | Konflikt-Review |
| 6 | Bestätigung | `/planning` (client-state) | Bestätigung & Publish |

### 1.3 Gap-Matrix

| Feature | Design-Spec | Implementiert | Status |
|---------|------------|---------------|--------|
| Saison-Einstellungen (Fristen, Config) | ✅ Step 1 | ❌ | 🔴 Fehlt komplett |
| Gruppen-CRUD im Wizard | ✅ Step 2 | ❌ | 🔴 Fehlt komplett |
| Drag & Drop Kanban | ✅ Step 3 | ❌ | 🔴 Fehlt komplett |
| `@dnd-kit/core` Integration | ✅ Gefordert | ❌ | 🔴 Nicht installiert |
| Rechnungs-Vorschau | ✅ Step 4 | ❌ | 🔴 Fehlt komplett |
| Rechnungs-Generierung | ✅ Step 4 | ❌ | 🔴 Fehlt komplett |
| Checkliste vor Veröffentlichung | ✅ Step 5 | ❌ (nur Warnungen) | 🟡 Teilweise |
| KI-Clustering | ✅ Step 3 | ✅ Step 4 | 🟢 Vorhanden |
| Konflikt-Erkennung | ✅ Step 3 | ✅ Step 5 | 🟢 Vorhanden |
| Mitglieder-Auswahl | ❌ (nicht explizit) | ✅ Step 1 | 🟡 Nicht im Spec |
| Präferenz-Übersicht | ❌ (nicht explizit) | ✅ Step 2 | 🟡 Nicht im Spec |
| Trainer-Auslastung | ❌ (nicht explizit) | ✅ Step 3 | 🟡 Nicht im Spec |

---

## 2. Routing & Architektur — Design-Fehler

### 2.1 Falsches Routing

**Spec:** `app/(protected)/admin/seasons/[id]/wizard/[step]/page.tsx`  
**Ist:** `app/(protected)/admin/seasons/[id]/planning/planning-wizard-client.tsx`

Der Spec fordert **server-seitige Seiten pro Schritt** mit `planning_status` als Single Source of Truth. Die Implementierung nutzt einen **rein client-seitigen Wizard** mit `useReducer` — Schritte sind nicht direkt verlinkbar, kein Server-Rendering, kein Fortschritt bei Page-Reload.

### 2.2 Fehlende `planning_status`-Integration

Laut Spec soll `seasons.planning_status` den aktiven Schritt bestimmen:
- `draft` → Step 1
- `collecting_preferences` → Step 2  
- `manual_review` → Step 3
- `invoices_generated` → Step 4
- `published` → Step 5

**Realität:** `planningStatus` wird als Prop übergeben, aber **nicht verwendet**. Der Wizard nutzt stattdessen `maxReachedStep` im lokalen State — ein Page-Reload setzt alles zurück.

### 2.3 Stepper-Logik: 7 vs 6

```typescript
// lib/season-planning/types.ts
export const WizardStep = {
  MEMBER_SELECTION: 1,
  PREFERENCES_SUMMARY: 2,
  TRAINER_AVAILABILITY: 3,
  CLUSTERING: 4,
  ADMIN_REVIEW: 5,
  CONFIRMATION: 6,
  POST_PROCESSING: 7,  // ← Definiert, aber nirgends verwendet!
};
```

Im Client werden nur 6 Schritte gerendert (STEPS-Array). Schritt 7 `POST_PROCESSING` existiert im Typ aber nirgends sonst — toter Code.

---

## 3. API-Endpoints — Kritische Bugs

### 3.1 🚨 Konflikt-Route: GET/POST-Mismatch

**Wizard-Context** (`wizard-context.tsx:243`):
```typescript
const res = await fetch(
  `/api/seasons/${state.seasonId}/planning/conflicts`,
  { method: 'POST' }  // ← Sendet POST
);
```

**API-Route** (`conflicts/route.ts`):
```typescript
export async function GET(request: NextRequest, context: RouteContext) {
  // ← Exportiert NUR GET!
```

**Auswirkung:** Die Konflikt-Erkennung im Wizard **schlägt immer fehl** (405 Method Not Allowed). Schritt 5 ist kaputt.

### 3.2 🚨 Konflikt-PATCH: Route existiert nicht

**Conflict-Review** (`conflict-review.tsx`):
```typescript
await fetch(`/api/seasons/${state.seasonId}/planning/conflicts`, {
  method: 'PATCH',  // ← Sendet PATCH zum Lösen/Ignorieren
```

**API-Route:** Exportiert nur `GET`. Es gibt keinen PATCH-Handler.  
**Auswirkung:** "Lösen" und "Ignorieren" von Konflikten schlägt immer fehl.

### 3.3 🚨 Clustering: `dryRun` immer true

**Wizard-Context** (`wizard-context.tsx:216`):
```typescript
body: JSON.stringify({ seasonId: state.seasonId, dryRun }),
// dryRun = false parameter
```

**API-Route** (`cluster/route.ts`):
```typescript
const dryRun = body.dryRun !== false;  // ← Wenn undefined → true
```

Der Wizard ruft `runClustering()` ohne Parameter auf → `dryRun = false`. ABER: Der Body enthält `{ dryRun: false }`, was korrekt als `false` ausgewertet wird.

**Allerdings:** Wenn das Clustering beim Schritt-Wechsel zu Schritt 4 automatisch ausgeführt wird (was aktuell nicht der Fall ist — es gibt keinen Trigger), würde es bei jedem Wechsel neu clustern und alte Plan-Entries löschen. Das Verhalten ist unklar dokumentiert.

### 3.4 🚨 Confirm-Route: Fehlerhafte Session-Erstellung

```typescript
// confirm/route.ts:129
const [session] = await db.insert(sessions).values({
  schedule_id: '',  // ← LEERER STRING! schedule_id ist NOT NULL FK
  trainer_id: entry.trainer_id,
  group_ids: entry.group_id ? [entry.group_id] : [],
  week_number: 1,  // ← IMMER Woche 1
  timeslot_start: new Date(season.start_date),  // ← Start-DATUM statt Slot-Zeit
  timeslot_end: new Date(season.start_date),    // ← Gleiches Datum!
  court_id: entry.court_id,
  max_participants: entry.max_participants,
  notes: 'Erstellt durch Saisonplanung',
}).returning();
```

**Kritische Fehler:**
1. **`schedule_id: ''`** — Sollte ein gültiger UUID-String sein, ist NOT NULL FK. Wird zu DB-Fehler führen.
2. **`week_number: 1`** — Alle Sessions Woche 1, keine wöchentliche Wiederholung. Ein Tennistraining findet aber wöchentlich statt!
3. **`timeslot_start/end`** — Nimmt das `season.start_date` (z.B. "2026-04-01") ohne Uhrzeit. Der tatsächliche Wochentag und die Uhrzeit aus `entry.day_of_week` und `entry.start_time` werden komplett ignoriert.
4. **Keine echten recurring sessions** — Saisonplan-Einträge definieren `day_of_week` und `start_time`/`end_time`, aber es werden keine wiederkehrenden Sessions für jede Woche der Saison erstellt.

### 3.5 🚨 Members-Route: Kommentar vs. Realität

```typescript
// members/route.ts:1
// POST /api/seasons/[id]/planning/members/select
// Schritt 1: Select members for the season...
```

Tatsächlich exportiert die Route nur `GET`, nicht `POST`. Die Member-Selektion passiert rein client-seitig ohne Server-Persistierung.

### 3.6 🟡 Keine Preferences-Summary-Route gefunden

Der Wizard-Context Step 2 ruft:
```typescript
const res = await fetch(`/api/seasons/${state.seasonId}/planning/preferences-summary`);
```

Diese Route wurde in der Code-Suche nicht gefunden — sie könnte fehlen oder unter einem anderen Pfad existieren.

### 3.7 🟡 Daten-Trunkierung im Clustering-Response

```typescript
// cluster/route.ts:50
memberDetails: g.memberDetails.slice(0, 5),  // ← Nur 5 Members pro Gruppe!
```

Die API kürzt die Member-Details auf 5 pro Gruppe. Wenn eine Gruppe 12 Mitglieder hat, fehlen 7 im Response. Das ist ein Problem für die UI — die vollständigen Daten sind im DB-State, aber die UI sieht sie nicht.

---

## 4. Logik & Workflow — Analyse aus Vereinssicht

### 4.1 Der reale Saisonplanungs-Prozess im Tennisverein

Ein typischer Tennisverein (500+ Mitglieder, Sommer- und Wintersaison) durchläuft folgende Phasen:

| Phase | Realer Prozess | SwingZ-Abbildung |
|-------|---------------|-----------------|
| 1. Saison-Vorbereitung | Vorstand legt Termine, Budget, Platzkontingente fest | ❌ Kein "Einstellungen"-Step |
| 2. Trainer-Planung | Trainer-Verfügbarkeiten werden abgefragt | 🟡 Trainer-Daten nur read-only |
| 3. Mitglieder-Befragung | Mitglieder geben Präferenzen an (Zeit, Niveau, Wunschpartner) | 🟢 Existiert als separates Feature |
| 4. Gruppen-Bildung | Sportwart erstellt Gruppen manuell nach Niveau/Alter | ❌ Kein manuelles Editieren |
| 5. Zeitplan-Erstellung | Trainingstermine werden auf Courts und Trainer verteilt | 🟡 Clustering macht das, aber ohne manuelle Nachbearbeitung |
| 6. Konflikt-Lösung | Doppelbelegungen, Trainer-Überlastung manuell lösen | 🟡 Konflikte werden erkannt, aber PATCH ist kaputt |
| 7. Kommunikation | Mitglieder werden über ihre Gruppe informiert | ❌ Keine Benachrichtigungen |
| 8. Abrechnung | Rechnungen werden erstellt und verschickt | ❌ Kein Billing-Step |

### 4.2 Was im echten Verein problematisch ist

#### ❌ Keine manuelle Nachbearbeitung
Nach dem KI-Clustering MUSS ein Sportwart manuell nachjustieren können:
- Mitglieder zwischen Gruppen verschieben
- Trainer tauschen
- Zeitslots anpassen
- Sonderwünsche berücksichtigen ("Petra kann nur Donnerstag")

**Aktueller Stand:** Es gibt nur eine statische Anzeige des Cluster-Ergebnisses. Der Spec sah ein Drag&Drop-Kanban-Board vor — das fehlt komplett.

#### ❌ Keine "Was-wäre-wenn"-Szenarien
Vereine wollen oft Szenarien vergleichen:
- "Was passiert wenn wir 3 statt 4 Anfänger-Gruppen machen?"
- "Können wir Trainer X entlasten?"
- "Wie wirkt sich eine strengere Niveau-Trennung aus?"

**Aktuell:** Nur ein einziger Clustering-Durchlauf ohne Vergleichsmöglichkeit. `dryRun` existiert zwar als Konzept, ist aber nicht in der UI nutzbar.

#### ❌ Keine Iteration
Der Planungsprozess ist iterativ — Clustering → Review → Anpassen → Neu-Clustering.  
**Aktuell:** Lineare 1→2→3→4→5→6 Navigation ohne Zurückspringen zum Neu-Clustern nach Konflikt-Review.

#### ❌ Keine Trainer-Feedback-Integration
Die DB hat eine `trainer_feedback` Tabelle mit Level-Empfehlungen — diese werden beim Clustering verwendet. Aber es gibt keine UI, in der Admins das Feedback einsehen oder übersteuern können.

#### ❌ Keine Berücksichtigung von Schulferien
Schulferien (Bundesland-spezifisch) werden erst NACH der Bestätigung auf Sessions angewendet (`markHolidaySessions`), nicht während des Clusterings. Dabei sollten Ferien-Slots von vornherein als "kein Training" markiert sein.

---

## 5. UX-Probleme — Schritt für Schritt

### Schritt 1: Mitglieder-Selektion
| Problem | Schwere |
|---------|---------|
| Alle Mitglieder werden vorausgewählt — keine "Select relevant" Logik | 🟡 Medium |
| Keine Massenaktionen (z.B. "Alle Anfänger abwählen") | 🟡 Medium |
| `attendanceQuote` wird geladen aber nicht im Table angezeigt | 🟢 Low |
| Keine Sortierung nach Spalten | 🟡 Medium |
| Filter nur nach Level, nicht nach Warteliste/Anwesenheit | 🟡 Medium |

### Schritt 2: Präferenz-Übersicht
| Problem | Schwere |
|---------|---------|
| **Rein read-only** — Admin kann nichts tun | 🔴 High |
| Zeigt "Fehlende Präferenzen" aber keine Möglichkeit, Mitglieder zu erinnern | 🔴 High |
| Wunschpartner-Konflikte werden angezeigt, aber nicht aufgelöst | 🟡 Medium |
| Keine Export-Funktion für die Präferenz-Daten | 🟢 Low |

### Schritt 3: Trainer-Auslastung
| Problem | Schwere |
|---------|---------|
| **Rein read-only** — Keine Konfiguration möglich | 🔴 High |
| Trainer-Auslastung basiert auf aktuellen Zuweisungen, aber vor dem Clustering sind das 0 | 🔴 High |
| "Burnout-Warnungen" vor dem Clustering immer 0 — nutzlos | 🔴 High |
| Keine Möglichkeit, Trainer-Maximalstunden anzupassen | 🔴 High |

### Schritt 4: Clustering
| Problem | Schwere |
|---------|---------|
| Kein Button zum Auslösen — User muss warten/nichts passiert | 🔴 High |
| Zeigt nur max. 5 Mitglieder pro Gruppe | 🔴 High |
| Kein Drag & Drop zum manuellen Nachbearbeiten | 🔴 High |
| Keine visuelle Darstellung der Zeitachse (welche Gruppe wann wo) | 🟡 Medium |
| "Nicht zugewiesene Mitglieder" ohne "Warum?"-Details | 🟡 Medium |
| Kein "Neu clustern mit anderen Parametern" | 🔴 High |

### Schritt 5: Konflikt-Review
| Problem | Schwere |
|---------|---------|
| **PATCH-Endpoint existiert nicht** — Lösen/Ignorieren schlägt fehl | 🔴 Kritisch |
| Konflikte werden nicht in der DB persistiert | 🟡 Medium |
| Keine visuelle Hervorhebung der betroffenen Slots im Kalender | 🟡 Medium |
| Konflikt-Lösung ohne Undo | 🟢 Low |

### Schritt 6: Bestätigung
| Problem | Schwere |
|---------|---------|
| **Session-Erstellung ist kaputt** (s.o.) | 🔴 Kritisch |
| Keine Checkliste vor dem Publizieren | 🔴 High |
| `publishedSessionIds` wird mit `session_0`, `session_1` gefüllt — Fakedaten! | 🔴 High |
| Keine E-Mail-Benachrichtigungen (als "TBD" markiert) | 🔴 High |
| Audit-Trail (`season_planning_history`) nicht implementiert | 🟡 Medium |

---

## 6. Datenmodell-Inkonsistenzen

### 6.1 `groups` vs. `trainingGroups`
Beide Tabellen haben fast identische Struktur:
```
groups:            id, club_id, name, description, level, age_group, is_active, member_ids, created_at
trainingGroups:    id, schedule_id, name, level, age_group, is_active
```

`groups` ist club-bezogen, `trainingGroups` schedule-bezogen. Die doppelte Struktur ist verwirrend — das Clustering nutzt `groups`, aber die Session-Erstellung referenziert `schedules`, die mit `trainingGroups` verbunden sind. Diese Trennung wird nirgends sauber überbrückt.

### 6.2 `season_planning_history` — Tote Tabelle
Die Tabelle existiert mit vollem Schema (action_type, actor_id, algorithm_metrics, etc.) aber wird **nirgends beschrieben**. Im Confirm-Route steht nur:
```typescript
// TODO: Log to season planning audit history when table is available
```

### 6.3 `planning_conflicts` — Schema vs. In-Memory
Das DB-Schema hat eine `planning_conflicts` Tabelle, aber der `ConflictDetector` arbeitet rein In-Memory und persistiert keine Konflikte. Die Tabelle hat Felder wie `detected_at`, `resolution_action`, `resolved_by`, die nie befüllt werden.

### 6.4 `auto_plan_config` JSON — Zwei Config-Quellen
Es gibt zwei Config-Mechanismen:
1. `seasons.auto_plan_config` (JSONB am Season-Datensatz)
2. `season_planning_configs` (eigene Tabelle mit typisierten Spalten)

Die Clustering-Engine lädt Config aus `season_planning_configs`, ignoriert aber `seasons.auto_plan_config`. Der `PlanningConfigService` wiederum arbeitet nur mit `season_planning_configs`. Das ist eine potenzielle Quelle für inkonsistente Konfiguration.

---

## 7. Verbesserungs-Vorschläge

### 7.1 Sofort-Maßnahmen (Kritische Bugs)

1. **Conflicts-Route reparieren**: POST-Endpoint hinzufügen oder Wizard-Context auf GET umstellen
2. **Conflicts-PATCH implementieren**: Route für Lösen/Ignorieren von Konflikten
3. **Session-Erstellung fixen**: 
   - `schedule_id` korrekt setzen (Schedule für die Saison finden/erstellen)
   - `timeslot_start/end` aus `day_of_week` + `start_time` + `season.start_date` berechnen
   - Recurring Sessions für jede Woche der Saison erstellen
4. **`publishedSessionIds`-Fake entfernen**: Echte UUIDs aus der DB verwenden
5. **Clustering-Trunkierung entfernen**: Alle `memberDetails` zurückgeben, nicht nur 5

### 7.2 Workflow-Neuausrichtung

Den Wizard **gemäß Design-Spec** umbauen:

| Neuer Step | Alte Logik wiederverwenden |
|-----------|---------------------------|
| 1. Einstellungen | `PlanningConfigService` + `seasons.preferences_deadline` |
| 2. Gruppen | `trainingGroups` CRUD (existiert teilweise, s. `training-groups` API) |
| 3. KI-Plan + Kanban | `ClusteringEngine` + `@dnd-kit` Drag&Drop + `conflict-detector` |
| 4. Rechnungen | `fee_configurations` + neue `billing-preview`/`billing-generate` API |
| 5. Veröffentlichen | `confirm`-Route (nach Fix) + Checkliste |

### 7.3 Fehlende Features für echten Vereinsbetrieb

| Feature | Priorität | Aufwand |
|---------|-----------|---------|
| Drag & Drop Kanban (Mitglieder manuell verschieben) | 🔴 Hoch | Groß |
| E-Mail-Benachrichtigungen nach Publish | 🔴 Hoch | Mittel |
| Recurring Sessions (wöchentlich während der Saison) | 🔴 Hoch | Groß |
| Manuelle Nachbearbeitung von Gruppen | 🔴 Hoch | Mittel |
| Billing/Rechnungen im Wizard | 🟡 Mittel | Groß |
| "Was-wäre-wenn"-Vergleich von Clustering-Läufen | 🟡 Mittel | Mittel |
| Schulferien im Clustering berücksichtigen | 🟡 Mittel | Klein |
| Mitglieder an fehlende Präferenzen erinnern | 🟡 Mittel | Klein |
| Audit-Trail (`season_planning_history`) | 🟢 Niedrig | Mittel |
| Export-Funktion für den Plan | 🟢 Niedrig | Klein |
| Kalender-Ansicht des Plans | 🟢 Niedrig | Mittel |

### 7.4 UX-Verbesserungen

1. **Schritte 2+3 interaktiv machen**: Statt read-only sollten Admins Konfigurationen ändern können
2. **Fortschritts-Indikator**: `planning_status` aus der DB als Single Source of Truth
3. **Speichern & Fortsetzen**: Wizard-State in DB persistieren, nicht nur Client-State
4. **Clustering-Button**: Expliziten "Jetzt clustern"-Button statt Automatik
5. **Nach-Clustering manuelle Anpassungen**: Drag & Drop zwischen Gruppen
6. **Konflikt-Lösung mit visuellem Feedback**: Betroffene Slots im Plan markieren
7. **Checkliste vor Veröffentlichung**: "X Mitglieder ohne Gruppe", "Y Trainer überlastet", etc.
8. **Erfolgszustand**: Nach Publish echte Kennzahlen zeigen (Anzahl erstellter Sessions, Benachrichtigungen)

---

## 8. Technische Schulden

| Item | Beschreibung |
|------|-------------|
| Types doppelt | `lib/types/season-planning.ts` und `lib/season-planning/types.ts` — beide definieren ähnliche Types, teils redundant |
| `POST_PROCESSING` Step | Definiert (Wert 7) aber nicht implementiert |
| `maxReachedStep` vs. `planning_status` | Zwei parallele State-Quellen |
| Toter Code | `confirm/route.ts` convertiert `entries` zu `assignments` mit hartkodierten Dummy-Werten |
| In-Memory Konflikte | Conflict-Detector persistiert nichts in `planning_conflicts` Tabelle |
| Fehlende Error-Handles | Clustering-Engine hat kein Rollback bei DB-Fehlern nach partiellem Insert |
| Hardcoded Session-Dauer | `90 Minuten` ist hartkodiert (`hoursAssigned = sessions * 1.5`) |
| Fehlende Tests | Keine Unit-Tests für Clustering-Engine, Conflict-Detector oder Confirm-Logik gefunden |

---

## 9. Fazit

### Stärken
- 🟢 **DB-Schema** ist gut durchdacht und umfassend (Drizzle-ORM, saubere Relations)
- 🟢 **Clustering-Engine** implementiert echte Constraint-Optimierung (Hard/Soft Constraints, Niveau-Promotions, historische Daten)
- 🟢 **Conflict-Detector** hat 7 sinnvolle Konflikt-Typen
- 🟢 **Präferenz-System** (`user_training_preferences`) ist detailliert und flexibel
- 🟢 **Cross-Season-Analytics** (`season_statistics`, `trainer_feedback`) sind visionär

### Schwächen
- 🔴 **Design-Spec nicht umgesetzt** — Wizard weicht in fast allen Punkten ab
- 🔴 **Mehrere API-Endpoints kaputt** (Conflicts GET/POST-Mismatch, kein PATCH, Session-Erstellung)
- 🔴 **Publishing erzeugt inkorrekte Sessions** (`schedule_id: ''`, falsche Zeiten, keine Recurring-Sessions)
- 🔴 **Keine manuelle Nachbearbeitung** — kein Drag&Drop, kein Gruppen-Edit
- 🔴 **Fehlende Benachrichtigungen** — Mitglieder erfahren nichts von ihrer Gruppenzuteilung
- 🟡 **Read-only Schritte** (2+3) bieten keinen Mehrwert im Wizard-Kontext
- 🟡 **Kein Billing-Workflow** — Rechnungen müssen außerhalb des Wizards erstellt werden
- 🟡 **Daten-Inkonsistenzen** (doppelte Config-Quellen, ungenutzte Tabellen)

### Empfehlung

**Den Wizard nicht in diesem Zustand releasen.** Die kritischen Bugs in der Confirm-Route machen den gesamten Publishing-Prozess unbrauchbar. Die fehlende manuelle Nachbearbeitung (Drag & Drop Kanban) ist ein No-Go für echte Tennisvereine, die fast immer manuell nachjustieren müssen.

**Empfohlene Roadmap:**
1. **Woche 1:** Kritische API-Bugs fixen (Conflicts, Session-Erstellung)
2. **Woche 2-3:** Wizard auf Design-Spec umbauen (Einstellungen, Gruppen-CRUD)
3. **Woche 4-5:** Kanban-Board mit Drag & Drop implementieren
4. **Woche 6:** Billing-Step + Benachrichtigungen
5. **Woche 7:** Testing, Bugfixing, Go-Live

---

*Analyse erstellt durch vollständige Codebase-Durchsicht aller relevanten Dateien: Wizard-Client, Wizard-Context, 6 Step-Komponenten, Clustering-Engine, Conflict-Detector, 4 API-Routen, DB-Schema (schema.ts + season-planning-schema.ts), Type-Definitionen, Design-Spec-Dokument.*
