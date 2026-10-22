# Gellybank — Roadmap

A small online banking system: open accounts, deposit, withdraw, transfer, and
read your statement.

- **Backend:** Python + Flask + MySQL (in `backend/`, venv at `backend/venv/`)
- **Frontend:** React + TypeScript + Vite + Tailwind (in `frontend/`)
- **Database:** MySQL 8, schema in `backend/db/schema.sql`

> This document describes the project **as it actually is today**, not as it was
> originally planned. Where the two differ, section 9 lists the difference
> instead of hiding it. How to run it is in the root
> [README.md](README.md).

---

## 1. Where the project is today

| Area | Status |
| --- | --- |
| Backend API | ✅ Banking and admin operations endpoints implemented |
| Database | ✅ Schema includes admin user controls, account applications, password resets, and audit severity |
| Backend auth | ✅ Protected APIs require valid active-user tokens; admin APIs require `ADMIN` |
| Frontend auth | ✅ Customer and admin sign-in use the API and persist bearer tokens |
| Accounts | ✅ List / close are wired up; new account requests now enter the admin approval queue |
| Transactions | ✅ Deposit, withdraw, transfer, and statement history are wired up |
| Admin operations | ✅ Overview, user controls, application decisions, and read-only audit logs |
| Beneficiaries | ⚠️ Read-only in the UI — there is no screen to add, edit, or delete one |
| Cards | ⚠️ Request only — there is no screen to list or block a card |
| Insights | ⚠️ The backend endpoint works, but the page is a placeholder and nothing calls it |
| Tests | ✅ Focused admin/auth backend tests |
| Migrations | ⚠️ SQL remains hand-run; `db/migrations/001_admin_operations.sql` upgrades existing databases |

The demo account is still seeded for development, but invalid or missing bearer
tokens no longer select it for authenticated API routes. Admin access is
restricted to active `ADMIN` users and financial transaction creation is
explicitly denied to that role.

---

## 2. How the pieces fit

```
Browser (React app)  ──HTTP/JSON──>  Flask API  ──SQLAlchemy──>  MySQL 8
     │                                    │
  login form                         validates input,
  dashboard                          hashes passwords,
  transfer form                      signs/verifies tokens
```

- The **frontend never touches the database**. It only calls API endpoints.
- The **backend is the source of truth**. All money rules live there.
- The user proves who they are with a **bearer token** sent on every request.
- The token is a signed payload from `itsdangerous` (which ships with Flask),
  not a JWT. It expires after 24 hours and is invalidated when a password is
  reset.

---

## 3. Tech stack

The four things that were actually chosen:

1. **Python** — backend language
2. **Flask** — backend framework
3. **MySQL** — database
4. **React** — frontend UI

Everything else is the standard companion of one of those four:

| Package | Why it is there |
| --- | --- |
| SQLAlchemy / Flask-SQLAlchemy | The standard Flask ORM — how the app talks to MySQL |
| Werkzeug | Ships with Flask. `generate_password_hash` is a Flask built-in |
| itsdangerous | Ships with Flask. Used to sign and verify the login token |
| PyMySQL | The MySQL driver for Python |
| cryptography | Required by PyMySQL for MySQL 8's `caching_sha2_password` |
| python-dotenv | Loads `.env`, so the MySQL password never lives in code |
| flask-cors | Needed because the frontend is on `:5173` and the API is on `:5000` |
| TypeScript | Typing layer on top of React |
| Vite | The build tool for React |
| Tailwind CSS + PostCSS + Autoprefixer | Styling. There is no component library |
| react-router-dom | Routing between the login, signup, and dashboard screens |

There is no test framework, no linter, and no CI in either half of the project.

---

## 4. Data model

The original banking tables plus `account_applications` and
`password_reset_tokens` are defined in `backend/db/schema.sql` and mirrored by
the SQLAlchemy models in `backend/app.py`.

