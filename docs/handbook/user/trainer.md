# Trainer — Trainer-Self-Service

> Wer bist du? Du bist Trainer:in in einem oder mehreren Vereinen. Du planst deine Verfügbarkeit, siehst deine Sessions, machst Hours-Log, schreibst Notizen zu deinen Schülern.

**Dashboard:** `/trainer` · **Rolle in Hierarchie:** Stufe 2 · **club_id:** gesetzt (mehrere möglich)

---

## 🎯 Was kannst du?

- **Verfügbarkeit** pflegen (Wochenplan, Sondertermine, Urlaub)
- **Sessions einsehen** an denen du Trainings gibst
- **RSVP-Status** deiner Schüler sehen
- **Anwesenheits-Check-in** (QR-Code am Platz)
- **Member-Notes** schreiben/lesen (DSGVO-Audit-pflichtig)
- **Hours-Log** führen (wenn Finance-Modul aktiv)
- **Trainer-Profil** mit Foto, Bio, Spezialisierung
- **Messaging** mit Members (1:1-Chat)

## 🖥 Dashboard — `/trainer`

Oben-Steps:

1. **Heute-Sessions** — Liste der heutigen Slots für dich
2. **Quick-Checkin** — QR-Scanner-Button
3. **Hours-Log-Widget** — Wieviele Stunden diese Woche schon erfasst?
4. **Open-RSVP** — Welche Schüler haben noch nicht geantwortet?

## 🧭 Pages (Trainer-Bereich)

### Availability & Sessions

| Page                     | Zweck                                          |
| ------------------------ | ---------------------------------------------- |
| `/trainer`               | Dashboard                                      |
| `/trainer/availability`  | Wochen-Verfügbarkeit: Wann kannst du generell? |
| `/trainer/absences`      | Sonder-Urlaub, Krankheit, Tag-für-Tag          |
| `/trainer/sessions`      | Alle deine Sessions (heute/Woche/Alle)         |
| `/trainer/sessions/[id]` | Session-Detail mit Anwesenheits-Liste          |
| `/trainer/qr-checkin`    | QR-Scanner (mobile-first)                      |
| `/trainer/rsvp-status`   | Offene RSVP list (Schüler fehlen Antwort)      |

### Member-Bezogen

| Page                                  | Zweck                                                |
| ------------------------------------- | ---------------------------------------------------- |
| `/trainer/notes/member/[memberId]`    | Persönliche Trainer-Notizen (DSGVO: nur du + Admin)  |
| `/trainer/feedback/member/[memberId]` | Strukturiertes Feedback (Niveau, Stärken, Schwächen) |
| `/trainer/messaging`                  | 1:1-Chat mit Members                                 |

### Profil & Karriere

| Page                  | Zweck                                                      |
| --------------------- | ---------------------------------------------------------- |
| `/trainer/profile`    | Eigene Biografie, Foto, Spezialisierung (DTB-Lizenz-Stufe) |
| `/trainer/hours-logs` | Wochen-/Monats-Stunden-Log                                 |
| `/trainer/billing`    | Dein eigener Abrechnungs-Status (falls abrechnungsfähig)   |

## ⚙ Häufige Aktionen

### 1. Wochen-Verfügbarkeit pflegen

UI: `/trainer/availability` → Wochenraster (Mo-So) → pro Tag Zeit-Slots markieren.

```
POST /api/trainers/[id]/availability { day_of_week, start_time, end_time }
```

Speicherung in `trainer_availabilities` (neue Variante) oder `trainer_availability` (Legacy → P2-Finding: konsolidieren).

### 2. Abwesenheit eintragen

UI: `/trainer/absences` → Neue Abwesenheit → Datum, Grund, Vertretung-Trainer.

```
POST /api/trainers/[id]/absences { from_date, to_date, reason, substitute_trainer_id? }
```

Auswirkung:

- Saison-Plan-Konflikte werden automatisch markiert
- Sessions in dem Zeitraum erhalten Status `cancelled` mit Notification
- Auto-Notify: Members der geplanten Sessions

