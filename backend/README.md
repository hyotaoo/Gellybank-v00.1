# Gellybank backend (Flask + MySQL)

The whole server is one file: **`app.py`**. Read it top to bottom:
settings → helpers → tables → endpoints → demo data → start.

## Setup

See the [root README](../README.md) — it covers installing the packages,
creating the database, filling in `.env`, and starting the server.

## How the code is laid out

| File | What it is |
| --- | --- |
| `app.py` | The Flask app, the SQLAlchemy models, and every route |
| `app_detailed.py` | The same code with heavy explanatory comments |
| `db/schema.sql` | Fresh-install MySQL schema, including admin operations tables |
| `db/migrations/001_admin_operations.sql` | One-time update for databases created from the earlier schema |
| `db/migrations/002_beneficiaries.sql` | Adds the beneficiaries table used by the API |
| `db/migrations/003_legacy_model_columns.sql` | Adds columns expected by the current transaction/application models |
| `create_admin.py` | Interactive bootstrap for the first admin login |
| `.env` | Your MySQL credentials and secret key. `python dev.py` writes it. Git ignores it |
| `requirements.txt` | The Python packages the app needs |
| `venv/` | The virtual environment. Git ignores it |

Two things worth knowing before you read the code:

- **The app never creates tables itself.** It reads the ones defined in
  `db/schema.sql`, so run that file against MySQL before the first start.
  The file is safe to run more than once: tables use `CREATE TABLE IF NOT
  EXISTS`, the seed rows use `INSERT IGNORE`, the indexes live inside the
  table definitions, and the views are replaced. Nothing is ever dropped or
  rewritten. `python dev.py` (option 4) applies it and then checks the
  database against the models in `app.py`.
- **The database is `gellybank_db`, and the app connects as `root`.** Root is
  already the MySQL superuser, so `dev.py` does not create or alter the account
  — it only makes sure the database exists and grants access to it.
- **The password lives only in `.env`.** It is never written into the code, so
  it cannot be committed by accident.

## Where to look next

- The full list of endpoints, and which ones the frontend actually calls, is
  in the [root ROADMAP](../ROADMAP.md), section 5.
- The demo customer (`demo@gellybank.com` / `demo12345`), the way requests
  without a valid token used to fall back to that customer, and the missing
  primary-account column are covered in the ROADMAP.

Admin endpoints require an active bearer token for an `ADMIN` role. Admins
cannot submit account applications or perform deposits, withdrawals, or
transfers. Reset links are one-time, expire after one hour, and must be
delivered securely by an administrator; this project has no email provider.

Run the focused backend tests without a MySQL server from the repository root:

```sh
DATABASE_URL=sqlite:// SKIP_DEMO_SEED=1 PYTHONPATH=. backend/venv/bin/python \
  -m unittest discover -s backend/tests -v
```
