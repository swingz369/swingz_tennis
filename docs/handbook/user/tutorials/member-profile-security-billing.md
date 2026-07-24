# Tutorial · Mein Profil, Sicherheit & Zahlungen (Mitglied)

> Komponente: [`components/member-profile.tsx`](../../../../components/member-profile.tsx) (Page: `/profile` o. ä.)
> Hooks: `useUserMember`, `useRouter`, `createClient()` (Supabase Browser)

Die Profil-Seite hat **3 Tabs**.

## Tab 1: „Profil"

### Schritt 1 — Header / Hero

Oben ein Hero-Streifen mit:

- Avatar (über `AvatarUpload`-Komponente, klickbar zum Ändern — Upload-Flow via Storage + `router.refresh()`).
- Voller Name als H1.
- E-Mail als Subtext.
- „Aktives Mitglied"-Badge rechts (Cap).

### Schritt 2 — Modus wechseln

Initial **Read-Only**: alle Felder zeigen nur Wert.
Klick auf **„Bearbeiten"** (Stift-Icon, oben rechts): schaltet alle Input-Felder auf `isEditing === true`. Ein gelber Banner mit Hinweis „Bearbeitungsmodus aktiv" wird eingeblendet.

### Schritt 3 — Felder ausfüllen / ändern

> Reihenfolge im HTML entspricht dem visuellen 2-Spalten-Grid. Alle Inputs sind `name`-getrieben.

| Feld                   | API-Name (`formData`) | Type     | Editierbar?                            |
| ---------------------- | --------------------- | -------- | -------------------------------------- |
| Vollständiger Name     | `fullName`            | text     | ✅                                     |
| E-Mail                 | `email`               | —        | ❌ (nur über Sicherheit-Tab änderbar!) |
| Telefon                | `phone`               | tel      | ✅                                     |
| Postleitzahl           | `postalCode`          | text     | ✅                                     |
| Straße + Hausnummer    | `address`             | text     | ✅                                     |
| Stadt                  | `city`                | text     | ✅                                     |
| DTB-Spielernummer      | `dtbId`               | text     | ✅                                     |
| Notfallkontakt Name    | `emergencyContact`    | text     | ✅                                     |
| Notfallkontakt Telefon | `emergencyPhone`      | tel      | ✅                                     |
| Über mich (Bio)        | `bio`                 | textarea | ✅                                     |

### Schritt 4 — Speichern oder Abbrechen

- **Speichern** (unten rechts, primary): `apiFetch('/api/user/member', { method:'PATCH', body:JSON.stringify(formData) })`. Toast „Profil erfolgreich aktualisiert" bei Erfolg, „Fehler beim Speichern" bei Fehler.
- **Abbrechen**: setzt `isEditing = false` und verwirft Buffer-Änderungen.

### Schritt 5 — DTB-Verlinkung (Sonderfall)

Wenn `dtbId` gesetzt: klickbarer Link auf `https://www.tennis.de/vereinsspielbetrieb/spieler/<dtbId>` öffnet in neuem Tab. Hinweis-Subtext „Wird für Ligaergebnisse auf tennis.de benötigt".

## Tab 2: „Zahlungen"

### SEPA-Lastschriftmandat-Card

Komponente fetcted beim Mount per `apiFetch('/api/sepa-mandates?active=true')`. Resultat ist eine Liste von Mandaten.

**Wenn aktives Mandat existiert:**

- Grüner Punkt + „Aktives Mandat"-Label
- Tabelle mit 3 Feldern (Monospace für Mandatsreferenz + IBAN):
  - Mandatsreferenz: `mandate_reference`
  - IBAN: maskiert (`****1234` — wird vom Server gefiltert, nicht im Client)
  - Unterschrieben am: `new Date(signature_date).toLocaleDateString('de-DE')`

**Wenn kein aktives Mandat:**

- Warning-Icon + Heading „Kein aktives SEPA-Mandat"
- Erklärung: „Du hast noch kein SEPA-Lastschriftmandat erteilt. Ein Mandat wird für die automatische Zahlungsabwicklung benötigt."
- Button „Mandat erteilen" (outline, mit FileText-Icon) — Klick startet Mandate-Erstellungs-Flow (Anbieter-seitig).