| Table | Model | What it holds |
| --- | --- | --- |
| `customers` | `Customer` | The person: name, date of birth, email, phone, address |
| `app_users` | `AppUser` | Login credentials and role (`ADMIN` / `TELLER` / `CUSTOMER`), linked to a customer |
| `account_types` | `AccountType` | The two kinds offered: `SAVINGS` and `CHECKING`, each with a minimum balance and interest rate |
| `bank_accounts` | `BankAccount` | An account: number, current balance, interest rate, status (`ACTIVE` / `FROZEN` / `CLOSED`) |
| `transfers` | `Transfer` | One money movement between two accounts, with its own reference code and status |
| `transactions` | `Transaction` | Every movement on one account, with the balance left afterwards and a `status` of `PENDING` / `COMPLETED` / `FAILED` / `VOID` |
| `bank_cards` | `BankCard` | A card issued against an account. Only the last 4 digits are stored |
| `beneficiaries` | `Beneficiary` | Saved transfer recipients (name, account number, bank) |
| `account_applications` | `AccountApplication` | Customer account requests, pending review and approval/rejection history |
| `password_reset_tokens` | `PasswordResetToken` | Hashed, single-use, expiring password reset tokens |
| `audit_logs` | `AuditLog` | Append-only application events with actor, severity, entity, details, and IP |

The schema also creates two views that the backend does not read, but that
are useful for reporting: `v_account_summary` (an account with its owner's
name and account type) and `v_transaction_history` (a transaction with the
account number it belongs to).

Money is stored as `DECIMAL(15,2)` and handled with Python's `Decimal`, never
as a float. The schema uses `InnoDB` and foreign keys throughout. The
database is named `gellybank_db`; the app connects to it as the MySQL user
`gellyca`, which has rights inside that one database and nowhere else.

---

## 5. API reference

All routes live in `backend/app.py`. Responses are JSON. Errors come back as
`{"message": "...", "code": "..."}` with a matching HTTP status.

Banking data routes require a valid active-user bearer token. Every
`/api/admin/*` route additionally requires role `ADMIN`; authorization is
enforced by Flask decorators, not just by the frontend.

| Method | Path | Auth | Called by the UI? |
| --- | --- | --- | --- |
| `GET` | `/` | No | — (startup message) |
| `GET` | `/api/health` | No | — (health check) |
| `POST` | `/api/auth/register` | No | ⚠️ Signup UI remains a prototype |
| `POST` | `/api/auth/login` | No | ✅ Customer and admin login |
| `POST` | `/api/auth/reset-password` | No | ✅ Consumes one-use reset token |
| `GET` | `/api/accounts` | Yes | ✅ `AccountContext` |
| `POST` | `/api/accounts` | Yes | ✅ Creates a pending application for customers |
| `GET` | `/api/accounts/<id>` | Yes | ❌ `getAccount` is unused |
| `PATCH` | `/api/accounts/<id>` | Yes | ⚠️ `AccountsPage` calls it, but the backend ignores the body |
| `DELETE` | `/api/accounts/<id>` | Yes | ✅ `AccountsPage` (closes the account) |
| `GET` | `/api/transactions` | Yes | ✅ `TransactionList` (supports `?accountId=` and `?limit=`) |
| `POST` | `/api/transactions` | Yes | ✅ `DepositPage`, `WithdrawPage` |
| `POST` | `/api/transactions/transfer` | Yes | ✅ `TransferPage` |
| `PATCH` | `/api/transactions/<id>` | Yes | ❌ `updateTransactionNote` is unused |
| `DELETE` | `/api/transactions/<id>` | Yes | ❌ `voidTransaction` is unused |
| `GET` | `/api/beneficiaries` | Yes | ✅ `TransferPage` |
| `POST` | `/api/beneficiaries` | Yes | ❌ unused |
| `PATCH` | `/api/beneficiaries/<id>` | Yes | ❌ unused |
| `DELETE` | `/api/beneficiaries/<id>` | Yes | ❌ unused |
| `POST` | `/api/cards/request` | Yes | ✅ `RequestCardButton` |
| `GET` | `/api/insights/spending` | Yes | ❌ unused |
| `GET` | `/api/admin/dashboard` | Admin | ✅ Admin overview |
| `GET` | `/api/admin/users` | Admin | ✅ Search system users |
| `PATCH` | `/api/admin/users/<id>` | Admin | ✅ Change role or active status |
| `POST` | `/api/admin/users/<id>/password-reset` | Admin | ✅ Issue one-use reset link |
| `GET` | `/api/admin/applications` | Admin | ✅ List application queue |
| `POST` | `/api/admin/applications/<id>/decision` | Admin | ✅ Approve or reject with reason |
| `GET` | `/api/admin/logs` | Admin | ✅ Filter read-only audit events |

