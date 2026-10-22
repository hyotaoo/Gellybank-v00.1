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
| `db/schema.sql` | The MySQL schema: 9 tables, 2 views, and the two account types |
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
  without a valid token fall back to that customer, and the missing
  primary-account column are all in the ROADMAP too, sections 7 and 9.
