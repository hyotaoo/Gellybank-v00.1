# GellyBank

GellyBank is a banking dashboard prototype for managing accounts and everyday
transactions. The frontend is built with React, TypeScript, and Vite; the
backend is a Flask API backed by MySQL.

## Features

- Sign-up, login, and guest demo access
- Checking and savings account dashboard
- Deposits, withdrawals, transfers, and transaction history
- Beneficiaries, card requests, and spending insights

## Run locally

### Frontend

Requires Node.js and npm.

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. Choose **Continue as guest** to try the
browser-only demo; its sample data is stored in local storage and does not
require the backend or a database.

### Backend (database-backed API)

Requires Python and MySQL.

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Set `DATABASE_URL` in `backend/.env` to your MySQL connection URL and replace
`SECRET_KEY` with a random value. Then initialize the schema and start the API:

```bash
python init_db.py
python app.py
```

The API runs on `http://localhost:5000`. The Vite development server proxies
`/api` requests to this address.

## Build frontend

```bash
cd frontend
npm run build
```