### Frontend routes

| Path | Screen | Notes |
| --- | --- | --- |
| `/` | `LoginPage` | Welcome screen |
| `/login` | `SignInPage` | Customer sign-in |
| `/admin/login` | `AdminLoginPage` | Figma Admin Sign In; accepts only administrators |
| `/admin/dashboard` | `AdminDashboardPage` | System metrics and quick actions |
| `/admin/users` | `AdminUsersPage` | Role/status management and password reset links |
| `/admin/applications` | `AdminApplicationsPage` | Approve/reject account requests |
| `/admin/logs` | `AdminLogsPage` | Searchable severity/actor-filtered audit events |
| `/reset-password` | `ResetPasswordPage` | Redeem one-time password reset link |
| `/signup` | `SignUpPage` | Steps: details → OTP → success. The OTP screen is cosmetic; no code is sent or checked |
| `/dashboard` | `DashboardPage` | Balance, quick actions, AI Insights card |
| `/dashboard/accounts` | `AccountsPage` | Open / close / set-primary |
| `/dashboard/deposit` | `DepositPage` | |
| `/dashboard/withdraw` | `WithdrawPage` | |
| `/dashboard/transfer` | `TransferPage` | Internal transfer, or transfer to a saved beneficiary |
| `/dashboard/history` | `HistoryPage` | Statement for the selected account |
| `/dashboard/insights` | `PlaceholderPage` | Not built yet |
| `/dashboard/profile` | `PlaceholderPage` | Not built yet |

The admin frontend route is guarded by a protected metrics request, and every
admin API route checks the bearer token and exact admin role. Customer page
routes still have no frontend route guard, but their banking API requests
require a valid token.

---

## 6. How to run it

The shortest way is `python dev.py` at the repo root — it handles the venv,
packages, `backend/.env`, the MySQL database and the `gellyca` account, and
starts both servers. See [README.md](README.md).

If you ever need to set it up by hand (for debugging or an unusual environment):

```powershell
# 1. create the database
#    run backend/db/schema.sql in MySQL Workbench or the mysql client
#    (it creates gellybank_db and the initial schema)

# 2. create the MySQL account the app uses, as an admin
#    CREATE USER 'gellyca'@'localhost' IDENTIFIED BY 'your-password';
#    GRANT ALL PRIVILEGES ON `gellybank_db`.* TO 'gellyca'@'localhost';
#    FLUSH PRIVILEGES;

# 3. configure the backend
#    write backend\.env yourself, with these two lines:
#      DATABASE_URL=mysql+pymysql://gellyca:YOUR_PASSWORD@127.0.0.1:3306/gellybank_db
#      SECRET_KEY=<a long random string>
#    ("python dev.py" writes this file for you)

# 4. backend
cd backend
python -m venv venv
venv\Scripts\pip install -r requirements.txt
venv\Scripts\python.exe app.py              # -> http://localhost:5000

# 5. frontend
cd frontend
npm install
npm run dev                                 # -> http://localhost:5173
```

The backend seeds a demo customer on first start, but only if the database is
empty: `demo@gellybank.com` / `demo12345`, with a savings account of ₱25,000
and a checking account of ₱8,500.

For existing databases, apply `backend/db/migrations/001_admin_operations.sql`
once instead of re-running the schema. Create the first admin interactively
with `cd backend && venv/bin/python create_admin.py`.

---

## 7. Known issues

The first authentication and admin-audit findings below are resolved. Remaining
issues are still observable in the current code.

