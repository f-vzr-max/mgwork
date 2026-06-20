#!/usr/bin/env bash
# Nightly Postgres backup for the self-hosted Supabase box (Mauritius).
# Self-hosting means YOU own backups — Supabase Cloud's managed PITR is gone.
# Run from cron (e.g. `15 2 * * *`) AND keep cloud.mu snapshots on. A dump that
# lives only on the same box is not a backup: set OFFSITE. TEST A RESTORE once
# before relying on this (pg_restore -d <newdb> <file>).
#
# Config via env (e.g. an /etc/default/asanao-backup sourced by cron):
#   PGURL   - connection string to the LOCAL db, e.g.
#             postgres://postgres:<pw>@127.0.0.1:5432/postgres   (required)
#   OUTDIR  - dump directory                          (default /var/backups/asanao)
#   KEEP    - days of local dumps to retain           (default 14)
#   OFFSITE - optional rclone remote, e.g. r2:asanao-backups
set -euo pipefail

PGURL="${PGURL:?set PGURL to the local postgres connection string}"
OUTDIR="${OUTDIR:-/var/backups/asanao}"
KEEP="${KEEP:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$OUTDIR/asanao-$STAMP.dump"

mkdir -p "$OUTDIR"
# -Fc = custom format: compressed and parallel-restorable via pg_restore.
pg_dump "$PGURL" -Fc -f "$FILE"

# Retention: drop local dumps older than KEEP days.
find "$OUTDIR" -name 'asanao-*.dump' -mtime "+$KEEP" -delete

# Off-box copy — strongly recommended (survives box loss / ransomware).
if [ -n "${OFFSITE:-}" ]; then
  rclone copy "$FILE" "$OFFSITE/"
fi

echo "backup ok: $FILE"
