#!/bin/sh
# ═══ Maintainer-Identity Source-of-Truth ══════════════════════════════
#
# SINGLE SOURCE OF TRUTH for the maintainer's git identity. All other
# files (`.husky/pre-commit`, `.mailmap`, `CONTRIBUTING.md` Rule 9, and
# the recovery script `scripts/_rewrite_sprint45_authors.py`) refer to
# this file rather than hardcoding the values. If the maintainer's
# GitHub-account-email ever changes, only THIS file needs to be updated
# (plus a mechanical mirror in `.mailmap`'s entry-rows and in the
# recovery-script constants).
#
# Why a shell-sourceable file (vs `.env`/JSON/YAML)?
#   - `.husky/pre-commit` is a shell script — sourcing a shell file
#     directly via `. script.sh` is the natural POSIX idiom.
#   - No quoting/format gotchas that `.env` files have.
#   - Trivial to inspect with `cat`/`grep` for documentation cross-refs.
#   - Consumers can simply reference `$EXPECTED_EMAIL` / `$EXPECTED_NAME`.
#
# Update protocol (if maintainer-identity ever changes):
#   1. Edit EXPECTED_EMAIL and EXPECTED_NAME below (this file).
#   2. Mirror new values in `.mailmap` entry-rows (git's display-mapping
#      parser requires literal values there — no SoT-source support).
#   3. Mirror new values in `scripts/_rewrite_sprint45_authors.py`
#      (`NEW_NAME` / `NEW_EMAIL` constants) so future recovery uses
#      the new identity.
#   4. Update the bash setup example in CONTRIBUTING.md Rule 9 (any new
#      maintainer who reads Rule 9 must see the new values).
#   5. (Optional but recommended) Update any ADR that still stamps the
#      old maintainer-name. ADR-007 currently stamps
#      `Mike Swinger <mike.swinger@gmx.de>` — kept as historical,
#      but new ADRs should use `Bart Mz <bartmz@gmx.de>`.
#   6. (Only if many commits in history still carry the old identity)
#      `python3 scripts/_rewrite_sprint45_authors.py --full` —
#      atomic history-rewrite with backup-tag preservation.

# ═══ Canonical identity ════════════════════════════════════════════════

# Canonical email — MUST match the GitHub-account-email that Vercel
# validates commit-author-email against. Wrong value here = Vercel
# deployment-block on every push to main.
EXPECTED_EMAIL="bartmz@gmx.de"

# Canonical display-name — cosmetic only (Vercel does NOT validate name
# against GitHub-account-name, only email). Maintain for consistency
# between local git config, GitHub-account display-name, Git commit
# author-name, and ADR maintainer-name references.
EXPECTED_NAME="Bart Mz"

# Export so consumers (`.husky/pre-commit` + bash setup commands in
# CONTRIBUTING.md Rule 9) can read these directly without `cat`/`grep`.
export EXPECTED_EMAIL
export EXPECTED_NAME
