### TODO LIST

Legend: [x] done · [~] partial · [ ] missing

## CUSTOMER ROLE

- [ ] Forgot password function
  - Login form link is currently `href="#"`; only admin-issued reset tokens work. Needs self-service "request reset link" endpoint + page.
- [ ] Profile header dropdown menu (profile and sign out)
  - `DashboardHeader` shows avatar/name only; sign out only exists in the sidebar.
- [ ] Remove the need to refresh — make real-time API calls
  - Only `NotificationsDropdown` polls (60s). Dashboard, accounts, requests, history, teller queue, and admin pages all fetch once on mount.
- [ ] Replace "report lost card" with "disable card" instead. User fills out a form about their lost card if they request a replacement.
  - Currently creates a `card_lost` request with a fixed note. No disable action, no form fields, no disable endpoint.

## TELLER UI

### 1. Dashboard
- [~] Pending Requests – number of deposit/withdrawal requests awaiting approval.
- [~] Today's Transactions – deposit/withdrawal totals for the day (approved requests only; no completed-transaction totals).
- [~] Recent Activity – lists recent *requests*, not teller transactions.
- [ ] Quick Actions – shortcuts to pending requests and customer transactions.

### 2. Transaction Requests
- [~] Request Queue – all customer-submitted deposit/withdrawal/card requests.
- [~] Request Details – customer, account, type, amount, date shown inline. Missing: reference number and a detail view.
- [~] Request Filtering – status filter only. Missing: type and date filters.
- [ ] Request Search – by customer name, account number, or reference number.
- [x] Request Status – Pending / Approved / Rejected / Cancelled.

### 3. Request Processing
- [ ] View Request – full detail view of a request.
- [ ] Verify Customer / Verify Account – backend APIs exist (`/teller/customers`, `/teller/accounts/:id`) but have no UI.
- [x] Approve Request.
- [x] Reject Request – with required reason, recorded in audit trail.
- [~] Process Deposit / Process Withdrawal – happens on approve; no separate verify-then-process steps.
- [ ] Mark as Completed – statuses are fixed to pending/approved/rejected/cancelled.
- [ ] Generate Receipt.

### 4. Customer & Account Information
- [ ] Customer Profile – no teller UI (backend API exists).
- [ ] Account Details – no teller UI (backend API exists).
- [ ] Transaction History – no teller UI (`/teller/accounts/:id/transactions` exists).
- [ ] Account Verification – happens implicitly on approve; no explicit UI.

### 5. Transaction Management
- [ ] Transaction Records / History – no teller transactions page.
- [ ] Transaction Details.
- [ ] Transaction Reversal.
- [ ] Print Receipt.

### 6. Notifications
- [ ] New Request Alert – tellers receive no notifications (backend only notifies customers).
- [ ] Request Updates – teller-side alerts on status changes.
- [~] Customer Notifications – backend pushes transaction/request status updates to customers.
- [~] Rejection Notification – backend notifies customer with reason; confirm message includes reason.

### 7. Cash Management
- [ ] Cash Balance / Cash In / Cash Out / Cash Summary / Cash Reconciliation – entirely missing (no UI, API, or tables).

### 8. Reports
- [ ] Daily Transaction Report / Transaction Summary / Cash Report / Export Report – entirely missing.

### 9. Teller Account & Security
- [ ] Teller Profile – no profile page; sidebar now shows the real staff name via `/api/auth/me` (none set on the account, so it falls back to the username until a display name feature exists).
- [x] Login/Logout.
- [~] Role-Based Access – enforced in backend; no teller-visible permission surface.
- [ ] Activity Logs – admin-only audit page; teller has no view of own actions.
- [ ] Session Timeout – no idle logout anywhere in the app.

### Teller Sidebar
- [x] Dashboard
- [ ] Transactions
- [ ] Customers
- [ ] Cash Management
- [ ] Reports
- [ ] Notifications
- [ ] Profile
- [x] Logout

## ADMIN UI

### 1. Admin Dashboard
- [x] Total Users / Total Customers / Total Tellers / Total Transactions.
- [x] Pending Requests – teller transaction requests + card requests.
- [x] Transaction Overview – deposit/withdrawal statistics (today + lifetime).
- [x] System Activity – recent system/user activity feed.
- [x] Total Accounts / System Health.

### 2. User Management
- [x] Customer/Teller/Admin management – role/status filters, create user, detail view.
- [x] User Roles – role dropdown per user.
- [x] Account Status – activate/suspend.
- [x] Password Reset – admin issues one-time reset link.

### 3. Transaction Management
- [x] All Transactions / Search / Details / Monitoring – filters by type, status, date, customer.
- [ ] Transaction Verification – suspicious/unusual activity review.
- [x] Transaction Reversal – audited compensating adjustment (admin-only).
- [x] Transaction Reports – reports page.

### 4. Account Management
- [x] All Bank Accounts / Account Details / Account Status – search, status tabs, freeze/unfreeze/close/reopen.
- [ ] Account Verification – happens on application approval; no explicit review UI.
- [ ] Account Monitoring – activity/transaction-pattern monitoring.

### 5. Reports & Analytics
- [x] Transaction Reports / Teller Reports / Customer Reports / Financial Summary – date-range cards + summaries.
- [x] Export Reports – Excel-compatible CSV export.

### 6. Audit Logs & Security
- [x] Audit Logs – read-only table with severity/actor/action/entity/date filters.
- [ ] User Activity Logs – no customer/staff activity breakdown.
- [x] Login History – derived from the audit trail with email/date filters.
- [x] Security Monitoring – 24h/1h security summary (failed logins, lockouts, resets).
- [ ] Permission Management – granular control of sensitive functions.
- [x] System Access Logs – LOGIN_SUCCESS audit + login history tab.

### 7. System Settings
- [x] Bank Information – name, logo, contact details (applies site-wide).
- [x] Maintenance Mode – DB-backed, blocks customer/teller APIs; admin/auth stay available.

### 8. Database Backup
- [x] List and download backups (created via `scripts/backup_db.sh`).
- [x] Generate Backup File – button that creates and auto-downloads a backup.
- [x] Restore – dropdown + typed `RESTORE` confirmation, audited WARN entry.

### Admin Sidebar
- [x] Dashboard
- [x] User Management
- [x] Account Management
- [x] Transaction Management
- [x] Reports & Analytics
- [x] Audit Logs
- [x] System Settings
- [x] Database Backup
- [x] Admin Profile – display name (screen-wide) + password change.
- [x] Logout
