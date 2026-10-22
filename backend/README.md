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

- **The app never creates tables itself.** Run `db/schema.sql` for a fresh
  database. For an existing database not using `dev.py`, apply the required
  migration files in numeric order before starting the app. The developer
  tool detects and applies missing objects from those migrations.
- **Create an administrator after schema setup.** Run
  `venv/bin/python create_admin.py` (or the Windows venv equivalent) from this
  directory. The password is prompted interactively and is not echoed.
- **The database is `gellybank_db`, and the app connects as `gellyca`.** That
  MySQL account has rights inside that one database and nowhere else, so it
  cannot read or change anything else on the server.
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
