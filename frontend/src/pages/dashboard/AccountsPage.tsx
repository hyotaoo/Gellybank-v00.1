import { useState } from 'react';
import { ApiError } from '@/api/client';
import { closeAccount, updateAccount } from '@/api/accounts';
import type { Account } from '@/api/accounts';
import AccountCard from '@/components/dashboard/AccountCard';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import OpenAccountForm from '@/components/dashboard/OpenAccountForm';
import { useAccounts } from '@/context/AccountContext';

const AccountsPage = () => {
  const { accounts, loading, error, refresh } = useAccounts();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>();

  const handleSetPrimary = async (account: Account) => {
    setBusyId(account.id);
    setMessage(undefined);
    try {
      await updateAccount(account.id, { isPrimary: true });
      await refresh();
      setMessage(`${account.label} is now your primary account.`);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Unable to update the account.');
    } finally {
      setBusyId(null);
    }
  };

  const handleClose = async (account: Account) => {
    if (!window.confirm(`Close "${account.label}"? This cannot be undone.`)) return;
    setBusyId(account.id);
    setMessage(undefined);
    try {
      await closeAccount(account.id);
      await refresh();
      setMessage(`${account.label} closed.`);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Unable to close the account.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout title="Accounts">
      <div className="flex flex-1 flex-col gap-6 pb-2 lg:overflow-y-auto lg:pr-1">
        <OpenAccountForm />

        {message && (
          <p role="status" className="text-[13px] leading-[1.21] text-ink">
            {message}
          </p>
        )}

        {loading ? (
          <p className="text-[14px] text-muted">Loading accounts…</p>
        ) : error ? (
          <p className="text-[14px] text-red-600">{error}</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                busy={busyId === account.id}
                onSetPrimary={handleSetPrimary}
                onClose={handleClose}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AccountsPage;
