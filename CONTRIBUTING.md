# Contributing Operational Rules

> **Supplement to `docs/README.md` § Contributing.** Where the README covers
> workflow and code-style, this file documents **operational rules** that
> Sprint-4 (TS-Baseline Pass) discovered the hard way.
>
> When these two documents disagree, this file is the source of truth for
> editing-tools and recovery-patterns; the README is the source of truth for
> workflow and commit-message format.

---

## 🔴 Rule 1: Never `sed -i` a TypeScript file

**Lesson from Sprint-4 (2026-06-27):** A `sed -i 's/...(/(_table) => [.../};,' drizzle/schema.ts`
wildcard pass silently matched **102 unrelated `gravis`-template callbacks** (the
`pgPolicy`, `pgIndex`, `foreignKey`, `unique` builders all share the
`() => [` arrow shape), destroying the entire schema file end-to-end. Recovery
required force-reverting via `rm + git checkout` and manually re-applying the
fix via Python.

### What to do instead

| Use case                                                    | Safe tool                                              | Why it survives                                                                                                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Single-anchor in-place edit in a known `.ts` file           | `str_replace` tool                                     | Anchored on surrounding context — cannot accidentally match unrelated occurrences.                                                                                                   |
| Rewrite a single file                                       | `write_file`                                           | TypeScript-validity checked at write time + diff-reviewable.                                                                                                                         |
| Multi-line edit where the anchor appears in multiple places | **Python heredoc** with a UNIQUE anchor                | Python `str.replace(old, new)` with the _unique_ anchor avoids sed's positional ambiguity. See `lib/season-planning/clustering-engine.ts` → `MergedPrefRow` widening for an example. |
| Bulk-edit across many files                                 | `regex_search` + per-file `str_replace`, one at a time | Each file's edit goes through the editor's anchor-match check.                                                                                                                       |

### When `sed -i` IS safe

- Shell scripts (`*.sh`) where the anchor is line-unique by construction.
- XML/HTML/Markdown where the surrounding context is structurally rigid.
- One-line `find ... -exec sed -i 's/foo/bar/g'` for literal-substitution of a token that doesn't appear in syntax-significant positions (variable renames inside strings, log-format changes, etc.).
- When you'd be willing to `git checkout HEAD --` anyway because the diff is trivially re-doable from a known-good state.

### Diagnostic if you accidentally ran a bad sed

Real example: a Sprint-4 session accidentally ran
`sed -i 's/...(/(_table) => [/};,' drizzle/schema.ts` and the wildcard match
destroyed 102 unrelated `pgPolicy`-template callbacks. Recovery:

```bash
# 1. Confirm damage: how many new TS errors?
TSC=$(timeout 200 npx tsc --noEmit 2>&1)
echo "$TSC" | grep -c 'error TS'
# (If error count jumped from 0 to 100+, sed is the culprit.)

# 2. Force-revert drizzle/schema.ts (note: rm + checkout is more aggressive
#    than `git checkout --` and works on dirty files)
rm -f drizzle/schema.ts
git checkout HEAD -- drizzle/schema.ts
[ -f drizzle/schema.ts ] && echo "✓ Restored" || echo "✗ FAILED"

# 3. Re-apply the original intent via Python heredoc with a UNIQUE anchor
#    (the unique anchor is the ONLY multi-line `pgPolicy(...)` line — sed's
#    wildcard could not have matched broadly because the policy NAME is unique)
#    ★ Replace `...` placeholders below with the ACTUAL line content from your file
#      before running. The Python str.replace() must match exactly, including
#      whitespace and any trailing characters.
cat > /tmp/schema-fix.py <<'PYEOF'
with open('drizzle/schema.ts', 'r') as f: content = f.read()
old = '}, (table) => [\n\tpgPolicy("owner can read access requests", <PASTE_ACTUAL_TAIL_HERE>)'
new = '}, (table) => {\n\tvoid table;\n\treturn [\n\t\tpgPolicy("owner can read access requests", <PASTE_ACTUAL_TAIL_HERE>),\n\t];\n});'
with open('drizzle/schema.ts', 'w') as f: f.write(content.replace(old, new))
PYEOF
python3 /tmp/schema-fix.py

# 4. Re-typecheck to confirm 0 (or back-to-baseline) errors.
npx tsc --noEmit 2>&1 | grep -c 'error TS'
```

---