1. **Resolved — missing/invalid tokens no longer select the demo user.**
   Authenticated banking routes now return 401 without a valid active-user
   token. Admin routes require an active `ADMIN` token and return 403 for
   other roles.

2. **Partially resolved — customer/admin sign-in uses the API.** The signup
   flow remains a prototype and does not yet create users through
   `/api/auth/register`.

3. **Partially resolved — admin routes are guarded.** Customer dashboard routes
   still lack a client-side route guard; their API data requests now require
   bearer authentication.

4. **CORS is wide open.** `backend/app.py:39` calls `CORS(app)` with no origin
   list, so any site in a browser can call this API.

5. **"Set as primary" does nothing.** `backend/app.py:421-429` — the
   `PATCH /api/accounts/<id>` handler ignores the request body and returns the
   account unchanged. `frontend/src/pages/dashboard/AccountsPage.tsx:19` calls
   it and the UI behaves as if it worked. There is no `is_primary` column; the
   backend derives "primary" as the oldest `ACTIVE` account.

6. **The sign-up form collects fields the backend discards.**
   `sourceOfFunds` and `purposeOfAccount` are sent but never stored — there
   are no columns for them. The OTP step in the signup flow is decorative: no
   code is generated, sent, or checked.

7. **`requirements.txt` does not match the installed packages.**
   `backend/requirements.txt` lists 8 packages, but the venv also has
   `alembic 1.20.0` and `flask-migrate 4.1.0`. Neither is imported anywhere
   in `app.py` — they are leftovers from the original plan. A fresh install
   gets a different set of packages than the current machine has.

8. **`app_detailed.py` duplicates `app.py`.** The two files are 1048 and 964
   lines with the same logic; `app_detailed.py` is the commented version. They
   will drift apart. One should be deleted, or the commented one should become
   the only one.

9. **The frontend `Account` type lies.**
   `frontend/src/api/accounts.ts:16-19` declares `interestEarned`,
   `overdraftLimit`, `monthlyWithdrawalLimit`, and `withdrawalsThisMonth`.
   The backend never returns any of them. `label` and `isPrimary` are also
   derived server-side, not stored.

10. **Only `backend/app.py` is committed.** `requirements.txt`,
    `db/schema.sql`, `backend/README.md`, `app_detailed.py`, and `dev.py` are
    all untracked. A fresh clone of the repository cannot be installed or run.

11. **Limited tests, no linter, no CI.** Focused admin/auth backend tests cover
    role boundaries, applications, password resets, and audit events. Existing
    deposit, withdrawal, transfer, and broader frontend behavior still need
    dedicated test coverage.

12. **macOS note for the setup script.** `cryptography==50.0.2` only ships
    prebuilt wheels for Apple Silicon, so an Intel Mac would try to compile it
    from source. Separately, macOS Monterey and later use port 5000 for
    AirPlay Receiver, which collides with the Flask dev server.

13. **Partially resolved — admin and authentication events are audited.**
    Role/status changes, account-application decisions, password reset events,
    failed logins, and login spikes are recorded. Customer deposits,
    withdrawals, and transfers are not yet included in the audit trail.

14. **`SECRET_KEY` falls back to a hardcoded value.** `backend/app.py:19` uses
    `os.environ.get("SECRET_KEY", "dev-secret-change-me")`, and that fallback
    is the key that signs login tokens. Anyone who knows it can forge a token
    and read anyone's account. `python dev.py` always writes a random value
    into `backend/.env`, so the risk is only in a hand-built setup that
    forgets the variable — but the app should refuse to start on the
    placeholder rather than quietly signing tokens with it.

---

## 8. Next steps

Each phase ends with something that works. Do them in order.

### Phase 1 — Wire up the login (do this first)

The app is not a banking app until one customer cannot see another customer's
money.

**Backend — all in `backend/app.py`:**

1. `current_user()` (lines 113-124) — drop the demo-customer fallback. Return
   `None` when the `Authorization` header is missing or the token is invalid.
2. Add a `require_user` decorator and apply it to `/api/accounts*`,
   `/api/transactions*`, `/api/beneficiaries*`, `/api/cards/request`, and
   `/api/insights/spending`. These stay open: `/api/auth/register`,
   `/api/auth/login`, `/api/health`, and `/`.
