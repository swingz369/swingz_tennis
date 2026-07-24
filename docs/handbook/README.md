# Handbuch — Pflege und Update-Disziplin

> Wie dieses Handbuch aktuell gehalten wird. Liest jeder Commit-Message-Editor und jeder Reviewer.

## 🎯 Ziel

Das Handbuch ist **single source of explanation**, aber **nicht** single source of truth.
Bei Code-Konflikten gewinnt der Code. Das Handbuch wird nachgezogen.

## 📂 Verzeichnisstruktur

```
docs/HANDBOOK.md                  ← Entry-Point, Rollen-Index, TOC
docs/handbook/README.md           ← DIESE DATEI — Pflege-Regeln
docs/handbook/glossary.md         ← Begriffswörterbuch
docs/handbook/dev/                ← Entwickler-Sicht (Architektur, Code, Patterns)
docs/handbook/user/               ← End-User-Sicht (Walkthroughs pro Rolle)
scripts/docs-autogen.ts           ← Auto-Gen-Skript (s.u.)
```

## ✅ Wann muss ich das Handbuch anfassen?

Diese Checkliste gehört in jede PR-Beschreibung, in der eines der folgenden Felder berührt wird:

| Code-Änderung an …                                     | Pflicht-Update in …                                                               |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Neue `/api/*/route.ts`                                 | `dev/api-reference.md` (oder beim nächsten `npm run docs:autogen` neu generieren) |
| Neue `app/(protected)/*/page.tsx`                      | `user/<rollenname>.md` Walkthrough                                                |
| Neue DB-Tabelle / Spalte                               | `dev/data-model.md`                                                               |
| Neuer Eintrag in `clubs.features`                      | `dev/feature-flags.md` **und** `HANDBOOK.md` Modul-Tabelle                        |
| Stripe-Webhook-Event                                   | `dev/stripe-integration.md` Webhook-Tabelle                                       |
| Cron-Route / Background-Job                            | `dev/background-jobs.md`                                                          |
| Neue `lib/*`-Helper                                    | jeweiliges `dev/<thema>.md` einordnen, ggf. Glossar ergänzen                      |
| Breaking Change an Rollen/Guards                       | `dev/auth-rbac.md` **und** ggf. `BUSINESS_RULES.md`                               |
| Glossar-Begriff in Tickets benutzt, aber nicht erklärt | `glossary.md`                                                                     |

**Faustformel:** Wenn ein neuer Entwickler nach deinem Commit fragen würde „Wie funktioniert X?" und die Antwort wäre nicht in 30 Sekunden im Handbuch auffindbar — der Commit ist ohne Doku-Update nicht mergeable.

## 🤖 Auto-Gen-Anteil: Was wird automatisch gepflegt?

Diese Kapitel sind Source-of-Code-generiert und sollten **nicht manuell editiert** werden (außer einleitende Sätze):

| Kapitel                | Quelle                                     | Befehl                 |
| ---------------------- | ------------------------------------------ | ---------------------- |
| `dev/data-model.md`    | `src/infrastructure/persistence/schema.ts` | `npm run docs:autogen` |
| `dev/api-reference.md` | `app/api/**/route.ts`                      | `npm run docs:autogen` |

Das Skript [`scripts/docs-autogen.ts`](../../scripts/docs-autogen.ts) parse-t die Verzeichnisstruktur und schreibt das Markdown neu. Es überschreibt nur die **Listen/Abschnitts-Header** und **lässt Hand-Edits am Anfang/Ende in Ruhe** (Marker-gestützt).

### Marker-Syntax für geschützte Bereiche

```markdown
<!-- AUTOGEN:BEGIN — Tabellen ab hier werden ersetzt -->

| … | … |

<!-- AUTOGEN:END -->

(Dieser Text bleibt erhalten.)

<!-- AUTOGEN:BEGIN api-routes — Inhalt wird ersetzt -->
<!-- AUTOGEN:END -->
```

Wer Hand-Edits innerhalb solcher Bereiche macht, verliert sie beim nächsten Auto-Gen-Lauf. Schreibe Edits **darüber oder darunter**.

## 🛠 Setup für Auto-Gen

```bash
# Skript ausführen — regeneriert data-model.md und api-reference.md
npm run docs:autogen

# Pre-Commit-Hook (optional, .lintstagedrc.js)
"docs:autogen": {
  "scripts/docs-autogen.ts": "tsx scripts/docs-autogen.ts"
}
```

Das Skript benötigt:

- `tsx` (bereits in Dev-Deps als `npm run dev`-Fallback)
- Filesystem-Read auf `app/api/**` und `src/infrastructure/persistence/schema.ts`
- Write-Target: `docs/handbook/dev/data-model.md` + `docs/handbook/dev/api-reference.md`

## 🧪 Review-Prozess

1. **Auto-Gen zuerst:** Vor dem Reviewer-Pass `npm run docs:autogen` laufen lassen, damit Listen aktuell sind.
2. **Inhaltliche Konsistenz:** Hand-edits dürfen Code-Wahrheit **nicht widersprechen**. Wenn die Datenbank-Spalte `clubs.features` heißt, aber das Handbuch sie `features` nennt → fix das Handbuch.
3. **Sprache:** Deutsch durchgängig. Englisch nur für Code-Keywords, Bibliotheksnamen und CLI-Befehle.
4. **Tonalität:** Direkt, ohne Füllwörter. Keine „einfach", „schnell", „super" — keine Sales-Pitch-Sprache.

## 🧭 Migration von Alt-Dokumenten

Das Handbuch **integriert**, nicht ersetzt diese Quellen direkt:

| Alte Quelle                                 | Status                                                    |
| ------------------------------------------- | --------------------------------------------------------- |
| `README.md`                                 | bleibt als Git-Standard-README (Setup, Quickstart)        |
| `PROJEKTANALYSE-KONSOLIDIERT-2026-07-01.md` | Audit-Dokument, bleibt für Sicherheits-/P0-Tracking       |
| `MARKTREIFE-AUDIT-2026-07-01.md`            | Audit-Dokument, bleibt für Marktreife                     |
| `DESIGN.md` / `DESIGN_KONZEPT.md`           | gehört in `dev/theming-design-tokens.md` migriert         |
| `ROUTING.md`                                | gehört in `dev/api-reference.md` (auto-gen)               |
| `STRIPE_SETUP.md`                           | gehört in `dev/stripe-integration.md`                     |
| `PROJEKT-AUDIT-2026-06-29.md`               | bleibt als historisches Audit                             |
| `PERFORMANCE_BENCHMARK.md`                  | gehört in `dev/testing-strategy.md` Abschnitt Performance |

Verlinkung statt Duplikation: Wenn der Inhalt relevant ist, **referenziere** ihn aus dem Handbuch und behalte das Original für Revisions-History.

## 🐛 Handbuch-Feedback

Fehler im Handbuch → GitHub-Issue mit Label `docs`. Vorschläge für neue Kapitel oder Walkthroughs → PR mit `docs:`-Prefix.

## 🤓 Contributing

Hand-Edits an `docs/handbook/**` folgen denselben Conventions wie Code:

- **Conventional Commit Prefix:** `docs:` (z. B. `docs(admin): add walkthrough for seasons-planning`)
- **TypeScript-strict-konform?** Ja, weil viele Code-Snippets getestet/typgeprüft werden müssen (das Skript ist strikt).
- **Reviewer:** Mindestens 1 Reviewer muss das betroffene Domain-Kapitel gegenchecken.