### 3. Anwesenheits-Check-in

UI: `/trainer/qr-checkin` (mobile-optimiert) → QR-Scanner → Member-Liste blinkt

```
Pro Scan:
POST /api/attendance/qr-checkin { member_qr_token, session_id }

Effekt:
INSERT attendance_records { member_id, session_id, check_in_time: now() }
Notification → "X ist eingecheckt"
```

Mitglied sieht Check-in live in `/member/dashboard`.

### 4. Member-Notes schreiben

UI: `/trainer/notes/member/[id]` → Editor

```
INSERT trainer_member_notes { trainer_id, member_id, note, visibility: 'trainer-admin' }
```

⚠️ **DSGVO**: Notes werden in Wipe-Service (`anonymize.service.ts`) **NICHT** gelöscht (P0-Finding 6: WIPE_USER_COLUMNS deckt das nicht ab). Manuell löschen oder Wipe-Skript erweitern.

### 5. Hours-Log eintragen

UI: `/trainer/hours-logs` → Tabelle pro Tag → Submit

```
INSERT hours_logs { trainer_id, date, session_id, hours, rate_used }
```

Auswirkung: Trainer-Abrechnung (in `trainer_billing`) konsolidiert pro Monat → erscheint im `/trainer/billing`.

### 6. Trainer-Profil bearbeiten

UI: `/trainer/profile` → Form (Foto, Bio, Spezialisierung, DTB-Lizenz)

```
PATCH /api/trainers/[id] { bio, photo_url, specialization, dtb_license_level }
```

## 🤝 Zusammenspiel mit anderen Rollen

| Edge-Case                                              | Was passiert?                                   | Wie handelst du?                                       |
| ------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------ |
| Admin plant Saison, berücksichtigt deine Verfügbarkeit | Saison-Plan-Konflikt → du bekommst Notification | /trainer/sessions zeigt geplante Slots                 |
| Member hat offen RSVP                                  | Member erhält Reminder; du siehst Liste         | /trainer/rsvp-status                                   |
| Trainer-Kollege:in übernimmt deine Session             | substitute-Trainer-Mapping                      | Du siehst "nicht zuständig"-Status                     |
| Member verlässt Verein                                 | Notes bleiben sichtbar (DSGVO-Pflicht)          | /trainer/notes: nur historisch, keine neuen Notes mehr |
| Office-Flag-Audit                                      | Owner prüft alle Notes aller Trainer            | Du kannst deine Notes nicht löschen, aber editierbar   |

## ⚠️ Pflichten & Risiken

1. **DSGVO**: Member-Notes sollten **nie beleidigend oder unfaire Bewertungen** enthalten. Bei Lösch-Anfrage musst du Notes manuell schwärzen.
2. **QR-Checkin**: Sofort korrigieren, falls du den falschen QR-Code gescannt hast — `PATCH /api/attendance/[recordId]` mit `check_out_time`.
3. **Hours-Log**: Eintrag **vor Monatsende** machen, danach ist die Abrechnung gesperrt.
4. **Verfügbarkeit**: Immer aktuell halten, damit der Saison-Plan funktioniert.

## 🧪 Tests

`e2e/trainer-*.test.ts`:

- Verfügbarkeit anlegen → Admin nutzt sie im Saison-Plan
- QR-Checkin → Member sieht Status
- Member-Notes → Re-Read nach Logout

## 📚 Verwante Kapitel

- [`../user/admin.md`](./admin.md) — wie der Admin deine Arbeit koordiniert
- [`../user/member.md`](./member.md) — wie Members Sessions/RSVP aus deiner Sicht sehen
- [`dev/auth-rbac.md`](../dev/auth-rbac.md) — Trainer-Rolle im Auth-Layer
- [`dev/data-model.md`](../dev/data-model.md) — `trainer_availabilities`, `trainer_member_notes`, `hours_logs`
