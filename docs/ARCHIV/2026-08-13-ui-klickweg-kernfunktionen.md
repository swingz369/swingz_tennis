# UI-Klickweg durch die Kernfunktionen — 2026-08-13

> Archiv-Snapshot, kein lebendes Dokument. Fortsetzung von `2026-08-13-nav-workflow-audit.md`,
> das den Durchlauf auf **API-Ebene** belegt hatte und die Bedienbarkeit offen ließ (dort „P1 —
> Bedienbarkeit noch ungeprüft"). Hier: derselbe Weg über die **Oberfläche**, headless Chromium
> (Playwright), Testverein `a1d8fd1b-21de-4519-b3ac-230dae980337`, Admin `admin@testverein.swingz.test`.

## Methode

Statt Selektoren zu raten (daran scheiterte der Vorlauf), liest jedes Skript zuerst ein
**Inventar der sichtbaren Bedienelemente** aus dem DOM (Inputs mit Label/Pflichtstatus, native
Selects samt Optionen, Buttons und Comboboxen) und klickt erst danach. Damit waren alle zuvor
„nicht belegten" Formulare in einem Anlauf erreichbar.

## Ergebnis: die zuvor offenen Nachweise

| Kernweg                                                    | Ergebnis                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Platz anlegen** (`/admin/courts`)                        | ✓ Über die Oberfläche angelegt („Centre Court", Nr. 1, Typ „Test (Hartplatz)"). Toast „Platz erfolgreich erstellt", Platz steht danach in der Liste.                                                                                                               |
| **Saison anlegen** (`/admin/seasons/new`)                  | ✓ Über die Klickstrecke (Liste → „Neue Saison") angelegt, danach automatische Weiterleitung in den Planungs-Wizard. Duplikatsprüfung greift mit deutscher Meldung („Für die Wintersaison 2026 existiert bereits eine Saison.").                                    |
| **Trainer einladen** (`/admin/trainers`)                   | ✓ Absende-Button ist bei leerem Formular **deaktiviert** (kein stilles Scheitern). Mit E-Mail: Trainer angelegt, erscheint in der Liste. Bei nicht zustellbarer E-Mail meldet die App das **ehrlich** und bietet den Einladungslink zum Kopieren an — vorbildlich. |
| **Preiskategorie anlegen** (`/admin/billing` → Kategorien) | ✓ Angelegt, Typ-Auswahl: Training / Mitgliedschaft / Platz / Sonstiges.                                                                                                                                                                                            |
| **Rechnungslauf** (`/admin/billing`)                       | ✓ Erstmals vollständig durchlaufen: Vorschau zeigt Gebühr, Betrag und Empfängerauswahl („1 von 1 Mitgliedern ausgewählt"), danach „1 Rechnung(en) für August 2026 erstellt".                                                                                       |
| **Mitglieder-CSV-Import**                                  | ✓ 2 von 3 Zeilen importiert, die dritte (kaputte E-Mail) korrekt als ungültig gemeldet: „Ungültige E-Mail: kaputt-ohne-at". Ergebniskarte zeigt Importiert/Übersprungen/Fehlgeschlagen/Ungültig.                                                                   |

Damit ist die Kette Verein → Plätze → Trainer → Mitglieder → Saison → Rechnung **über die
Oberfläche** belegt, nicht mehr nur über die Endpunkte.

## Behobene Befunde

| #   | Fund                                                                                          | Wirkung                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Ort                                                                          |
| --- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | „Kein Vereinszugang gefunden. Bitte neu anmelden." beim Anlegen einer Saison                  | Beim direkten Aufruf von `/admin/seasons/new` (Reload, Lesezeichen, neuer Tab) war die Club-Query noch nicht (oder nicht mehr) aufgelöst. Das Formular schob dem Nutzer daraufhin einen Anmeldefehler unter, obwohl die Sitzung gültig war — und blieb dauerhaft unbenutzbar. Jetzt wird die Query einmal nachgeholt; erst wenn auch das scheitert, erscheint eine ehrliche Meldung („Vereinsdaten konnten nicht geladen werden. Bitte Seite neu laden.").                       | `app/(protected)/admin/(gated)/seasons/new/page.tsx`                         |
| 2   | Banner „Keine aktive Mitgliedsgebühr konfiguriert" blieb nach dem Anlegen einer Gebühr stehen | Der Hinweis stammt vom Server; das Anlegen im Kategorien-Tab lief rein clientseitig. Der Admin legt die Gebühr an und liest weiter, es gebe keine. Nach Reload war der Banner weg — also veraltete Anzeige, keine falsche Prüfung. `router.refresh()` nach Anlegen/Ändern/Löschen.                                                                                                                                                                                               | `app/(protected)/admin/(gated)/billing/categories/fee-categories-client.tsx` |
| 3   | Denglisch: Absende-Button hieß „Season erstellen"                                             | Rest aus der im Vorlauf begonnenen Übersetzung.                                                                                                                                                                                                                                                                                                                                                                                                                                  | `app/(protected)/admin/(gated)/seasons/new/page.tsx`                         |
| 4   | Siez-Bruch im Rechnungsdialog („Erstellen Sie eine neue Rechnung…")                           | Die App duzt sonst durchgängig.                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `components/billing/create-invoice-dialog.tsx`                               |
| 5   | Abbruch durch den Aufrufer wurde als Timeout wiederholt                                       | `fetchWithTimeout` wiederholte nach einem `AbortError` mit demselben, bereits toten Signal und meldete am Ende einen „Request timeout" — für React Query ist ein Abbruch beim Unmount aber kein Fehler. Jetzt wird ein vom Aufrufer abgebrochener Request sofort durchgereicht. **Ehrlichkeit zum Befund:** eine A/B-Probe mit und ohne diese Änderung zeigte **keinen** Unterschied beim Symptom aus Fund 1 — die Änderung ist für sich richtig, war aber nicht dessen Ursache. | `lib/fetch-utils.ts`                                                         |

## Neue offene Punkte

### P2 — Informationsarchitektur: Mitglieder-Import liegt woanders als der Trainer-Import

Der **Trainer**-CSV-Import sitzt direkt in der Trainerliste (`/admin/trainers`, Button „CSV Import").
Der **Mitglieder**-CSV-Import ist von `/admin/members` aus **nicht erreichbar** — dort gibt es nur
„Export CSV". Er steckt in `/admin/settings` (`components/admin/member-import-dialog.tsx`, eingebunden
nur in `settings-client.tsx`). Ein Admin, der Mitglieder übernehmen will, sucht ihn in der
Mitgliederverwaltung. Vorschlag: denselben Dialog zusätzlich auf `/admin/members` einhängen.

### P2 — Widersprüchliche Aussage im Generieren-Dialog

Der Dialog „Rechnungen generieren" zeigte gleichzeitig den Warnhinweis „Keine aktive
Mitgliedsgebühr konfiguriert" **und** den aktiven Button „1 Rechnung erstellen". Entweder ist der
Lauf möglich — dann ist der Hinweis falsch — oder nicht, dann gehört der Button deaktiviert.

### P3 — Kleinigkeiten

- Der Empty State der Preiskategorien („Noch keine Kategorien angelegt.") erklärt im Gegensatz zum
  vorbildlichen Platz-Empty-State nicht, wozu Kategorien dienen.
- Die Mitglieder-/Trainer-Auswahl im Rechnungsdialog zeigt bei leerer Sucheingabe „Keine Ergebnisse
  für ‚"" statt der vorhandenen Mitglieder.
- `/admin/courts` zeigt „Platztypen verwalten · 0 Typen", obwohl die Typ-Auswahl im Formular einen
  Eintrag anbietet — die Zählung passt nicht zur Auswahl.

## Weiterhin offen (unverändert aus dem Vorlauf)

- **P0:** rohe SQL-/DB-Fehlertexte, die ungefiltert in die Antwort geschrieben werden.
- **P1:** E-Mail-Invite-Flow des Owners (braucht Postfachzugriff), Trainer-Verfügbarkeiten,
  Migration `20260701010000_widen_season_planning_history_action_type_check.sql` nie angewendet.
- **P2:** „Season" in weiteren Saison-Unterseiten, `/gamification` verschleiert einen 403,
  `/news` ohne eigenes Ziel.

## Betriebshinweis

Der erste Aufruf einer Seite nach einem Code-Wechsel kompiliert im Dev-Server und kann länger
dauern als der 15-Sekunden-Timeout von `fetchJSON`. Kurze Wartezeiten in Klick-Skripten erzeugen
dadurch Scheinbefunde — Fund 1 wurde deshalb zunächst falsch der Fetch-Schicht zugeschrieben.
Messungen an frisch geänderten Seiten immer zweimal laufen lassen.
