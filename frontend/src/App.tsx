import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import SignInPage from './pages/auth/SignInPage';
import TellerLoginPage from './pages/auth/TellerLoginPage';
import AdminLoginPage from './pages/auth/AdminLoginPage';
import SignUpPage from './pages/auth/SignUpPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import TermsPage from './pages/legal/TermsPage';
import PrivacyPage from './pages/legal/PrivacyPage';
import AdminLayout from './components/admin/AdminLayout';
import TellerLayout from './components/teller/TellerLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminApplicationsPage from './pages/admin/AdminApplicationsPage';
import AdminCardRequestsPage from './pages/admin/AdminCardRequestsPage';
import AdminLogsPage from './pages/admin/AdminLogsPage';
import AdminBackupsPage from './pages/admin/AdminBackupsPage';
import TellerDashboardPage from './pages/teller/TellerDashboardPage';
import TellerRequestsPage from './pages/teller/TellerRequestsPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import AccountsPage from './pages/dashboard/AccountsPage';
import DepositPage from './pages/dashboard/DepositPage';
import WithdrawPage from './pages/dashboard/WithdrawPage';
import TransferPage from './pages/dashboard/TransferPage';
import HistoryPage from './pages/dashboard/HistoryPage';
import RequestsPage from './pages/dashboard/RequestsPage';
import ProfilePage from './pages/dashboard/ProfilePage';
import PlaceholderPage from './pages/dashboard/PlaceholderPage';
import { AccountProvider } from './context/AccountContext';
import { getAuthToken } from './api/client';
import type { TokenScope } from './api/client';

const AccountLayout = () => (
  <AccountProvider>
    <Outlet />
  </AccountProvider>
);

const RequireToken = ({ scope, redirectTo }: { scope: TokenScope; redirectTo: string }) =>
  getAuthToken(scope) ? <Outlet /> : <Navigate to={redirectTo} replace />;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<SignInPage />} />
        <Route path="/signin" element={<Navigate to="/login" replace />} />
        <Route path="/teller/login" element={<TellerLoginPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        <Route element={<RequireToken scope="admin" redirectTo="/admin/login" />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="applications" element={<AdminApplicationsPage />} />
            <Route path="card-requests" element={<AdminCardRequestsPage />} />
            <Route path="logs" element={<AdminLogsPage />} />
            <Route path="backups" element={<AdminBackupsPage />} />
          </Route>
        </Route>

        <Route element={<RequireToken scope="teller" redirectTo="/teller/login" />}>
          <Route path="/teller" element={<TellerLayout />}>
            <Route index element={<Navigate to="/teller/dashboard" replace />} />
            <Route path="dashboard" element={<TellerDashboardPage />} />
            <Route path="requests" element={<TellerRequestsPage />} />
          </Route>
        </Route>

        <Route element={<RequireToken scope="customer" redirectTo="/login" />}>
          <Route element={<AccountLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/accounts" element={<AccountsPage />} />
            <Route path="/dashboard/deposit" element={<DepositPage />} />
            <Route path="/dashboard/withdraw" element={<WithdrawPage />} />
            <Route path="/dashboard/transfer" element={<TransferPage />} />
            <Route path="/dashboard/history" element={<HistoryPage />} />
            <Route path="/dashboard/requests" element={<RequestsPage />} />
            <Route path="/dashboard/profile" element={<ProfilePage />} />
            <Route
              path="/dashboard/insights"
              element={
                <PlaceholderPage
                  title="AI Insights"
                  description="Detailed spending analysis for your accounts will appear here."
                />
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
