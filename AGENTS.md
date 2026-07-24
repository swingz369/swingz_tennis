# AGENTS.md — SwingZ

> Gilt für jeden KI-Agenten, der in diesem Repo arbeitet (Claude Code, Cursor, Codex, Copilot, ...).
> Vollständiger Projektkontext (Architektur, Rollen, Business Rules, Konventionen, DO-NOT-Liste): **`CLAUDE.md`** im Repo-Root — vor der ersten Änderung lesen.

Dieses Dokument ist die einzige Quelle für Doku-Governance-Regeln. Andere Agent-Config-Dateien (z. B. `CLAUDE.md`) verweisen hierher statt die Regeln zu duplizieren.

---

## Dokumentations-Regeln

Grund für diese Regeln: In `docs/` haben mehrere KI-Agenten unkoordiniert neue Dateien statt Updates an bestehenden erzeugt (`ROUTING.md`/`ROUTING2.md`, `DESIGN.md`/`DESIGN_KONZEPT.md`, sechs verschiedene `PROJEKTANALYSE*`-Varianten). Diese Regeln verhindern, dass das erneut passiert.

### 1. Zwei Kategorien, keine Mischformen

| Kategorie  | Beispiele                                                                                                             | Regel                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Lebend** | `docs/README.md`, `BUSINESS_RULES.md`, `CONTRIBUTING.md`, `HANDBOOK.md`, `ROUTING.md`, `DESIGN.md`, `STRIPE_SETUP.md` | Beschreibt den **Ist-Zustand**. Bei jeder relevanten Code-Änderung aktualisieren — nie eine Parallel-Datei danebenlegen. |
| **Archiv** | Audits, Analysen, Reports, Prompts an andere KIs                                                                      | Snapshot zu einem Zeitpunkt. Landet direkt in `docs/ARCHIV/`, danach **nie wieder editiert**.                            |

### 2. Vor dem Anlegen einer neuen `.md`

1. `docs/README.md` (Index) prüfen — gibt es zum Thema schon ein lebendes Dokument?
2. Wenn ja: **das bestehende Dokument updaten.** Kein `_v2`, `_KONZEPT`, `_NEU`, `2026-07-xx`-Suffix an einem sonst identischen Dateinamen.
3. Wenn nein und es sich um einen Ist-Zustand handelt: neues lebendes Dokument anlegen und in `docs/README.md` verlinken.
4. Wenn es ein einmaliges Ergebnis ist (Audit, Analyse, Testlauf, Deep-Dive): direkt nach `docs/ARCHIV/` mit Datum im Namen (`YYYY-MM-DD-thema.md`).

### 3. Architektur-Entscheidungen

ADRs kommen nach `docs/decisions/`, Namensschema `adr-NNN-slug.md` (fortlaufend, siehe `adr-007-schema-migrations-composite-pk.md`). Einmal gemergte ADRs werden nicht mehr geändert — Revisionen bekommen eine neue ADR, die auf die alte verweist.

### 4. Pflichtfelder in lebenden Dokumenten

Kopfzeile mit Verifikationsdatum, analog zu `CLAUDE.md`:

```markdown
> Zuletzt verifiziert: <Datum>
```

Ein Agent, der ein lebendes Dokument liest und dabei eine Abweichung vom Code feststellt, korrigiert das Dokument und aktualisiert das Datum — nicht kommentarlos ignorieren, nicht separat neu dokumentieren.

### 5. Generierte Artefakte

Dateien, die ein Build-/CI-Schritt erzeugt (SBOM, Coverage-Reports, Testprotokolle) sind kein Doku-Content. Sie gehören mit `.gitignore` behandelt oder klar als generiert markiert — nicht wie ein lebendes Dokument gepflegt.

---

## Konflikte

Widerspricht dieses Dokument `CLAUDE.md` (oder einer äquivalenten Config-Datei eines anderen Tools) in einer nicht-Doku-Frage, gilt `CLAUDE.md`. In Doku-Governance-Fragen gilt dieses Dokument.