### 🔴 Rule 1.1: No `sed -i` on configuration files (`.yml`, `.yaml`, `.json`)

Same reasoning as Rule 1, but for **CI/tool configuration files** where sed cannot reason about indentation or key scope:

| File pattern              | Safe tool                        | Why                                                                                                          |
| ------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `.github/workflows/*.yml` | `write_file` (recreate workflow) | YAML has nested-key semantics — sed matches all `timeout: 15` entries regardless of which job they belong to |
| `vercel.json`             | `jq` (round-trip JSON)           | Preserves key ordering; `jq` understands JSON structure                                                      |
| `.lighthouserc.json`      | `jq` or Python `json`            | Same as vercel.json                                                                                          |
| `package.json`            | `npm pkg set <key>=<value>`      | Schema-aware editor; avoids touching unrelated keys                                                          |

**Recovery example** (sed disaster on YAML):

```bash
# 1. Confirm damage
yamllint .github/workflows/*.yml 2>&1 || true

# 2. Restore from git
git checkout HEAD -- .github/workflows/

# 3. Re-apply intent via Python with structure-aware round-trip
python3 <<'PYEOF'
import yaml
for f in ['.github/workflows/bundle-analyzer.yml']:
    with open(f) as fh: doc = yaml.safe_load(fh)
    # Apply semantic edits here, e.g.:
    # doc['jobs']['analyze']['timeout-minutes'] = 30
    with open(f, 'w') as fh: yaml.safe_dump(doc, fh, default_flow_style=False)
PYEOF
```

---

## 🟡 Rule 2: Drizzle `schema.ts` and `relations.ts` are build artifacts (gitignored)

The files `drizzle/schema.ts` (~241 KB) and `drizzle/relations.ts` (~40 KB)
are **auto-generated** by `drizzle-kit generate` and are listed in `.gitignore`
(L23-24). This means:

- **They are NOT source-of-truth.** The canonical schema lives in
  `src/infrastructure/persistence/schema.ts` (currently 2973 lines).
- **They WILL be regenerated** by `npm run db:generate` from the Drizzle schema.
- **Manual edits to them are pointless** — they get clobbered on the next
  `drizzle-kit generate`.

If `tsc --noEmit` complains about a missing module `@/drizzle/schema` (TS2307),
the file is missing locally. Run `npm run db:generate` OR — if the Docker pull
of `postgres-meta` is blocked in the sandbox — run `drizzle-kit pull` (uses the
direct pg client) to regenerate without Docker.

---

## 🟡 Rule 3: TypeScript discipline — no `as any`, no `as never` without comment

The project enforces `strict: true` in `tsconfig.json`. When TS complains,
the answer is almost never `as any`.

| Layer                                   | Acceptable cast                                              | Why                                                                                           |
| --------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Domain types                            | `as const` for tuple-type narrowing                          | Pure narrowing, no `as never`.                                                                |
| Boundary with un-typed data             | `Record<string, unknown>` + runtime allowlist                | Type-safe at the boundary, fail-at-runtime on bad keys.                                       |
| `supabase-js` `.update(updates)`        | `as never` (with comment)                                    | The Zod schema upstream is the source of truth; TS still can't see through generic inference. |
| Drizzle `db.insert(table).values(rows)` | `as unknown as (typeof table.$inferInsert)[]` (with comment) | Mapper sets `undefined` for optionals; Drizzle's strict overloads reject `Partial<T>`.        |

If you find yourself adding `as any` to silence TS, **stop and write a comment**
explaining (a) which upstream source-of-truth shape you trust, (b) what runtime
guard (allowlist, Zod, narrowing) makes the cast defensible. If you cannot
write that comment, the answer is to widen the upstream type, not to suppress
TS.

---

## 🟡 Rule 4: Multi-file deletion protection

`rm file.ts && git checkout` can fail in two ways:

1. The file exists but is dirty (working-tree or staged) — `git checkout HEAD -- <file>` is refused.
2. The file is too important to delete (e.g. part of a coupled schema).

**Always prefer surgical edits over deletion.** If `str_replace` doesn't
apply because of whitespace mismatch, use `write_file` (overwrites the target
file pre-write-checked) or the Python heredoc pattern from Rule 1.

If you MUST delete and re-checkout:

```bash
# Aggressive recovery (use only for build artifacts that are NOT tracked)
rm -f <file>
git checkout HEAD -- <file>  # restores from last committed state

# Verify the restore actually worked before re-applying
[ -f <file> ] && echo "✓ Restored" || echo "✗ Restore FAILED"
wc -l <file>  # confirm non-empty
```

