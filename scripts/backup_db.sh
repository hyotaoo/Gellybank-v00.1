#!/usr/bin/env bash
#
# Gellybank database backup.
#
# Reads DATABASE_URL from backend/.env, dumps the database with mysqldump
# into backups/ with a timestamp. Requires mysqldump on PATH.
#
# Usage:
#   ./scripts/backup_db.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

# MySQL client binaries are often not on PATH (e.g. /usr/local/mysql/bin).
for dir in /usr/local/mysql/bin /opt/homebrew/opt/mysql-client/bin /opt/homebrew/bin; do
    if [ -d "$dir" ]; then
        PATH="$PATH:$dir"
    fi
done

command -v mysqldump >/dev/null || { echo "mysqldump not found. Install MySQL client tools." >&2; exit 1; }

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

if [ ! -d backups ]; then
    echo "Creating backups/"
    mkdir -p backups
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILE="backups/${DB_NAME}_${TIMESTAMP}.sql"

echo "Backing up database '$DB_NAME' on ${DB_HOST}:${DB_PORT:-3306} ..."
mysqldump \
    --host="$DB_HOST" \
    --port="${DB_PORT:-3306}" \
    --user="$DB_USER" \
    --password="$DB_PASS" \
    --single-transaction \
    --routines \
    --triggers \
    --no-tablespaces \
    --databases "$DB_NAME" \
    > "$FILE"

if [ ! -s "$FILE" ]; then
    echo "Backup failed: $FILE is empty." >&2
    rm -f "$FILE"
    exit 1
fi

echo "Backup written to $FILE ($(du -h "$FILE" | cut -f1))."
echo "To restore:"
echo "  mysql -h $DB_HOST -P ${DB_PORT:-3306} -u $DB_USER -p < $FILE"
