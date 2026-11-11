# Database Backups

The database configured in `backend/.env` is not version controlled, so use
these scripts to dump and restore it.

## Create a backup

```bash
chmod +x scripts/backup_db.sh
./scripts/backup_db.sh
```

You can also run this from the developer tool menu (`python dev.py`) with
option 10 (back up / restore), which calls the same scripts.

The script reads `DATABASE_URL` from `backend/.env`, dumps the database with
`mysqldump` (with `--single-transaction`, so it is consistent without locking
the tables), and writes it to:

```
backups/<database>_<YYYYMMDD>_<HHMMSS>.sql
```

## Restore a backup

```bash
chmod +x scripts/restore_db.sh
./scripts/restore_db.sh backups/<database>_<YYYYMMDD>_<HHMMSS>.sql
```

The script asks you to confirm the database name, because restoring
overwrites everything currently in the database.

## Testing a restore

Do this at least once before the demo, since a backup you have not tested
restoring does not count as a backup:

1. `./scripts/backup_db.sh`
2. Note a couple of rows (e.g. the demo customer's balance).
3. Change something (e.g. deposit via the app).
4. `./scripts/restore_db.sh backups/<latest-file>.sql`
5. Reload the app and verify the changed values are back to the backup state.

## Notes

- `backups/` is gitignored. Never commit database dumps — they contain
  personal data (RA 10173) and credentials.
- For a production system you would also want scheduled backups
  (e.g. cron), encryption, and offsite copies. That is out of scope for
  this project.
