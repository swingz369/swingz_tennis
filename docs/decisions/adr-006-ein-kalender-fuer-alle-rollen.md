# ADR-006: Ein Kalender für alle Rollen

- **Status:** akzeptiert
- **Datum:** 17. September 2026
- **Betrifft:** `components/unified-court-calendar.tsx` (Basis), `components/calendar/CalendarShell.tsx` (gemeinsame Hülle), `app/(protected)/bookings/`, `app/(protected)/member/trainer-booking/`, `app/(protected)/scheduler/`
- **Grundlage:** `docs/ARCHIV/2026-09-17-ux-analyse-und-sanierungsprompt.md` § 1.4 / § 1.4a (Messung und Entscheidung), Phase 2 (Umsetzungsplan)

## Kontext

Am 17.09.2026 standen fünf voneinander unabhängige Datums-Raster im Code:

| Datei                                             | Zeilen | Zweck                       |
| ------------------------------------------------- | ------ | --------------------------- |
| `components/unified-court-calendar.tsx`           | 2684   | Platzkalender, 4 Ansichten  |
| `app/(protected)/bookings/page.tsx`               | 579    | Monatsraster zum Buchen     |
| `lib/season-planning/schedule-grid.tsx`           | 515    | Stundenplan-Raster          |
| `app/(protected)/member/trainer-booking/page.tsx` | 474    | Wochenraster Trainerstunden |
| `lib/season-planning/season-calendar-view.tsx`    | 409    | Gruppen × Wochen-Matrix     |

Eine gemeinsame Hülle (`components/calendar/CalendarShell.tsx`, 80 Zeilen) existierte bereits,
wurde aber von genau einem Wrapper benutzt. Die Routen-Konsolidierung war begonnen und liegen
geblieben: `/bookings-unified`, `/my-bookings`, `/courts`, `/courts/daily`, `/training-schedule`
und `/dashboard/bookings/new` waren bereits auf `redirect()` reduziert — aber `/bookings` und
`/scheduler` blieben zwei verschiedene, beide erreichbare Kalender. In
`app/(protected)/courts/daily/page.tsx` widersprachen sich Kommentar („lebt in `/bookings`")
und Code (leitet nach `/scheduler`).

Auslöser der Entscheidung war nicht ein Fehler, sondern ein Befund aus der Benutzung: Der
Auftraggeber konnte selbst nicht angeben, wofür welcher Kalender zuständig ist. Es gab keine
Aufgabenteilung, die man hätte erklären können — nur einen fertigen Kalender und einen
liegengebliebenen Vorgänger.

## Entscheidung

**SwingZ hat genau einen Kalender.** Er gilt für alle Rollen. In ihm werden die Trainings der
laufenden Saison angezeigt, freie Slots für freies Spielen gebucht, Platzsperren gesetzt und
Ad-hoc-Trainings angelegt. **Was sichtbar und bedienbar ist, entscheidet die Rolle des
angemeldeten Nutzers — nicht die Route.**

Basis ist `components/unified-court-calendar.tsx`, weil dort bereits implementiert ist:
Saisonplan-Overlay (`visiblePlanSlots`), Session-Buchung (`useCreateBooking`), Direktbuchung
freier Plätze (`POST /api/bookings/direct`), Platzsperren, Ad-hoc-Sessions und die
Rollenfilterung (`visibleSessions`).

Daraus folgt:

1. Das Monatsraster aus `/bookings` wird fünfter Ansichtsmodus (`month`) des einen Kalenders,
   samt dessen CSV-Export. Danach hat `/bookings` keinen eigenen Kalendercode mehr.
2. Die Trainerstunden-Buchung aus `/member/trainer-booking` wird eine weitere Slot-Quelle im
   selben Raster, visuell unterscheidbar. Die eigene Seite entfällt.
3. Es gibt **eine** Kalender-Route. Alle Altrouten leiten dorthin. Eine Einbettung als Tab im
   Admin-Bereich bleibt erlaubt — aber als dieselbe Komponente, nicht als zweiter Kalender.
4. Jedes weitere Datums-Raster setzt auf `components/calendar/CalendarShell.tsx` auf.

## Abgrenzung — was ausdrücklich kein Verstoß ist

Ohne diese Grenzen kippt die Regel ins Gegenteil und es wird Funktionierendes abgerissen:

- **`MyBookings` (280 Z.) und `MyGroups` (94 Z.) bleiben.** Beide enthalten null
  Datums-Raster-Code — es sind Listen. Eine Liste eigener Buchungen ist kein konkurrierender
  Kalender, sondern eine eigenständige Ansicht, die vom Kalender aus verlinkt wird.
- **Die beiden Saisonplanungs-Raster bleiben eigenständig.** `schedule-grid.tsx` und
  `season-calendar-view.tsx` **planen**, sie buchen nicht: Sie arbeiten auf Gruppen × Wochen
  und Stundenplan-Entwürfen, nicht auf Plätzen × Uhrzeiten. Sie setzen auf dieselbe
  `CalendarShell` auf, damit Navigation, Leerzustand und Mobilverhalten identisch sind —
  verschmelzen aber nicht mit dem Buchungskalender.

Die Trennlinie ist damit: **Wer Plätze und Zeiten zeigt, ist der eine Kalender. Wer Saisonen
entwirft, ist Planung.**

## Verworfene Alternativen

- **Zwei Kalender mit dokumentierter Aufgabenteilung** (z. B. `/bookings` für Mitglieder,
  `/scheduler` für Admins). Verworfen: Genau dieser Zustand bestand faktisch und war für den
  Auftraggeber nicht erklärbar. Rollenunterschiede gehören in die Rollenlogik einer Komponente,
  nicht in zwei Routen — sonst driften die beiden Fassungen auseinander, wie geschehen.
- **Einen neuen, sauberen Kalender bauen und beide alten ablösen.** Verworfen: Der vorhandene
  kann die Fachlogik bereits vollständig; ein Neubau würde Saisonplan-Overlay, Sperren,
  Wetter, Ad-hoc-Sessions und die sicherheitsrelevante Rollenfilterung erneut implementieren.
  Ein sechstes Raster ist die Ursache des Problems, nicht seine Lösung.
- **`/bookings` behalten und den Platzkalender darin einbetten.** Verworfen: Der Name sagt
  „buchen", der Inhalt kann auch sperren und planen. Eine ehrlich benannte Route (`/kalender`)
  ist für einen ehrenamtlichen Vorstand verständlicher.

## Konsequenzen

**Gut:** Ein Ort für alle Zeitfragen; Rollenlogik an einer einzigen, testbaren Stelle; die
Monatsansicht steht nach der Zusammenführung allen Rollen zur Verfügung, nicht nur Mitgliedern.

**Preis:** `unified-court-calendar.tsx` ist mit 2684 Zeilen bereits eine God-Komponente und
wird durch die Zusammenführung zunächst größer. Die Zerlegung (eine Datei je Ansichtsmodus,
Zustand in einen Hook, Rollenlogik isoliert, Zielgröße unter 400 Zeilen) ist deshalb **Teil
dieser Entscheidung**, nicht ein späterer Folgeschritt.

**Für künftige Arbeit verbindlich:** Bevor irgendwo ein Datums-Raster entsteht — auch ein
kleines — ist zu prüfen, ob es in den einen Kalender gehört. Ist es Planung im Sinne der
Abgrenzung oben, setzt es mindestens auf `CalendarShell` auf.
