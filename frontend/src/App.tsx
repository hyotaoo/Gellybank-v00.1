import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import SignInPage from './pages/auth/SignInPage';
import SignUpPage from './pages/auth/SignUpPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import AccountsPage from './pages/dashboard/AccountsPage';
import DepositPage from './pages/dashboard/DepositPage';
import WithdrawPage from './pages/dashboard/WithdrawPage';
import TransferPage from './pages/dashboard/TransferPage';
import HistoryPage from './pages/dashboard/HistoryPage';
import NotificationsPage from './pages/dashboard/NotificationsPage';
import PlaceholderPage from './pages/dashboard/PlaceholderPage';
import { AccountProvider } from './context/AccountContext';
import { NotificationProvider } from './context/NotificationContext';

const AccountLayout = () => (
  <NotificationProvider>
    <AccountProvider>
      <Outlet />
    </AccountProvider>
  </NotificationProvider>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        <Route element={<AccountLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/accounts" element={<AccountsPage />} />
          <Route path="/dashboard/deposit" element={<DepositPage />} />
          <Route path="/dashboard/withdraw" element={<WithdrawPage />} />
          <Route path="/dashboard/transfer" element={<TransferPage />} />
          <Route path="/dashboard/history" element={<HistoryPage />} />
          <Route path="/dashboard/notifications" element={<NotificationsPage />} />
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

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
