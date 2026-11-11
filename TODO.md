### TODO LIST

Legend: [x] done · [~] partial · [ ] missing

## CUSTOMER ROLE

- [ ] Forgot password function
  - Login form link is currently `href="#"`; only admin-issued reset tokens work. Needs self-service "request reset link" endpoint + page.
- [ ] Profile header dropdown menu (profile and sign out)
  - `DashboardHeader` shows avatar/name only; sign out only exists in the sidebar.
- [x] Remove the need to refresh — make real-time API calls
  - `usePolling` now refreshes customer, teller, and admin screens every 10s while the tab is visible; `NotificationsDropdown` polls every 60s.
- [ ] Replace "report lost card" with "disable card" instead. User fills out a form about their lost card if they request a replacement.
  - Currently creates a `card_lost` request with a fixed note. No disable action, no form fields, no disable endpoint.

## TELLER UI

### 1. Dashboard
- [x] Pending Requests – number of deposit/withdrawal requests awaiting approval.
- [x] Today's Transactions – deposit/withdrawal totals from completed teller transactions (`/teller/transactions` summary).
- [x] Recent Activity – lists the teller's most recent processed transactions with customer, account, amount, and reference.
- [x] Quick Actions – shortcuts to the pending request queue and customer transaction processing.

### 2. Transaction Requests
- [x] Request Queue – all customer-submitted deposit/withdrawal/card requests.
- [x] Request Details – full detail modal with customer, account, type, amount, dates, reviewer, transaction ID, verification, and per-request reference number.
- [x] Request Filtering – status, type, and date filters.
- [x] Request Search – by customer name, email, account number, or reference number.
- [x] Request Status – Pending / Approved / Rejected / Cancelled.

### 3. Request Processing
- [x] View Request – full detail view of a request.
- [x] Verify Customer / Verify Account – detail modal verifies via `/teller/accounts/:id`; Customers page shows profiles and account status.
- [x] Approve Request.
- [x] Reject Request – with required reason, recorded in audit trail.
- [x] Process Deposit / Process Withdrawal – tellers can approve requests or process walk-in deposits/withdrawals directly from the Transactions page.
- [x] Mark as Completed – approval creates the completed transaction immediately; no separate completion status is needed.
- [x] Generate Receipt – approving a deposit/withdrawal request surfaces the receipt modal for the generated transaction.

### 4. Customer & Account Information
- [x] Customer Profile – searchable customer lookup with contact details.
- [x] Account Details – accounts, balances, and status per customer.
- [x] Transaction History – per-account history (`/teller/accounts/:id/transactions`).
- [x] Account Verification – visible in the request detail modal and customer lookup.

### 5. Transaction Management
- [x] Transaction Records / History – global list of the signed-in teller's processed transactions plus per-account history.
- [x] Transaction Details – receipt modal shows reference, account, amount, balance, note, and status.
- [x] Transaction Reversal – admin-only by design; intentionally not exposed to tellers.
- [x] Print Receipt – reuses the existing receipt modal/print view.

### 6. Notifications
- [x] New Request Alert – active tellers are notified when a deposit, withdrawal, or card request is submitted.
- [x] Request Updates – other active tellers are notified when a request is approved or rejected.
- [~] Customer Notifications – backend pushes transaction/request status updates to customers.
- [~] Rejection Notification – backend notifies customer with reason; confirm message includes reason.

### 7. Reports
- [x] Daily Transaction Report / Transaction Summary / Export Report – teller Reports page with date range, deposit/withdrawal/net summaries, request outcomes, daily table, and CSV export.

### 8. Teller Account & Security
- [x] Teller Profile – profile page with display name and password change; the sidebar shows the saved display name, falling back to "Teller User".
- [x] Login/Logout.
- [~] Role-Based Access – enforced in backend; teller-visible permission surface deferred.


### Teller Sidebar
- [x] Dashboard
- [x] Transactions
- [x] Customers
- [x] Reports – daily transaction report and CSV export
- [x] Notifications – bell in each teller page header with new-request alerts
- [x] Profile
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

### ADMIN UI - final revisions
- [X] Search function in admin is not working
- [X] Larger button on generate and restore backup - both must come from the file management system of the admin, user can decide the file path before downloading.
- [X] warning form in system settings
- [X] @frontend/ the customer column must be aligned left
- [X] @frontend/ change buttons on Reports & analytics, Database backups, settings, and admin settings (must be similar to the button of the other pages)