For untracked-but-not-gitignored files (rare), `git restore --staged --worktree <file>`
or `git checkout-index -- <file>` is the safer equivalent.

---

## 🟢 Rule 5: TS-error triage (when target is "0 production errors")

`tsc --noEmit|grep error TS` counts include errors from `.next/dev/types/validator.ts`
(a build-cache artifact, gitignored). These are **NOT production errors** —
they are stale build-cache output.

The filter for production errors only:

```bash
TSC=$(timeout 200 npx tsc --noEmit 2>&1)
TOTAL=$(echo "$TSC" | grep -c 'error TS')
NEXT=$(echo "$TSC" | grep -c '.next/dev/types/validator.ts')
PROD=$((TOTAL - NEXT))
echo "Total: $TOTAL | .next: $NEXT | production: $PROD"
```

When PROD = 0 but TOTAL > 0, the only outstanding issue is the build cache. Run
`npm run clean` (or `rm -rf .next`) and re-`tsc --noEmit`. This happens
frequently after `drizzle-kit generate`, which rebuilds `.next`.

**If `.next/dev/types/validator.ts` errors persist AFTER `rm -rf .next && tsc --noEmit`**,
the cache is genuinely stale — investigate dependency versions. Most common root
causes:

- A recent `npm install` upgraded a runtime dep's `.d.ts` types without bumping
  `node_modules/`.
- A `next.config.js` change invalidated the cache schema.
- A local `tsconfig.json` change extended the type-list (e.g. new `include` glob
  picked up a `.d.ts` from a third-party package).

---

## 🟢 Rule 6: Type-only-files import path

When a helper file imports from `@/drizzle/schema` and the import fails
with TS2307, the immediate fix is to switch to **the source-of-truth schema**:

```ts
// ❌ Wrong (drizzle/schema.ts is gitignored build artifact)
import type { Database } from '@/drizzle/schema';
import { clubs, groups } from '@/drizzle/schema';

// ✅ Right (canonical, source-of-truth, always present)
import type { Database } from '../src/infrastructure/persistence/schema';
import { clubs, groups } from '../src/infrastructure/persistence/schema';
```

`src/infrastructure/persistence/schema.ts` is the canonical schema that
`drizzle-kit generate` reads from / writes to. Code that needs schema types
imports from here directly. Importing from `@/drizzle/schema` only works if
the build artifact was generated locally (rare outside CI).

---

## 🟢 Rule 7: Pull-request review checklist

Before requesting review on a PR:

1. **Lint clean**: `npm run lint` exits 0 (warnings ≠ errors).
2. **Typecheck clean**: `tsc --noEmit` shows 0 production errors (see Rule 5).
3. **Tests pass**: `npm test` (Vitest) — all green; new code has tests.
4. **No `as any`**: `grep -rn ' as any' --include='*.ts' --include='*.tsx' lib/ app/ components/`
   (allowed only inside `_DrizzleLayer` / database-bridge cast contexts with a
   paragraph-length comment; never in domain code).
5. **No bulk multi-file edits**: the diff is ≤500 lines across ≤5 files
   (larger PRs need to be split into stacked reviewable chunks).
6. **`drizzle/` directory NOT modified**: if the diff touches `drizzle/schema.ts`
   or `drizzle/relations.ts`, you've probably edited a build artifact.
   Re-do the edit in `src/infrastructure/persistence/schema.ts`.

---

## 🟢 Rule 8: When you hit TS-errors you've never seen before

Spawn `thinker-with-files-gemini` with:

- The full error message + 5-line surrounding context
- The current file state (whole file is best)
- What you've already tried

Don't cycle through 5 cast variants hoping one works — diagnose the upstream
type first, then write the minimum-blast-radius fix.

---

**Maintainer:** Keep this file in sync with the Sprint-handoff notes in
`docs/tickets/` and the project-status sheets. If a new "lesson the hard way"
emerges in a sprint, add a Rule here with the Sprint reference.

---

## 🟢 Rule 10: Handbuch-Pflege bei Code-Änderungen

**Verbindlich:** SwingZ führt ein fortlaufendes Master-Handbuch unter
[`docs/HANDBOOK.md`](docs/HANDBOOK.md). Es integriert Rollen-Walkthroughs
(User-Sicht) und Implementierungs-Details (Dev-Sicht) pro Thema.

