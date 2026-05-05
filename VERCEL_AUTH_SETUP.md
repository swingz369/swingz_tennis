# 🔧 Supabase Auth auf Vercel konfigurieren

## Problem

Die 401-Fehler auf Vercel passieren, weil Supabase die Vercel-Domain nicht als erlaubte Redirect-URL kennt.

## Lösung: Supabase URLs konfigurieren

### 1. Gehe zur Supabase Console

https://supabase.com/dashboard/project/qeckztuzeymuwwtyoryi/auth/url-configuration

### 2. Füge folgende URLs hinzu:

#### Site URL:

```
https://swingz.vercel.app
```

#### Redirect URLs (füge jede einzeln hinzu):

```
https://swingz.vercel.app/auth/callback
https://swingz.vercel.app/**
http://localhost:3000/auth/callback
http://localhost:3000/**
```

### 3. Speichern und neu deployen

Nach dem Speichern sollte die Authentifizierung auf Vercel funktionieren.

## Test nach Konfiguration

1. Öffne: https://swingz.vercel.app/login
2. Logge dich ein mit: `admin@swingz.com` / `AdminPass123!`
3. Du solltest zum Dashboard weitergeleitet werden
4. Die 401-Fehler sollten verschwunden sein

## Alternative: Demo-Modus

Falls Supabase Auth nicht funktioniert, kannst du auch den Demo-Modus nutzen:

- Klicke auf "Als Demo-User einloggen" auf der Login-Seite
- Dies erstellt eine lokale Demo-Session ohne Supabase

## Warum ist das nötig?

Supabase Auth verwendet einen OAuth-Flow:

1. User gibt Credentials ein
2. Supabase schickt einen Auth-Code zurück
3. Dieser Code muss an `/auth/callback` zurückgeschickt werden
4. Supabase prüft, ob die Callback-URL erlaubt ist

Ohne die Vercel-URL in den erlaubten URLs lehnt Supabase den Callback ab → 401 Fehler

## Zusätzliche Vercel Environment Variables (falls noch nicht gesetzt)

In Vercel Dashboard (https://vercel.com/bartmz-3856s-projects/swingz/settings/environment-variables):

- `NEXT_PUBLIC_SUPABASE_URL`: https://qeckztuzeymuwwtyoryi.supabase.co
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (dein anon key)
- `SUPABASE_SERVICE_ROLE_KEY`: (dein service role key)
