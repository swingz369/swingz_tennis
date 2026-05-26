# Evaluierung: `persons`-Tabelle vs. `users`-Tabelle

**Datum:** 21.05.2026  
**Kontext:** Vergleich SwingZ ↔ TSOW & langfristige Architektur-Empfehlung

---

## Ist-Zustand

### SwingZ

- **`users`**-Tabelle enthält Authentifizierungsdaten (E-Mail) UND Profildaten (Name, Telefon, Adresse, Bio, Notfallkontakt, Geburtsdatum)
- **`user_club_memberships`** verknüpft User mit Clubs (Rolle, Status, Planung-Flag)
- Keine Trennung zwischen Person und Vereinsmitglied

### TSOW

- **`persons`**-Tabelle: enthält alle Personendaten (Name, Kontakt, Adresse, Geburtsdatum, Notfallkontakt)
- **`club_memberships`**: verknüpft Persons mit Clubs (Rolle, Status, Mitgliedsnummer)
- Klare Trennung: Eine Person kann mehrere Club-Mitgliedschaften haben

---

## Vergleich

| Aspekt                   | SwingZ (`users` + `user_club_memberships`)                     | TSOW (`persons` + `club_memberships`)             |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------------------- |
| **Datenmodell**          | Auth-User = Person. Profildaten direkt am User                 | Person entkoppelt von Auth. Profildaten an Person |
| **Multi-Club**           | ✅ `user_club_memberships` bereits als Join-Tabelle            | ✅ `club_memberships` als Join-Tabelle            |
| **Daten-Deduplizierung** | ❌ Bei Multi-Club: Profildaten liegen am User, keine Duplikate | ✅ Personendaten zentral, keine Duplikate         |
| **Auth-Unabhängigkeit**  | ❌ Person ohne Auth-Account nicht möglich (z.B. Kind)          | ✅ Person kann ohne Auth-Account existieren       |
| **Zugriffskontrolle**    | ❌ Profildaten-Update nur durch User selbst oder Admin         | ✅ Personen können von Admins verwaltet werden    |
| **Migration**            | N/A (aktuelles Modell)                                         | ❌ Würde Daten-Migration erfordern                |

---

## Bewertung: Braucht SwingZ eine `persons`-Tabelle?

### Pro-Argumente

1. **Kinder/Familien**: Eltern verwalten Kinder-Profile ohne separate Auth-Accounts
2. **Trainer als externe Personen**: Trainer könnten als Personen ohne User-Account existieren (nur für Planung)
3. **Datenintegrität**: Eine Person = ein Datensatz, unabhängig von Club-Mitgliedschaften
4. **Zukunftssicher**: Bei Multi-Club-Wachstum keine Daten-Duplizierung

### Contra-Argumente

1. **Kein aktueller Bedarf**: SwingZ ist aktuell single-club-orientiert
2. **Hohe Migration-Komplexität**: Alle `users`-Referenzen müssten auf `persons.id` umgestellt werden
3. **Auth-Kopplung**: Supabase Auth ist eng an `users.id` gekoppelt
4. **Über-Engineering**: Für den aktuellen Scope nicht notwendig

---

## Empfehlung

**🟡 Mittel — Für später evaluieren, nicht jetzt umsetzen**

Die `persons`-Tabelle ist ein **sinnvolles Architektur-Pattern** für Multi-Club-Szenarien und wenn nicht-authifizierte Personen benötigt werden (Kinder, externe Trainer).

**Aktuell ist der Aufwand für SwingZ nicht gerechtfertigt**, weil:

- Die `users` + `user_club_memberships`-Struktur funktioniert für den aktuellen Scope
- Kein konkreter Bedarf für auth-lose Personen besteht
- Die Migration wäre komplex und riskant

**Trigger für Re-Evaluierung:**

- Einführung von Kinder-/Familien-Accounts
- Multi-Club-Betrieb mit überschneidenden Mitgliedern
- Externe Trainer ohne eigenen Account
- DSGVO-Anforderung: Zentrale Personendaten-Verwaltung

---

## Implementierungs-Roadmap (falls später gewünscht)

1. **`persons`**-Tabelle erstellen (id, first_name, last_name, email, phone, address, date_of_birth, emergency_contact, created_at)
2. **Migration**: `users`-Profildaten → `persons` kopieren
3. **`user_club_memberships.person_id`** hinzufügen (FK → persons.id)
4. **API-Refactoring**: Member-Endpunkte über persons auflösen
5. **UI-Update**: Member-Formulare auf persons-Felder umstellen
6. **Cleanup**: Profildaten aus `users` entfernen (optional, breaking change)

**Geschätzter Aufwand:** 3–5 Tage