### Wenn muss ich das Handbuch anfassen?

| Code-Änderung                            | Pflicht-Update in                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| Neue `app/api/*/route.ts`                | `docs/handbook/dev/api-reference.md` (Auto-Gen)                               |
| Neue `app/(protected)/*/page.tsx`        | betroffenes `docs/handbook/user/<rolle>.md` Walkthrough                       |
| Neue DB-Tabelle / Spalte                 | `docs/handbook/dev/data-model.md` (Auto-Gen)                                  |
| Neuer Modul-Eintrag in `lib/features.ts` | `docs/handbook/dev/feature-flags.md` **und** `docs/HANDBOOK.md` Modul-Tabelle |
| Stripe-Webhook-Event                     | `docs/handbook/dev/stripe-integration.md`                                     |
| Neue Cron-Route                          | `docs/handbook/dev/background-jobs.md`                                        |
| Breaking-Change an Rollen / Guards       | `docs/handbook/dev/auth-rbac.md`                                              |

### Auto-Gen für stabile Kapitel

Zwei Kapitel werden automatisch aus Code generiert und sollten **nicht manuell editiert** werden:

```bash
npm run docs:autogen
# regeneriert docs/handbook/dev/data-model.md
# regeneriert docs/handbook/dev/api-reference.md
# Quelle: scripts/docs-autogen.ts
```

Pflicht vor jedem PR, der `app/api/**` oder Schema-Dateien berührt:

1. `npm run docs:autogen` ausführen
2. Diff-Inspektion — falls die generierten Listen inkorrekt sind, liegt's am Skript (Skript fixen, nicht Output editieren).
3. Hand-edits ausserhalb der `<!-- AUTOGEN:… -->`-Marker bleiben erhalten.

Marker-Syntax:

```markdown
<!-- AUTOGEN:BEGIN <name> … -->

(Inhalt wird bei jedem Auto-Gen-Lauf ersetzt)

<!-- AUTOGEN:END -->
```

### Pflege im PR-Template

Jede PR-Beschreibung enthält Zeile:

```
☐ docs/HANDBOOK.md berührt (welches Kapitel, was geändert)
☐ docs:autogen ausgeführt (falls Schema oder Routes)
☐ Glossar-Begriff ergänzt (falls neue Begriffe)
```

Reviewer müssen diese Zeile bestätigen, sonst kein Merge.

### Verwante Dateien

- `docs/HANDBOOK.md` — Master-TOC + Rollen-Index
- `docs/handbook/README.md` — Detail-Pflege-Regeln, Marker-Syntax
- `docs/handbook/glossary.md` — Begriffswörterbuch (PR mit `docs(glossary)` Label ergänzen)
- `scripts/docs-autogen.ts` — Auto-Gen-Skript
- `.lintstagedrc.js` (optional): Auto-Gen bei jedem Commit

## 🟢 Rule 9: Maintainer git-identity policy (anti Vercel-block on wrong commit-email)

**Lesson from Sprint-4/5 (2026-06-28):** 12 consecutive commits were
authored with local git-identity `Codebuff-CI-Validator <ci-validate@swingz.local>`
because earlier AI-sessions had overwritten the global/local git config.
Vercel's pre-deployment check then blocked the deployment with:

> "The deployment was blocked because the commit author email
> (ci-validate@swingz.local) is not valid. Ensure your git email matches
> your GitHub account."

Root cause: nothing **prevented** an AI-session from setting `git config
user.email` to a placeholder value. Root fix is procedural: enforce the
correct identity at the commit boundary + maintain a fallback mapping.

### Canonical maintainer-identity (single source-of-truth)

The maintainer's expected name + email live in **`scripts/_maintainer_identity.sh`**
(exported as `EXPECTED_NAME` and `EXPECTED_EMAIL`). All other files
(`.husky/pre-commit` Step 0, this CONTRIBUTING.md Rule 9, `.mailmap`
entry-rows, and `scripts/_rewrite_sprint45_authors.py` constants) refer
to that file rather than hardcoding the values.

If the canonical identity ever changes, follow this protocol:

1. Update `scripts/_maintainer_identity.sh` (the source-of-truth).
2. Mirror new values in `.mailmap`'s entry-rows (git's display-mapping
   parser requires literal values — no source/include support).