> ⚠️ **Hinweis**: Der Mandat-Erstellungs-Flow ist in dieser Komponente noch nicht implementiert (kein `onClick`-Handler am Button — Bestätigung manuell beim Support).

## Tab 3: „Sicherheit"

### 3.1 E-Mail-Adresse ändern

Karte „E-Mail-Adresse ändern" (Shield-Icon):

1. **Anzeige**: aktuelle E-Mail (read-only).
2. **Eingabe**: neue E-Mail in `Input` (Enter-Taste löst Speichern aus via `e.key === 'Enter'`).
3. **Bestätigungslink senden** (Primary-Button):
   - `supabase.auth.updateUser({ email: newEmail })`
   - Toast bei Erfolg: „Bestätigungslink an neue Adresse gesendet. Bitte E-Mail prüfen."
   - Die E-Mail-Änderung wird erst nach Bestätigung des Links aktiv.
4. Validierung: `newEmail.trim()` nicht leer + enthält `@`.

### 3.2 Zwei-Faktor-Authentifizierung (2FA / TOTP)

#### Status-Abfrage beim Mount

`supabase.auth.mfa.listFactors()` → sucht `verified`-Status in `totp[]` → wenn vorhanden, `mfaEnrolled = { id }`.

#### Variante A — 2FA noch nicht aktiv

- Badge „2FA ist nicht aktiv" (XCircle-Icon)
- Primary-Button „2FA einrichten":
  1. `supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'SwingZ' })`
  2. Erhält `data.id`, `data.totp.qr_code` (data-URL), `data.totp.secret`
  3. UI wechselt auf **„Verifying"**-Zustand

#### Variante B — Verifying (direkt nach Enroll)

- **QR-Code-Bild** wird angezeigt (data-URL in `<img>`, ca. 160×160 px).
- Alternative: manueller Secret-Code in Monospace (`{mfaSecret}`).
- **6-stelliges Code-Feld** (`inputMode="numeric"`, `maxLength=6`, Monospace-Font, Letter-Spacing, zentriert):
  - Tippen filtert automatisch auf Ziffern (`replace(/\D/g, '')`).
  - Enter-Taste löst `verifyTotp()` aus.
- Button **„Bestätigen"**: führt `supabase.auth.mfa.challengeAndVerify({ factorId, code })` aus.
- Bei Erfolg: `mfaEnrolled = { id }`, UI geht zurück zu IDLE, Toast „Zwei-Faktor-Authentifizierung aktiviert".
- Bei Fehler: Toast „Ungültiger Code — bitte erneut versuchen".

#### Variante C — 2FA aktiv

- Grünes Label „2FA ist aktiv" (CheckCircle-Icon).
- Danger-outline Button „2FA deaktivieren":
  - `supabase.auth.mfa.unenroll({ factorId })`
  - Bestätigungs-Toast, dann `mfaEnrolled = null`.

### 3.3 Konto löschen (Gefahrenzone)

- Rote Karte **„Gefahrenzone"** ganz unten auf der Seite (Border + Background `border-destructive/30`).
- Klick auf **„Konto löschen"** (Trash-Icon) → öffnet `<ConfirmDialog>` Modal:
  - Titel: „Konto wirklich löschen?"
  - Description: Anonymisierungs-Hinweis (DSGVO-konform).
  - Bestätigen → `fetch('/api/user/delete', { method: 'DELETE' })` → `router.push('/login')`.
- Achtung: Buchungs- und Abrechnungsdaten bleiben aus steuerrechtlichen Gründen (GoBD) erhalten; die `lib/services/anonymize.service.ts` anonymisiert die User-PII.

## Edge-Cases

| Problem                                    | Lösung                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| Avatar-Upload schlägt fehl                 | Toast zeigt Fehlertext — Größe/Typ prüfen (Server-side Constraints)            |
| 2FA Code wird abgelehnt                    | Zeit-Sync der Authenticator-App prüfen                                         |
| E-Mail-Änderung wird nicht aktiv           | Bestätigungs-Mail im Spam prüfen — Supabase schickt von `noreply@swingz.cloud` |
| SEPA-Mandat-Button tut nichts              | Feature-Workaround: bitte Support kontaktieren                                 |
| Klick auf „Konto löschen" ohne Bestätigung | ConfirmDialog ist Pflicht (Cancel-Button vorhanden)                            |
