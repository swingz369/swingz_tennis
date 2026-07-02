# Tutorial · Verfügbarkeit pflegen (Trainer)

> Komponente: [`components/trainer-availability-manager.tsx`](../../../../components/trainer-availability-manager.tsx) (Page: `/trainer/availability`)
> API: `GET/POST/DELETE /api/trainer/availability` · `GET /api/trainer-availability`

## Übersicht

Du pflegst deine **wöchentlichen Zeitfenster**, an denen du Trainings geben kannst. Die Planungs-Assistenten (Admin) sehen diese Slots und können darin Sessions einplanen.

## Navigation oben

### Monats-Zeile (gross)

```
[<]  Juli 2026  [>]
```

- `[<]` / `[>]` = vorheriger / nächster Monat. Sprung geht zur **ersten Woche** dieses Monats.
- `Heute` = Sprung zur aktuellen Woche (disabled, wenn schon dort).

### Wochen-Zeile

```
Heute [<]  6. – 12. Juli 2026  [>]
```

- `[<]` / `[>]` = ±7 Tage.
- Anzeige variiert: Wenn Start- und End-Woche im selben Monat liegen → „6. – 12. Juli 2026", sonst „30. Juni – 6. Juli 2026".

## Stunden-Kontext (oben rechts, falls Vertrag vorhanden)

Wenn die API `maxHoursPerWeek` zurückgibt:

- Badge zeigt **„X.Y Std eingetragen diese Woche · Vertrag: N Std/Woche"**.
- **Rot**, wenn `weeklyHours > maxHoursPerWeek` (mit Over-Limit-Anzeige „+Y.Y Std über Limit").

## Hauptbereich — Card pro Wochentag

Für jeden Tag (Montag … Sonntag, je nach Daten) eine Card mit:

### Preset-Chips (8 Stück je Tag)

Klickbare Zeitfenster á 1 Stunde: **08:00, 09:30, 11:00, 13:00, 14:30, 16:00, 17:30, 19:00**.

| Status      | Styling                              |
| ----------- | ------------------------------------ |
| Nicht aktiv | grau (`bg-muted`)                    |
| Aktiv       | brand-primary, weißer Text, Schatten |

**Klick = Toggle**: fügt 1-h-Fenster hinzu oder entfernt es (Anzeige aktualisiert sich sofort, **wirkt sich erst nach „Speichern" persistent aus**).

### Benutzerdefinierte Slots

Button **„+ Benutzerdefiniert"** (Plus-Icon rechts in Header) pro Tag:

- Erzeugt neue Zeile mit Default `08:00 – 10:00`.
- Zwei `type="time"` Inputs (von / bis), Mülleimer-Button (×) zum Löschen.
- Werden ebenfalls erst nach „Speichern" persistent.

## Speichern (Header rechts)

**„Speichern"**-Button (Save-Icon):

1. Lädt erst **alle existierenden Slots** für die aktuelle Woche per `GET` (`from=<weekstart>&to=<weekend>`).
2. Berechnet `existingKeys = Set("date|time|time")` — verhindert Doppel-Eintrag.
3. Berechnet `uiKeys` aus aktueller UI-Konfiguration.
4. **DELETE** für alle API-Slots, die nicht mehr in der UI vorkommen (DELETE vor POST, damit keine Slot-Konflikte entstehen). 409 (Slot ist gebucht) wird ignoriert.
5. **POST** für jeden UI-Slot, dessen Key noch nicht existiert (`{ date, start_time, end_time, notes: null }`).
6. Re-Fetch nur wenn etwas geändert wurde.

**Erwartung:** Grünes Banner „X gespeichert, Y bereits vorhanden, Z gelöscht ✓" (4 s Auto-Dismiss).
**Fehler-Banner:** Rot mit Liste der nicht-pflegbaren Slots (z. B. „Mo 08:00–09:00: Konflikt mit gebuchter Session").

## Bulk-Aktion: „Auf alle Wochen im Monat anwenden"

Button **„Auf alle Wochen im Monat anwenden"** (Copy-Icon, links neben Speichern):

### Was es macht

1. Sammelt alle Wochen (Montagsdaten), die im aktuellen Monat liegen (max. 6, je nach Monatsbeginn).
2. Für jede Woche (außer der aktuell sichtbaren):
   - GET existierende Keys.
   - POST jeden UI-Slot, dessen Key noch nicht existiert.
3. Live-Status: Banner zeigt „Woche 2/5 bearbeitet…" während Lauf.

**Ausgabe:** Banner mit Statistik (4 s Auto-Dismiss):

- „12 Slots erstellt, 4 bereits vorhanden ✓"
- oder „Alle Wochen im Monat bereits konfiguriert"
- oder „3 Fehler" (Details in `console.warn`).

## Edge-Cases

| Problem                                                        | Lösung                                                                                                                      |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Slot lässt sich nicht löschen                                  | Slot ist mit einer `session` verknüpft → DELETE bekommt 409, wird ignoriert. Trainings-Session erst auflösen, dann löschen. |
| Apply-to-Month überschreibt bestehende Slots in anderen Wochen | Nein — POST-Skip bei `existingKeys.has(key)`. Niemals destruktiv.                                                           |
| Stunden > Vertrag                                              | Rot-Badge zeigt Über-Limit. Slots werden trotzdem gespeichert — Admins entscheiden, ob Stundenlohn-Aufschlag greift.        |
| Falsche Woche angezeigt                                        | Klick auf „Heute" im Wochen-Selector → Reset auf aktuelle Woche.                                                            |
| Trainer-Profil fehlt                                           | API liefert 403/404 → Message-Banner: „Kein Trainer-Profil gefunden. Bitte wende dich an den Administrator."                |
| Felder werden nicht gespeichert                                | Netzwerk-Fehler oder 5xx → rotes Banner mit `data.error`. Erneut klicken.                                                   |
