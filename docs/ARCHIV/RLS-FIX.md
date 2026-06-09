# RLS Policy Fix für user_club_memberships

## Problem

Die RLS Policy für `user_club_memberships` verursacht eine Endlosschleife (infinite recursion), was dazu führt, dass **keine Club-Mitgliedschaften gelesen werden können**. Daher sieht das Dashboard keine Clubs.

## Lösung

Die rekursive Policy entfernen und durch eine einfache Policy ersetzen: User können nur ihre eigenen Memberships sehen. Admin-Zugriff wird auf API-Ebene (Service Role) behandelt.

## Schritte

### 1. SQL in Supabase SQL Editor ausführen

1. Öffne das Supabase Dashboard: https://qeckztuzeymuwwtyoryi.supabase.co
2. Gehe zu **SQL Editor**
3. Klicke auf **New query**
4. Füge folgenden SQL-Code ein:

```sql
-- Schritt 1: Alle existierenden Policies für user_club_memberships löschen
DROP POLICY IF EXISTS "club_membership_access" ON user_club_memberships;
DROP POLICY IF EXISTS "user_club_memberships_access" ON user_club_memberships;
DROP POLICY IF EXISTS "user_club_memberships_access_own" ON user_club_memberships;
DROP POLICY IF EXISTS "user_club_memberships_access_admin" ON user_club_memberships;

-- Schritt 2: Einfache, nicht-rekursive Policy erstellen
CREATE POLICY "user_club_memberships_access_own" ON user_club_memberships
  FOR ALL USING (
    user_id = auth.uid()
  );
```

5. Klicke auf **Run** (oder Strg+Enter)

Erwartete Antwort: `Success. No rows returned` (mehrmals, einmal pro DROP) und dann `Success. No rows returned` für CREATE.

### 2. Deployment auslösen

Nach der Migration in der DB:

```bash
git push origin main
```

Das löst ein neues Vercel Deployment aus.

### 3. Testen

1. Öffne https://swingz.vercel.app
2. Logge dich als admin@swingz.com ein
3. Dashboard sollte jetzt den "Demo Tennis Club" anzeigen und KPIs laden

---

## Warum funktioniert das?

- Die alte Policy hatte einen Self-Join: `EXISTS (SELECT 1 FROM user_club_memberships m2 WHERE ...)`
- PostgreSQL erkennt das als rekursive Abhängigkeit und wirft Fehler `42P17`
- Die neue Policy prüft nur `user_id = auth.uid()` – keine Rekursion
- Admin-Zugriff auf alle Memberships wird über Service-Role-API-Routes realisiert (die RLS bypassen)

## Rollback

Falls Probleme auftreten, kann die alte Policy wiederhergestellt werden (aus `supabase/migrations/001_rls_policies.sql`).