3. The decorator returns `401` with
   `{"message": "Sign in to continue.", "code": "unauthorized"}`. Handlers then
   read the user from `g.user` and drop their current
   `if not user.customer_id:` branches.
4. Line 39 — replace `CORS(app)` with
   `CORS(app, resources={r"/api/*": {"origins": os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")}})`.
   Write `CORS_ORIGINS` into `backend/.env` (and teach `dev.py` to add it).
5. Add `GET /api/me`, returning the signed-in user. The original plan called
   for it, the backend never got it, and the frontend needs it for the header.

**Frontend:**

6. `frontend/src/api/client.ts` — on a `401`, clear the token and redirect to
   `/login`.
7. `frontend/src/components/auth/LoginForm.tsx` — make the email field
   controlled, call `login()`, then `setAuthToken(result.token)` and
   `navigate('/dashboard')`. Show an `ApiError` message inline and disable the
   button while the request is in flight.
8. `frontend/src/pages/auth/SignUpPage.tsx` — call `register(details)` at the
   end of the details step. The OTP screen can stay as a cosmetic step, but
   add a comment saying it is not actually verified.
9. `frontend/src/App.tsx` — add a `RequireAuth` wrapper around the
   `AccountLayout` route, and redirect `/login` to `/dashboard` when a token
   already exists.
10. `frontend/src/context/AccountContext.tsx` — on a `401`, clear the token
    and bounce to the login screen. This is the component that loads the
    accounts, so it is the natural place.
11. `frontend/src/components/dashboard/Sidebar.tsx` — signing out should also
    clear the cached selected account (`gellybank.selectedAccountId` in
    `localStorage`).

**Done when:**

- `GET /api/accounts` with no token returns `401`, not the demo data.
- Register → log in → the dashboard shows the new customer's accounts, not
  the demo customer's.
- Sign out, then open a dashboard URL by hand → you land on `/login`.
- A request from an unknown Origin gets no CORS header.
- The demo customer is reachable only by really logging in as
  `demo@gellybank.com` / `demo12345`.

### Phase 2 — Tests for the money rules

Add `pytest` to the backend and cover the rules that matter: a withdrawal
larger than the balance is rejected, a transfer to the same account is
rejected, a transfer is all-or-nothing, a transfer cannot touch somebody
else's account, and a deposit updates the balance and writes a transaction row.

### Phase 3 — Make "primary" real

Add an `is_primary` column to `bank_accounts`, make `PATCH /api/accounts/<id>`
actually read the body, and change the backend's "oldest active account"
fallback to a real lookup.

### Phase 4 — Finish the features that are half-built

- A beneficiaries screen (add, edit, delete) — the API is already there.
- A cards screen (list, block) — only request works today.
- A real insights page that calls `/api/insights/spending` instead of
  `PlaceholderPage`. Note the "AI" is currently a single hardcoded tip string
  in `backend/app.py:800`; a real breakdown is just a category summary.
- A profile page.

### Phase 5 — Housekeeping

- Delete `app_detailed.py` or make it the single canonical file.
- Regenerate `requirements.txt` from the venv, and decide whether `alembic`
  and `flask-migrate` are in or out.
- Commit `requirements.txt` and `db/schema.sql`.
- Add ESLint and Prettier to the frontend.
- **Commit `dev.py`** — the cross-platform setup script is written and works,
  but it is still untracked, so a fresh clone does not get it.

---

## 9. Where this differs from the original plan

The first version of this roadmap described a different project. Nothing below
was built. It is recorded here so the history is not lost, not as a to-do.

| Originally planned | What was built instead | Why |
| --- | --- | --- |
| SQLite | MySQL 8 | MySQL was already set up locally, and the schema file was written for it |
| An `app/` package with a `create_app()` factory | One file, `backend/app.py` | Fewer moving parts; the app is small enough to read top to bottom |
| Blueprints for the routes | `@app.route` decorators in the same file | Same reason — no import loops to worry about |
| Flask-JWT-Extended | A signed token from `itsdangerous` | It ships with Flask, so it needed no extra dependency |
| Alembic migrations | A hand-run `db/schema.sql` | The schema is small and has not changed much yet |
| JWT-protected routes | Routes that fall back to the demo customer | This is issue 1 in section 7, and the reason phase 1 exists |

