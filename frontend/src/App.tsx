import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { BankSettingsProvider, useBankSettings } from './context/BankSettingsContext';
import MaintenancePage from './pages/MaintenancePage';
import { ToastProvider } from './components/common/Toast';
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
import AdminAccountsPage from './pages/admin/AdminAccountsPage';
import AdminTransactionsPage from './pages/admin/AdminTransactionsPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import AdminProfilePage from './pages/admin/AdminProfilePage';
import TellerDashboardPage from './pages/teller/TellerDashboardPage';
import TellerRequestsPage from './pages/teller/TellerRequestsPage';
import TellerTransactionsPage from './pages/teller/TellerTransactionsPage';
import TellerCustomersPage from './pages/teller/TellerCustomersPage';
import TellerReportsPage from './pages/teller/TellerReportsPage';
import TellerProfilePage from './pages/teller/TellerProfilePage';
import DashboardPage from './pages/dashboard/DashboardPage';
import AccountsPage from './pages/dashboard/AccountsPage';
import DepositPage from './pages/dashboard/DepositPage';
import WithdrawPage from './pages/dashboard/WithdrawPage';
import TransferPage from './pages/dashboard/TransferPage';
import HistoryPage from './pages/dashboard/HistoryPage';
import RequestsPage from './pages/dashboard/RequestsPage';
import ProfilePage from './pages/dashboard/ProfilePage';
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

const RequireBankOpen = () => {
  const { settings, loaded } = useBankSettings();
  if (!loaded) return null;
  if (settings.maintenanceMode) return <MaintenancePage />;
  return <Outlet />;
};

function App() {
  return (
    <BankSettingsProvider>
      <ToastProvider>
      <BrowserRouter>
      <Routes>
        <Route element={<RequireBankOpen />}>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<SignInPage />} />
          <Route path="/teller/login" element={<TellerLoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        <Route element={<RequireToken scope="admin" redirectTo="/admin/login" />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="accounts" element={<AdminAccountsPage />} />
            <Route path="transactions" element={<AdminTransactionsPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="applications" element={<AdminApplicationsPage />} />
            <Route path="card-requests" element={<AdminCardRequestsPage />} />
            <Route path="logs" element={<AdminLogsPage />} />
            <Route path="backups" element={<AdminBackupsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="profile" element={<AdminProfilePage />} />
          </Route>
        </Route>

        <Route element={<RequireBankOpen />}>
          <Route element={<RequireToken scope="teller" redirectTo="/teller/login" />}>
            <Route path="/teller" element={<TellerLayout />}>
              <Route index element={<Navigate to="/teller/dashboard" replace />} />
              <Route path="dashboard" element={<TellerDashboardPage />} />
              <Route path="requests" element={<TellerRequestsPage />} />
              <Route path="transactions" element={<TellerTransactionsPage />} />
              <Route path="customers" element={<TellerCustomersPage />} />
              <Route path="reports" element={<TellerReportsPage />} />
              <Route path="profile" element={<TellerProfilePage />} />
            </Route>
          </Route>
        </Route>

        <Route element={<RequireBankOpen />}>
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
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
      </ToastProvider>
    </BankSettingsProvider>
  );
}

export default App;