3. Mirror new values in `scripts/_rewrite_sprint45_authors.py`
   (`NEW_NAME` / `NEW_EMAIL` constants) for the recovery-script path.
4. Update the bash setup example in this Rule 9 to reference the new
   values (`$EXPECTED_NAME` / `$EXPECTED_EMAIL` from source).
5. Update any ADR that still stamps the old maintainer-name (currently
   `docs/decisions/adr-007-schema-migrations-composite-pk.md` references
   `Mike Swinger <mike.swinger@gmx.de>` — kept as historical, but new
   ADRs should use `Bart Mz <bartmz@gmx.de>`).
6. (Only if many commits in history still carry the old identity)
   `python3 scripts/_rewrite_sprint45_authors.py --full` — atomic
   history-rewrite with backup-tag preservation.

### Prevention — 4 layers, all required

| Layer                         | What                                          | Where                                 | Purpose                                                                                                            |
| ----------------------------- | --------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1. Persistent local identity  | `git config user.email "bartmz@gmx.de"`       | repo-local (run once after clone)     | All future commits from this machine use the right email                                                           |
| 2. Husky pre-commit guard     | Step 0 of `.husky/pre-commit`                 | this repo, runs at every commit       | Rejects commits with wrong/missing email BEFORE they enter history                                                 |
| 3. `.mailmap` display-mapping | root-level, versioned                         | Git's built-in display-only mechanism | Older wrong-identity commits still display as `Bart Mz <bartmz@gmx.de>` in `git log` / GitHub UI                   |
| 4. One-shot recovery script   | `scripts/_rewrite_sprint45_authors.py --full` | idempotent helper used once           | If wrong-identity commits ever slip through again, atomic 12-commit rewrite + force-push with backup-tag preserved |

### What you must do if you're a new contributor / AI-session

Before your first commit in this repo, source the maintainer-identity
single source-of-truth (see `### Canonical maintainer-identity` above),
then apply it to repo-local git config:

```bash
# Step 1: source the maintainer-identity source-of-truth file
. ./scripts/_maintainer_identity.sh               # exports EXPECTED_NAME + EXPECTED_EMAIL

# Step 2: apply as repo-local git config in this SwingZ repo
#         (bare `git config` without `--global` — repo-local, other repos unaffected)
cd /home/aeugeln/SwingZ
git config user.name  "$EXPECTED_NAME"
git config user.email "$EXPECTED_EMAIL"
git config user.email                              # verify the output
```

Notes:

- Bare `git config` (without `--global`) sets repo-local identity. Prefer repo-local so other repos on your machine are not affected.
- If your shell has `GIT_AUTHOR_EMAIL` or `GIT_COMMITTER_EMAIL` exported globally (e.g. via `.bashrc` / `.zshrc`), **unset it first** — env-vars override git config and will defeat the husky guard.
- The husky pre-commit hook (Layer 2) checks `git config user.email` BEFORE the cache-check + lint-staged. If the email is wrong, the commit is rejected with a clear fix-instruction.

> ⚠️ **`git commit --no-verify` bypasses Layer 2 (husky email-guard) entirely.** Only use `--no-verify` for WIP commits that will NOT reach origin/main. Commits destined for the main branch MUST go through the full pre-commit hook chain. `--no-verify` skips ALL hooks in this repo — lint-staged, cache-check, AND email-guard — so wrong-identity commits will pass through silently. If you used `--no-verify` for a commit destined for `main`, run `git commit --amend --author="Bart Mz <bartmz@gmx.de>"` (or `git rebase -i --exec 'git commit --amend --author=... --no-edit'`) to fix the identity before pushing.

### Recovery (if wrong-identity commits ARE in history)

Use `scripts/_rewrite_sprint45_authors.py` (atomic, backup-tag-preserving):

```bash
python3 scripts/_rewrite_sprint45_authors.py --dry-run   # analyse-only
python3 scripts/_rewrite_sprint45_authors.py --full      # rewrite + force-push
```

Recovery anchor:
`git reset --hard backup-pre-author-fix-20260628 && git push --force-with-lease origin main`

### Related ADR

- `docs/decisions/adr-007-schema-migrations-composite-pk.md`: maintainer-name
  correspondence. ADR-007 stamps `Mike Swinger <mike.swinger@gmx.de>` as the
  decision-time maintainer-name; this was superseded 2026-06-28 by
  `Bart Mz <bartmz@gmx.de>` = the real GitHub-account-email that Vercel
  actually validates against.
