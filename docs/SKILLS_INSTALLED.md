# Skills aus offenen Quellen — Installations-Report

> **Stand:** 2026-06-09
> **Installiert via:** `npx -y skills add <package>@<skill> -y` (projekt-lokal in `./.agents/skills/`)
> **Hinweis:** Der `-g` (global) Flag wird vom aktuellen `npx skills` CLI nicht unterstützt — alle Skills werden pro Projekt unter `./.agents/skills/<name>/` installiert.

---

## ✅ Erfolgreich installiert (1 / 5)

| Skill               | Quelle                    | Pfad                                |
| ------------------- | ------------------------- | ----------------------------------- |
| **stripe-webhooks** | `hookdeck/webhook-skills` | `./.agents/skills/stripe-webhooks/` |

- **Install-Command:** `npx -y skills add hookdeck/webhook-skills@stripe-webhooks -y`
- **Verifiziert:** `npx skills check` meldet `✓ Updated stripe-webhooks`
- **Trigger-Keywords:** stripe, webhook, payment, billing, subscription, invoice
- **Anwendungsbereich:** Idempotente Webhook-Handler, Stripe-Event-Typen, Retry-Strategien
- **Wartung:** Quelle ist vertrauenswürdig (Hookdeck = Webhook-Infrastruktur-Spezialist, 317 installs auf skills.sh)

---

## ❌ Fehlgeschlagen (4 / 5)

| Skill                         | Quelle                                         | Fehlerursache                                                                                                                                                                           |
| ----------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **drizzle-orm**               | `bobmatnyc/claude-mpm-skills`                  | `No matching skills found for: drizzle-orm` — Skill-Slug existiert nicht im Repo (nur `mcp-protocol-builder` ist verfügbar)                                                             |
| **playwright-cli**            | `microsoft/playwright-cli`                     | `PromptScript does not support global skill installation` — `-g` Flag vom CLI nicht unterstützt; **auch ohne -g nicht erfolgreich** (Repo enthält keine `SKILL.md`-kompatible Struktur) |
| **playwright-best-practices** | `currents-dev/playwright-best-practices-skill` | Gleich wie oben — `PromptScript does not support global skill installation`                                                                                                             |
| **vitest**                    | `bobmatnyc/claude-mpm-skills`                  | `No matching skills found for: vitest` — Skill-Slug existiert nicht im Repo                                                                                                             |

---

## 🔄 Empfohlene Alternativen

Falls die oben genannten Skills benötigt werden, gibt es 3 Ausweichoptionen:

### Option A: Manueller Clone (analog zu ECC-Setup)

```bash
# Drizzle ORM Patterns (vertrauenswürdige Quelle mit 1.5K installs)
git clone --depth 1 https://github.com/giuseppe-trisciuoglio/developer-kit.git ~/drizzle-source
ln -s ~/drizzle-source/skills/drizzle-orm-patterns ./.agents/skills/drizzle-orm-patterns

# Vitest (576 installs, bobmatnyc)
# HINWEIS: Der Skill heißt möglicherweise anders — liste erst alle verfügbaren Skills:
git clone --depth 1 https://github.com/bobmatnyc/claude-mpm-skills.git ~/bobmatnyc
ls ~/bobmatnyc/skills/  # alle verfügbaren Skills anzeigen
```

### Option B: skills.sh Browse-UI

Öffne **https://skills.sh/** und suche manuell nach:

- `drizzle` (5 Ergebnisse aufgelistet — siehe vorherige Recherche)
- `playwright` (6 Ergebnisse)
- `vitest` (5 Ergebnisse)

Wähle den Skill aus der Liste, kopiere den exakten Install-Command.

### Option C: Lokale Skills statt externe

Wir haben bereits **8 eigene SwingZ-spezifische Skills** in `.codebuff/skills/`:

| Skill                         | Domain                                                  |
| ----------------------------- | ------------------------------------------------------- |
| `swingz-clustering-algorithm` | Saisonplanung-Engine (ersetzt externes Drizzle-Pattern) |
| `swingz-stripe-webhook`       | Stripe (tiefer als hookdeck, da projektspezifisch)      |
| `swingz-drizzle-rls`          | Drizzle + RLS (deckt externe Drizzle-Skill ab)          |
| `swingz-conflict-detector`    | Saisonplanung-Konflikte                                 |
| `swingz-feature-flags`        | Feature-Flag-System                                     |
| `swingz-booking-flow`         | Booking-Status-Machine                                  |
| `swingz-rbac-permissions`     | Rollen + Permissions                                    |
| `swingz-pdf-invoice`          | PDF-Generierung                                         |

→ Die projektspezifischen Skills sind **präziser** als externe, da sie die konkreten Datei-Pfade, Gotchas und Konventionen von SwingZ kennen.

---

## 📊 Aktueller Skill-Stand

```
.codebuff/skills/     8 lokale Skills (SwingZ-spezifisch)
.agents/skills/       1 externer Skill (hookdeck/stripe-webhooks)
─────────────────────────────────────────────────────────────
Total:                9 Skills, davon 8 selbst-gewartet
```

**Empfehlung:** Behalte die 8 `.codebuff/skills/` als primäre Quelle. Externe Skills nur ergänzend installieren, wenn ein Domain-Bereich noch nicht abgedeckt ist.

---

## 🔧 Installations-Snippet für später

Falls du weitere externe Skills installieren willst:

```bash
# Im Projekt-Root:
npx -y skills add <github-user>/<repo>@<skill-slug> -y
# Beispiel:
npx -y skills add giuseppe-trisciuoglio/developer-kit@drizzle-orm-patterns -y

# Status checken:
npx -y skills check
npx -y skills list
```

Falls `-g` versehentlich verwendet wird: **Fehlermeldung ignorieren** — der `-y` Flag (ohne `-g`) installiert automatisch projekt-lokal.