---

## 10. Definition of done

| # | Goal | Status |
| --- | --- | --- |
| 1 | Register a new user and log in | ⚠️ The backend does both. The frontend never calls it |
| 2 | See your accounts and balance on a dashboard | ⚠️ Works, but always as the demo customer |
| 3 | Deposit and withdraw money, with the balance updating correctly | ✅ Works |
| 4 | Transfer money to another account, and see both accounts change | ✅ Works |
| 5 | Be unable to view or touch another user's accounts | ❌ Not enforced — see section 7, item 1 |

---

## Appendix — CMSC 203 course brief

> The text below is a **separate course assignment** and is kept here
> unchanged for reference. It describes a *Python desktop* application built
> with Tkinter, which is **not** what this repository contains. The project in
> this repository is the web app described above.

CMSC 203 – Object-Oriented Programming Final Project: Object-Oriented Application Development
Project Title: Design and Develop a Real-World Object-Oriented Application Project Description The final project serves as the culminating assessment for CMSC 203 – Object-Oriented Programming. Students will design, develop, test, document, and present a functional desktop application that demonstrates mastery of object-oriented programming concepts learned throughout the course. The project should solve a practical problem using proper software engineering practices and object-oriented design principles.

This project directly measures the attainment of the course intended learning outcomes (CILOs), particularly the students' ability to apply OOP concepts, create maintainable software, utilize design patterns, develop graphical user interfaces, implement exception handling, and produce complete technical documentation.

Final Project Theme
Develop a Python GUI-Based Object-Oriented Banking System using Tkinter (or another instructor-approved Python GUI framework)

Project Requirements Your application must include the following:
1. Object-Oriented Programming (30%) The system should demonstrate proper use of:
Classes and Objects 
Constructors 
Encapsulation 
Inheritance
Polymorphism 
Abstraction 
Method Overloading (where applicable) 
Interfaces or Abstract Classes (if applicable)2. Functional Features (20%)

The application must include at least:
User Login (optional but recommended)
Add Records
Edit Records
Delete Records
Search Records
Display Records
Save Data
Load Data

3. Graphical User Interface (10%)
Develop a user-friendly interface that includes:
Multiple windows/forms
Buttons
Labels
Textboxes
Combo Boxes
Menus
Tables/List Displays
Appropriate fonts and colors

4. Exception Handling (10%)
Your application must properly handle errors such as:
Invalid input
Empty fields
File errors
Invalid data types
Custom Exceptions (minimum of one)

5. Code Quality (10%)
Your code should demonstrate:
Proper naming conventions
Modular programming
Reusable methods
Comments where appropriate
Readability
Efficient organization using packages/modules

6. Documentation (10%)
Submit a technical documentation containing:
Title Page
Introduction
Statement of the Problem
Objectives
Scope and Limitations
System Features
UML Class Diagram
Flowchart 
Screenshot of the Application 
Testing Results 
Conclusion 
References

7. Presentation and Demonstration (10%) Each group will deliver a 15–20-minute presentation that includes:
System overview 
Problem addressed 
OOP concepts applied 
Live demonstration 
Challenges encountered 
Lessons learned 
Question and Answer
Development Guidelines 
Programming Language: Python 
GUI Framework: Tkinter (preferred) 
Team Composition: 3–5 students per group 
Version Control: Git is encouraged. 
Original Work: The project must be the students' own work. AI-assisted coding tools may be used ethically for learning and productivity, but students must understand and be able to explain every part of their code.

Deliverables Submit the following: 
1. Complete Python source code 
2. Executable application (if applicable) 
3. Technical documentation (PDF) 
4. UML Class Diagram 
5. Flowchart 
6. PowerPoint Presentation 
7. Demonstration during Final Examination Week
