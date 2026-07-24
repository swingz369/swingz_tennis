# Tutorial · Mitglieder & Plätze verwalten (Admin)

## A) Mitgliederliste `/admin/members`

> Page: [`app/(protected)/admin/(gated)/members/page.tsx`](<../../../../app/(protected)/admin/(gated)/members/page.tsx>) · Client: [`MembersTabs`](<../../../../app/(protected)/admin/(gated)/members/members-tabs.tsx>)

### Was wird geladen?

Server-Component führt **2 parallele DB-Queries** aus (`Promise.all`, Zeile 58 in `members/page.tsx`); die weiteren Schritte sind clientseitige Transform + Mapping, **keine** zusätzlichen DB-Roundtrips:

1. `user_club_memberships` paginiert (Default 25 pro Seite, `getPagination(params, 25)`), mit Filter:
   - `club_id = active club`
   - **Trainer & Superadmin sind ausgeschlossen** — `not('role', 'in', '(trainer,superadmin)')` o. ä. (siehe Code).
   - Optionale Suche (`?search=...`) matcht in `users.full_name` ODER `users.email` über `.or('full_name.ilike...', 'email.ilike...')`.
2. `users`-Details für die gefundenen `user_ids` (Name, E-Mail, Phone, Adresse, Stadt) — in derselben `Promise.all`-Runde.

**Clientseitige Schritte (in JS, kein zusätzlicher DB-Roundtrip):** 3. Mapping der gepaarten Rows zu `Member[]` (Name + Membership-Daten kombiniert). 4. Total-Count aus dem Paginiert-Header (oder separate `select count`-Query, implementation-dependent). 5. `PaginationMeta` via `buildPaginationMeta(page, 25, total)` aus `@/lib/pagination`.

> **Korrektur-Hinweis:** Eine frühere Fassung dieses Tutorials behauptete „5 parallele Queries" — das ist falsch. Es sind 2 DB-Roundtrips + 3 clientseitige Schritte.

### Tabs

`MembersTabs` enthält typischerweise Tabs:

- **Aktive** (Default) — `is_active = true`
- **Ehrenmitglieder** — `is_honorary = true` mit `honorary_since`
- **Suchergebnis** — falls `?q=...` Aktiv, Drill-Down-Detail
- Wahrscheinlich pro Tab: Filter/Inkl.-Planning-Toggle

### Suche

URL-Param `?search=Max` triggert:

- ILIKE-Suche in `users.full_name` und `users.email`.
- Limitiert auf 500 erste Treffer in `users`.
- Resultat-IDs werden auf `user_club_memberships.user_id IN (...)` gefiltert.

### Paginierung

Standard 25 Einträge pro Seite. URL-Params: `page=`, `limit=`. PaginationMeta aus `lib/pagination`.

### Detail-Ansicht

Klick auf einen Member → `/admin/members/{id}` (Page: [`members/[id]/page.tsx`](<../../../../app/(protected)/admin/(gated)/members/[id]/page.tsx>)).

Detail-Tabs typischerweise:

- **Stammdaten** — Name, Email, Adresse, Rollen
- **Invoices** (`members/[id]/invoices-tab.tsx`) — bisherige + offene Rechnungen
- **Preferences** (`members/[id]/preferences-tab.tsx`) — abgegebene Saison-Präferenzen
- **Aktionen** — Aktivieren/Deaktivieren, Ehrenmitglied markieren, Edit-Settings

## B) Court-Liste `/admin/courts`

> Page: [`app/(protected)/admin/(gated)/courts/page.tsx`](<../../../../app/(protected)/admin/(gated)/courts/page.tsx>) · Client: [`CourtsManageClient`](<../../../../app/(protected)/admin/(gated)/courts/manage/courts-manage-client.tsx>) · [weitere Client: `courts-page-client.tsx`](<../../../../app/(protected)/admin/(gated)/courts/courts-page-client.tsx>)

### Was wird geladen?

```ts
supabase.from('courts').select('*').eq('club_id', clubId).order('number', { ascending: true });
supabase.from('court_types').select('id, name, surface_type').eq('is_active', true).order('name');
```

Die `courts`-Tabelle enthält:

- `club_id`, `name`, `number` (nullable — daher `?.toString()`)
- `court_type_id` (Zuordnung zu court_types)
- `has_lighting`, `is_active`, `notes`

### Court-Management

Über `CourtsManageClient`:

#### Suche

Input-Feld sucht (case-insensitive) in `court.name` und `court.number` (String).

#### View-Toggle

List ↔ Grid (typische UI-Komponente).

#### Card pro Court

- Name + Nummer
- Court-Type (z. B. „Halle", „Sand")
- Surface-Badge („Sand", „Hart", „Teppich")
- Lighting-Icon wenn `has_lighting`
- Edit-Button öffnet Inline-Form vorgefüllt mit:
  ```
  { name: court.name, number: court.number?.toString() ?? '', courtTypeId: court.court_type_id, surface, hasLighting, isActive, notes }
  ```

#### Empty-States

- Wenn Liste leer UND Suche aktiv: Empty-Card mit Hinweis „Keine Plätze gefunden für '<query>'".
- Wenn Liste leer UND keine Suche: Branding-Empty-State mit CTA „+ Platz anlegen".

#### Inline-Form / Modal

Felder:

- Name (Pflicht)
- Nummer (optional, string-konvertiert)
- Court-Type-Select
- Has-Lighting-Checkbox
- Is-Active-Checkbox
- Notes (optional)

Submit → POST/PATCH/DELETE an `court`-Endpunkt.

## C) Court-Types `/admin/court-types`

Separate Sub-Route für **Platztypen** (z. B. „Halle", „Freiluft", „Tennis-Halle"):

- Eigene Tabelle `court_types` (`name`, `surface_type`, `is_active`)
- Wird in `courts.court_type_id` referenziert.

## Edge-Cases

| Problem                                     | Lösung                                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Mitglieder-Liste zeigt Trainer/Admins nicht | Bewusst — separate Sheets (Admin: `/admin/trainers`, Superadmin: `/superadmin/clubs`)                            |
| Suche liefert keine Treffer                 | DB hat keinen Match in `full_name` ODER `email` (ILIKE) — andere Schreibweise probieren                          |
| Court-Speichern schlägt fehl                | Wahrscheinlich Validation (`has_lighting` muss boolean sein, `number` darf fehlen aber wenn gesetzt dann string) |
| `courts.number` ist NULL                    | Code nutzt `court.number?.toString()` (defensiv) — Backend-Schema erlaubt NULL                                   |
| Ehrenmitglied-Badge                         | Officielle Ehrung: `is_honorary = true + honorary_since = YYYY-MM-DD` (DSGVO-Hinweis im Member-Detail)           |
| Paginierung über letzte Seite               | `PaginationMeta` signalisiert `last` page und disabled `>` Button                                                |
