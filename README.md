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

From the root of the repo, run a single command:

```powershell
python dev.py
```

The tool checks your machine, sets up what is missing (a virtual environment,
the Python packages, `backend/.env`, the MySQL database and the `gellyca`
account, and the frontend packages), starts the backend and the frontend, and
opens a small dashboard. The first run takes a few minutes; after that it opens
straight up.

- Backend: http://localhost:5000 — check `GET /api/health`
- Frontend: http://localhost:5173

To open the dashboard without starting the servers, run:

```powershell
python dev.py --menu
```

If the dashboard cannot load for some reason, there is a plain text menu:

```powershell
python dev.py --plain
```

## Demo account

On first start, if the database is empty, a demo customer is seeded:

```
demo@gellybank.com  /  demo12345
```

It comes with a savings account (₱25,000) and a checking account (₱8,500).

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
