# Spike: React 18 → 19 Migration

> **Sprint:** 4+ | **Aufwand:** 5–8 Tage (inklu. Testing) | **Prio:** Mittel  
> **Quelle:** [AUDIT-DEPS-2026-07-23.md](../ARCHIV/AUDIT-DEPS-2026-07-23.md) — Befund A3  
> **Status:** 🟡 Backlog

---

## Ausgangslage

Next.js 16 ist für React 19 ausgelegt. Das Projekt läuft aktuell auf React 18.3.1 — funktional stabil, aber mit wachsenden Nachteilen:

| Problem                                                       | Auswirkung                                             |
| ------------------------------------------------------------- | ------------------------------------------------------ |
| `eslint-config-next@16` setzt React-19-Lint-Regeln            | Falsche Signale, fehlende Warnungen für echte Probleme |
| Peer-Warning-Spam beim Build                                  | Verschleiert echte Warnungen im Log                    |
| Streaming/Server-Components-Optimierungen deaktiviert         | Schlechtere Performance als möglich                    |
| Kein Zugang zu `use()`, `useOptimistic()`, Server Actions 2.0 | Entwickler-Experience leidet                           |

### Aktuelle Versionen

```json
"react": "^18.3.1",
"react-dom": "^18.3.1",
"@types/react": "^18.3.31",
"@types/react-dom": "^18.3.7",
"next": "^16.2.11",
"eslint-config-next": "^16.2.11"
```

---

## Codebase-Analyse

### ✅ Keine großen Blocker gefunden

| Pattern                          | Vorkommen   | Migrationsaufwand                                                                                                                                                                                       |
| -------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `React.FC` / `React.VFC`         | **0** ✅    | Entfällt — wurde in 18 schon deprecated, nicht genutzt                                                                                                                                                  |
| `React.PropsWithChildren`        | **0** ✅    | Entfällt                                                                                                                                                                                                |
| `forwardRef`                     | **191+** ⚠️ | shadcn/ui-Komponenten in `components/ui/`. React 19 macht `ref` zum normalen Prop — `forwardRef` ist noch supported aber Types müssen ggf. angepasst werden                                             |
| `React.ReactNode` für children   | **166+** ⚠️ | Meist `{ children: React.ReactNode }` Pattern. In React 19 müssen children **explizit** deklariert werden (bisher implizit in `{}`). Da das Projekt sie bereits explizit deklariert, minimaler Aufwand. |
| `ReactDOM.render` / `createRoot` | **0** ✅    | Next.js managed das                                                                                                                                                                                     |

---

## Migrationsschritte

### 1. Abhängigkeiten aktualisieren

```bash
pnpm add react@^19 react-dom@^19
pnpm add -D @types/react@^19 @types/react-dom@^19
```

### 2. TypeScript-Fehler beheben

Die Hauptbaustelle sind die `forwardRef`-Typen in `components/ui/`. Beispiel:

```tsx
// Vorher (React 18) — forwardRef mit expliziten Ref-Types
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => { ... }
);

// Nachher (React 19) — ref wird als Prop deklariert
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => { ... }
  // Code bleibt IDENTISCH — forwardRef API ist unverändert
);
```

> ℹ️ `forwardRef` ist in React 19 **nicht deprecated**, nur die Typ-Inferenz hat sich verbessert. Bestehender Code kompiliert in der Regel ohne Änderungen.

### 3. `React.ReactNode`-Kinder

Das Projekt deklariert children bereits explizit (`{ children: React.ReactNode }`). React 19 macht das zum **Standard** — bestehender Code ist bereits kompatibel.

### 4. React 19 APIs prüfen (optional, Sprint 4+)

| API                | Nutzen im Projekt                                               |
| ------------------ | --------------------------------------------------------------- |
| `use()`            | Server Components: Daten direkt im Render lesen (statt `await`) |
| `useOptimistic()`  | Optimistic UI für Formulare (Member-Aktionen, RSVP)             |
| `useActionState()` | Server Actions mit Lade-/Fehlerzustand                          |
| `ref` als Prop     | Kann `forwardRef`-Wrapper in eigenen Komponenten ersetzen       |

### 5. Dependencies mit React-Peer-Dep prüfen

```bash
# Alle Pakete mit React-Peer-Dependency auflisten
pnpm ls --depth=0 2>/dev/null | grep -i react
```

Besonders kritisch:

- `@radix-ui/react-*` (15 Pakete) — alle unterstützen React 19 ✅
- `swagger-ui-react` — muss React-19-Kompatibilität prüfen
- `@react-email/components` — ohnehin deprecated, vorher ersetzen
- `@react-pdf/renderer` — Kompatibilität prüfen
- `@tiptap/react` — Kompatibilität prüfen

---

## Validierung

```bash
pnpm typecheck     # TypeScript — MUSS 0 Fehler haben
pnpm build         # Production-Build
pnpm test:run      # Unit-Tests
```

Manuelle Sichtprüfung:

- Alle Dashboards (admin, trainer, member, owner, superadmin)
- Formulare (Login, Registrierung, Profil, Settings)
- Kalender und Buchungen
- Dark Mode
- Responsive Breakpoints

---

## Rollback-Plan

```bash
# Schnelles Rollback falls kritische Fehler auftreten:
pnpm add react@^18.3.1 react-dom@^18.3.1
pnpm add -D @types/react@^18.3.31 @types/react-dom@^18.3.7
pnpm install
```

---

## Referenzen

- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [Next.js 16 + React 19](https://nextjs.org/docs/app/building-your-application/upgrading/version-16)
- [AUDIT-DEPS-2026-07-23.md](../ARCHIV/AUDIT-DEPS-2026-07-23.md) — Befund A3
