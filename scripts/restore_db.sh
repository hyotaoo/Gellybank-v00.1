#!/usr/bin/env bash
#
# Gellybank database restore.
#
# Restores a mysqldump file created by scripts/backup_db.sh into the
# database configured in backend/.env.
#
# Usage:
#   ./scripts/restore_db.sh backups/gellybank_db_YYYYMMDD_HHMMSS.sql
#
set -euo pipefail

cd "$(dirname "$0")/.."

# MySQL client binaries are often not on PATH (e.g. /usr/local/mysql/bin).
for dir in /usr/local/mysql/bin /opt/homebrew/opt/mysql-client/bin /opt/homebrew/bin; do
    if [ -d "$dir" ]; then
        PATH="$PATH:$dir"
    fi
done

command -v mysql >/dev/null || { echo "mysql not found. Install MySQL client tools." >&2; exit 1; }

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
    echo "Usage: $0 <backup-file.sql> [--yes]" >&2
    echo "Available backups:"
    ls -1 backups/*.sql 2>/dev/null || echo "  (none)"
    exit 1
fi

FILE=$1
CONFIRMED=${2:-}
if [ ! -f "$FILE" ]; then
    echo "Backup file not found: $FILE" >&2
    exit 1
fi

if [ ! -f backend/.env ]; then
    echo "backend/.env not found. Run 'python dev.py' first." >&2
    exit 1
fi

DATABASE_URL=$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2-)
if [ -z "$DATABASE_URL" ]; then
    echo "DATABASE_URL is not set in backend/.env." >&2
    exit 1
fi

URL_REGEX='^mysql\+pymysql://([^:]+):([^@]+)@([^:/]+):?([0-9]*)/([A-Za-z0-9_]+)$'
DB_USER=$(echo "$DATABASE_URL" | sed -E "s#$URL_REGEX#\1#")
DB_PASS=$(echo "$DATABASE_URL" | sed -E "s#$URL_REGEX#\2#")
DB_HOST=$(echo "$DATABASE_URL" | sed -E "s#$URL_REGEX#\3#")
DB_PORT=$(echo "$DATABASE_URL" | sed -E "s#$URL_REGEX#\4#")
DB_NAME=$(echo "$DATABASE_URL" | sed -E "s#$URL_REGEX#\5#")

echo "Restoring $FILE into database '$DB_NAME' (host ${DB_HOST}:${DB_PORT:-3306})."
echo "WARNING: this overwrites everything currently in '$DB_NAME'."

if [ "$CONFIRMED" != "--yes" ]; then
    read -r -p "Type the database name to confirm: " CONFIRM
    if [ "$CONFIRM" != "$DB_NAME" ]; then
        echo "Confirmation does not match. Aborting."
        exit 1
    fi
fi

# Dumps can contain views owned by another MySQL account (mysqldump records
# DEFINER=`root`@`localhost`). Replacing such a view requires the SYSTEM_USER
# privilege the application user does not have, which aborts the restore with
# ERROR 1227. The application does not use views, so skip their DDL.
#
# Every base table is dropped before the dump is applied: dumps mix foreign key
# columns of different signedness (the dump uses BIGINT UNSIGNED, while tables
# created by the app use BIGINT), and MySQL rejects a CREATE TABLE whose foreign
# key column does not match an existing table (ERROR 3780) even when foreign key
# checks are disabled.
{
    echo "USE \`$DB_NAME\`;"
    echo "SET FOREIGN_KEY_CHECKS = 0;"
    mysql \
        --host="$DB_HOST" \
        --port="${DB_PORT:-3306}" \
        --user="$DB_USER" \
        --password="$DB_PASS" \
        --skip-column-names --batch \
        -e "SELECT CONCAT('DROP TABLE IF EXISTS \`', TABLE_NAME, '\`;') FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$DB_NAME' AND TABLE_TYPE = 'BASE TABLE'"
    awk '
        /^-- (Temporary|Final) view structure for view / { skip = 1; next }
        skip && /^\/\*!50001 SET character_set_client .*= @saved_cs_client/ { drain = 2; skip = 0; next }
        skip && /^SET character_set_client .*= @saved_cs_client/ { skip = 0; next }
        drain > 0 { drain--; next }
        skip { next }
        { print }
    ' "$FILE"
} | mysql \
    --host="$DB_HOST" \
    --port="${DB_PORT:-3306}" \
    --user="$DB_USER" \
    --password="$DB_PASS"

echo "Restore complete."
