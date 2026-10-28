# Gellybank

An online banking app — open accounts, deposit, withdraw, transfer, and read
your statement.

**Stack:** Python + Flask + MySQL on the backend, React + TypeScript + Vite +
Tailwind on the frontend.

## Prerequisites

- Python 3.10+
- Node.js 18+
- MySQL 8 running locally

## Quick start

From the root of the repo, run the interactive terminal menu:

```powershell
python dev.py
```

Choose **1** to install missing dependencies and configure the application,
then choose **6** to start the backend and frontend. Setup creates or updates
the configured MySQL database account and applies `backend/db/schema.sql`.
If an existing database is detected with an earlier schema, setup applies the
needed additive migrations and verifies the tables and columns before starting
the backend.
The runner reports each server's health; if one fails, any healthy server
remains running.

To perform setup without opening the menu:

```sh
python dev.py --setup
```

To set up if needed and run both servers in the foreground:

```sh
python dev.py --start
```

Press Ctrl+C to stop servers started by the tool. Backend and frontend ports
default to 5000 and 5173 and can be changed with `GELLYBANK_BACKEND_PORT` and
`GELLYBANK_FRONTEND_PORT`.

- Backend: http://localhost:5000 — check `GET /api/health`
- Frontend: http://localhost:5173

Run `python dev.py` to open the text menu without automatically starting the
servers.

## Demo account

On first start, if the database is empty, a demo customer is seeded:

```
demo@gellybank.com  /  demo12345
```

It comes with a savings account (₱25,000) and a checking account (₱8,500).

## Admin portal

For an existing database, the `dev.py` setup detects and applies the required
migrations in order, including `backend/db/migrations/001_admin_operations.sql`
`002_beneficiaries.sql`, and `003_legacy_model_columns.sql`. A fresh database
created from `backend/db/schema.sql` already includes these tables and columns.

Create the first administrator interactively after the database is ready:

```sh
cd backend
venv/bin/python create_admin.py
```

On Windows, use `venv\Scripts\python.exe create_admin.py`. The script prompts
for the admin email and password without echoing the password. Then open
`/admin/login`. Admin sign-in accepts only `ADMIN` users; teller and customer
accounts are denied.

Password reset links issued from the admin user queue are one-use, expire
after one hour, and are shown to the admin for secure manual delivery. No
email delivery provider is configured.

## Layout

```
dev.py           Cross-platform setup and run tool
requirements-tui.txt
backend/         Flask API, SQLAlchemy models, MySQL schema
frontend/        React app
ROADMAP.md       What works, what doesn't, and what comes next
```

## Further reading

- [ROADMAP.md](ROADMAP.md) — current state, API reference, known issues
- [backend/README.md](backend/README.md) — backend walkthrough
