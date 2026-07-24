# SwingZ — Handoff für nächste KI-Session

> Zuletzt aktualisiert: 20. Juni 2026  
> Ziel dieser Datei: Du (die KI) weißt sofort was gerade läuft und was als nächstes zu tun ist.

---

## Kontext: Was ist SwingZ?

Tennis Club Management SaaS (Next.js 16, Supabase, Stripe, Vercel).  
Der Auftraggeber (Bart) baut das Produkt aktiv und will es **verkaufsbereit** machen — an echte Tennisvereine verkaufen.

**Produktion:** https://swingz.vercel.app  
**Deploy:** `vercel deploy --prod --yes` (GitHub-Push → BLOCKED wegen unverified commits → immer CLI nutzen)

---

## Hauptauftrag der nächsten Session

**Die App rund machen und verkaufsbereit** — das heißt konkret:

- Keine kaputten Seiten (404, 500, leere States ohne Erklärung)
- Sauberes Onboarding für neue Vereine
- Landing Page überzeugt und konvertiert
- Stripe Checkout funktioniert (Starter €29/Mo, Professional €79/Mo)
- E-Mail-Flows klappen durch
- Mobile-Ansicht sauber
- Keine JS-Konsolenfehler auf Hauptseiten

---

## Was diese Session gebaut wurde (deployed, Stand 20.06.2026)

1. **Clustering-Algorithmus** — Sort-and-Slice, Gruppen 1–6, `maxNiveauLevelSteps`
2. **Member-Präferenzen** — Max. 4 Zeitwünsche + max. 3 Wunschpartner (altersgruppen-gefiltert)
3. **Trainer-Stunden-Kontext** — Vertragsstunden-Bar mit Live-Zähler + Limit-Warnung
4. **Kalender-Wochenansicht** — Admin/Trainer direkt weekly view, kein Court-Gate mehr
5. **Warteliste** — Auto-Nachrücken bei Absage + Notification
6. **Probestunde → Mitglied** — 1-Klick-Konvertierung im Admin-Panel
7. **Turnierplanung** — Court-Block Typ "Vereinsturnier" + Broadcast an alle Mitglieder
8. **Absage-Workflow** — Session-Cancel → Notifications + E-Mail; Kalender zeigt rot
9. **Familienkonten** — Eltern↔Kind-Verknüpfung + Admin-Seite
10. **Fehlzeiten-Tracking** — Cron + Admin-Tab + Trainer-Benachrichtigung ab 3 no_shows
11. **Gruppen-Kontinuität** — "Gruppen aus Vorjahr übernehmen" auf Saison-Detailseite
12. **Trainer-Notizen** — Inline-Edit pro Mitglied, nur Trainer/Admin sichtbar
13. **Trainer-Planungspräferenzen** — `/trainer/planning-preferences` → schreibt in `user_training_preferences` für Clustering

---

## Prioritätsliste: Verkaufsbereitschaft

### P0 — Ohne das kein Verkauf

- [ ] **Onboarding end-to-end testen:** Neuer Verein → erster Admin-Login → Saison anlegen → Mitglieder einladen. Brüche? Fehler?
- [ ] **Stripe Checkout:** "Jetzt starten" → Checkout öffnet → Zahlung funktioniert
- [ ] **Landing Page** (`/` oder `/landing`): CTA klar, Preise sichtbar, überzeugend?
- [ ] **Trial-Training-Formular** (`/trial-training`): Submit → Bestätigungs-E-Mail?
- [ ] **E-Mail-Versand:** Passwort-Reset-Mail landet an? Willkommens-Mail nach Registrierung?

### P1 — Macht Eindruck bei Demo

- [ ] **Admin-Dashboard** (`/admin`): KPIs laden, keine 500er, leere States mit Hinweisen
- [ ] **Saisonplanung** Wizard Schritt 1–5 ohne Absturz durchklickbar, Clustering läuft durch
- [ ] **Member-App** (`/member`): Buchungen, Präferenzen, Trainer-Buchung — fehlerfrei
- [ ] **Mobile Navigation:** Bottom-Nav auf iOS/Android, Seiten scrollen korrekt
- [ ] **Dark Mode:** Alle neuen Komponenten auf Dark-Mode-Korrektheit prüfen
- [ ] **Datenschutz/Impressum** (`/datenschutz`, `/impressum`): Ausgefüllt oder klarer Placeholder?

### P2 — Nice-to-have für erste Demos

- [ ] **Demo-Vereinsdaten:** Testverein "TC Demo" mit realistischen Mitgliedern, Saison, Gruppen
- [ ] **Admin-Onboarding-Checklist:** "Erste Schritte" nach erstem Login
- [ ] **Preisseite:** Starter vs. Professional klar differenziert
- [ ] **Eltern-Member-UI:** Eltern können selbst Kinder verknüpfen (aktuell nur Admin)

---

## Bekannte Baustellen (sofort behebbar)

- **`CRON_SECRET`** ENV-Variable in Vercel noch nicht gesetzt → `/api/cron/check-absences` schlägt fehl
- **Warteliste-UI** nur auf `/bookings` — `/member/trainer-booking` noch nicht angepasst
- **`admin/members/family/page.tsx`** nutzt `useUserClub()` — Admin-Context läuft über Cookie (prüfen ob Club-ID korrekt kommt)
- **Weather-Broadcast** für normale Wetter-Sperren fehlt noch (nur Turniere haben Auto-Broadcast)
- **Trainer-Zeitüberlappung** im Clustering nicht validiert (Algorithmus liest Trainer-Präferenzen, prüft aber keine Überschneidungen mit Mitglied-Präferenzen)

---

## Architektur-Erinnerungen

```
proxy.ts              → Auth-Middleware (NICHT middleware.ts)
lib/auth.ts           → requireAuth() für Server Components
lib/api-auth.ts       → withApiAuth() + verifyRole() für API Routes
lib/admin-context.ts  → requireAdminClub() (Admin-Club via Cookie)
lib/cookies.ts        → ADMIN_CLUB_COOKIE
```

**Supabase Clients — richtige wählen:**

- Server/RLS: `createClient()` aus `@/lib/supabase/server`
- Service/kein RLS: `createServiceClient()` aus `@/lib/supabase/service` ← nur server-side!
- Browser: `createClient()` aus `@/lib/supabase/client`

**Logging:** `createLogger('modul')` aus `@/lib/logger` — niemals console.log  
**Client-Fetch:** `apiFetch` aus `@/lib/api-fetch` — niemals nacktes `fetch()` im Client  
**Vor Commit:** `npx tsc --noEmit` (0 Errors)  
**Deploy:** `vercel deploy --prod --yes`

---

## Test-Accounts

| E-Mail                       | Rolle      | Verein                       |
| ---------------------------- | ---------- | ---------------------------- |
| `admin@swingz.com`           | superadmin | Tennis Club Berlin + weitere |
| `admin@tc-rheinland.de`      | admin      | TC Rheinland e.V.            |
| `trainer.1@tc-rheinland.de`  | trainer    | TC Rheinland e.V.            |
| `mitglied.1@tc-rheinland.de` | member     | TC Rheinland e.V.            |

Passwörter: `TEST-CREDENTIALS.md` (nicht in Git)

---

## Stil-Präferenzen des Auftraggebers

- Direkte Umsetzung ohne lange Rückfragen
- Deutsche UI-Texte (konsequent überall)
- Parallel-Agenten für unabhängige Features nutzen
- Lieber mehrere kleine Commits als einen Mega-Commit
- shadcn/ui nutzen — keine eigenen Duplikate bauen
- `npx tsc --noEmit` vor jedem Commit
