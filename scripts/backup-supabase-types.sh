#!/usr/bin/env bash
#
# backup-supabase-types.sh
#
# Backup and restore mechanism for generated Supabase type files.
# Protects against corruption caused by Supabase CLI output leaking into
# the generated TypeScript files.
#
# Usage:
#   ./scripts/backup-supabase-types.sh save              # Save current clean state
#   ./scripts/backup-supabase-types.sh restore           # Restore last known good backup
#   ./scripts/backup-supabase-types.sh restore <n>       # Restore n-th newest backup
#   ./scripts/backup-supabase-types.sh list              # List available backups
#   ./scripts/backup-supabase-types.sh clean             # Remove all backups
#   ./scripts/backup-supabase-types.sh prune <keep>      # Keep only the <keep> newest backups
#
# Backup directory: .supabase-types-backup/
#

set -euo pipefail

BACKUP_DIR=".supabase-types-backup"
FILES=("types/supabase.ts")

cmd_save() {
    mkdir -p "$BACKUP_DIR"

    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)

    echo "📦 Saving backup $timestamp ..."
    for file in "${FILES[@]}"; do
        if [ -f "$file" ]; then
            local backup_file="${BACKUP_DIR}/${file}.${timestamp}"
            mkdir -p "$(dirname "$backup_file")"
            cp "$file" "$backup_file"
            echo "   ✓ $file → $backup_file ($(wc -l < "$file") lines)"
        else
            echo "   ⚠️  $file not found, skipping"
        fi
    done
    echo "✅ Backup saved as $timestamp"
}

cmd_restore() {
    local index="${1:-1}"

    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
        echo "❌ No backups found in $BACKUP_DIR/"
        exit 1
    fi

    # Get unique timestamps sorted newest first
    local timestamps
    timestamps=$(find "$BACKUP_DIR" -name "${FILES[0]}.*" -type f \
        | sed "s|.*${FILES[0]}\\.||" \
        | sort -r)

    if [ -z "$timestamps" ]; then
        echo "❌ No backups found for ${FILES[0]}"
        exit 1
    fi

    local selected
    selected=$(echo "$timestamps" | sed -n "${index}p")
    if [ -z "$selected" ]; then
        echo "❌ Backup #$index not found (available: $(echo "$timestamps" | wc -l))"
        exit 1
    fi

    echo "🔄 Restoring backup $selected ..."
    for file in "${FILES[@]}"; do
        local backup_file="${BACKUP_DIR}/${file}.${selected}"
        if [ -f "$backup_file" ]; then
            cp "$backup_file" "$file"
            echo "   ✓ Restored $file ($(wc -l < "$file") lines)"
        else
            echo "   ⚠️  Backup for $file not found, skipping"
        fi
    done
    echo "✅ Restored to backup $selected"
}

cmd_list() {
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
        echo "📭 No backups found."
        exit 0
    fi

    local timestamps
    timestamps=$(find "$BACKUP_DIR" -name "${FILES[0]}.*" -type f \
        | sed "s|.*${FILES[0]}\\.||" \
        | sort -r)

    local count=0
    echo "📋 Available backups:"
    for ts in $timestamps; do
        count=$((count + 1))
        local restored_date
        restored_date=$(echo "$ts" | sed 's/\(....\)\(..\)\(..\)_\(..\)\(..\)\(..\)/\1-\2-\3 \4:\5:\6/')
        echo "  [$count] $restored_date"
    done
    echo "Total: $count backup(s)"
}

cmd_prune() {
    local keep="${1:-5}"

    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
        echo "📭 No backups to prune."
        exit 0
    fi

    local timestamps
    timestamps=$(find "$BACKUP_DIR" -name "${FILES[0]}.*" -type f \
        | sed "s|.*${FILES[0]}\\.||" \
        | sort -r)

    local total
    total=$(echo "$timestamps" | wc -l)

    if [ "$total" -le "$keep" ]; then
        echo "📋 $total backup(s), keeping all (limit: $keep)"
        exit 0
    fi

    local to_delete
    to_delete=$(echo "$timestamps" | tail -n "+$((keep + 1))")

    echo "🧹 Pruning backups (keeping $keep, removing $((total - keep))) ..."
    for ts in $to_delete; do
        for file in "${FILES[@]}"; do
            local backup_file="${BACKUP_DIR}/${file}.${ts}"
            if [ -f "$backup_file" ]; then
                rm "$backup_file"
                echo "   ✗ Removed $backup_file"
            fi
        done
    done
    echo "✅ Pruned to $keep backup(s)"
}

cmd_clean() {
    if [ ! -d "$BACKUP_DIR" ]; then
        echo "📭 No backups to clean."
        exit 0
    fi

    echo "🗑️  Removing all backups in $BACKUP_DIR/ ..."
    rm -rf "$BACKUP_DIR"
    echo "✅ All backups removed."
}

# ── Main ──────────────────────────────────────────────────────────────────

ACTION="${1:-}"
shift || true

case "$ACTION" in
    save)       cmd_save "$@" ;;
    restore)    cmd_restore "$@" ;;
    list)       cmd_list ;;
    prune)      cmd_prune "$@" ;;
    clean)      cmd_clean ;;
    *)
        echo "Usage: $0 {save|restore [n]|list|prune [keep]|clean}"
        echo ""
        echo "  save          Save current state of Supabase type files as backup"
        echo "  restore [n]   Restore the n-th newest backup (default: 1 = newest)"
        echo "  list          List all available backups with timestamps"
        echo "  prune [keep]  Keep only <keep> newest backups (default: 5)"
        echo "  clean         Remove ALL backups"
        echo ""
        echo "Backup directory: $BACKUP_DIR/"
        exit 1
        ;;
esac
