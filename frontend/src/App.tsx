import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import SignInPage from './pages/auth/SignInPage';
import TellerLoginPage from './pages/auth/TellerLoginPage';
import AdminLoginPage from './pages/auth/AdminLoginPage';
import SignUpPage from './pages/auth/SignUpPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminApplicationsPage from './pages/admin/AdminApplicationsPage';
import AdminLogsPage from './pages/admin/AdminLogsPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import AccountsPage from './pages/dashboard/AccountsPage';
import DepositPage from './pages/dashboard/DepositPage';
import WithdrawPage from './pages/dashboard/WithdrawPage';
import TransferPage from './pages/dashboard/TransferPage';
import HistoryPage from './pages/dashboard/HistoryPage';
import PlaceholderPage from './pages/dashboard/PlaceholderPage';
import { AccountProvider } from './context/AccountContext';

const AccountLayout = () => (
  <AccountProvider>
    <Outlet />
  </AccountProvider>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<SignInPage />} />
        <Route path="/teller/login" element={<TellerLoginPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="applications" element={<AdminApplicationsPage />} />
          <Route path="logs" element={<AdminLogsPage />} />
        </Route>

        <Route element={<AccountLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/accounts" element={<AccountsPage />} />
          <Route path="/dashboard/deposit" element={<DepositPage />} />
          <Route path="/dashboard/withdraw" element={<WithdrawPage />} />
          <Route path="/dashboard/transfer" element={<TransferPage />} />
          <Route path="/dashboard/history" element={<HistoryPage />} />
          <Route
            path="/dashboard/insights"
            element={
              <PlaceholderPage
                title="AI Insights"
                description="Detailed spending analysis for your accounts will appear here."
              />
            }
          />
          <Route
            path="/dashboard/profile"
            element={
              <PlaceholderPage
                title="Profile"
                description="Manage your personal details, security, and preferences here."
              />
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
