import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { ApiError } from '@/api/client';
import { listAccounts } from '@/api/accounts';
import type { Account } from '@/api/accounts';

const SELECTED_ACCOUNT_KEY = 'gellybank.selectedAccountId';

interface AccountContextValue {
  accounts: Account[];
  selectedAccount: Account | null;
  selectedAccountId: string | null;
  selectAccount: (id: string) => void;
  refresh: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export const AccountProvider = ({ children }: { children: ReactNode }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : window.localStorage.getItem(SELECTED_ACCOUNT_KEY),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController>();

  const refresh = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const data = await listAccounts(controller.signal);
      setAccounts(data);
      setSelectedAccountId((current) => {
        if (current && data.some((account) => account.id === current)) return current;
        const primary = data.find((account) => account.isPrimary) ?? data[0];
        return primary ? primary.id : null;
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof ApiError ? err.message : 'Unable to load your accounts.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => controllerRef.current?.abort();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedAccountId) {
      window.localStorage.setItem(SELECTED_ACCOUNT_KEY, selectedAccountId);
    } else {
      window.localStorage.removeItem(SELECTED_ACCOUNT_KEY);
    }
  }, [selectedAccountId]);

  const selectAccount = useCallback((id: string) => setSelectedAccountId(id), []);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null,
    [accounts, selectedAccountId],
  );

  const value = useMemo<AccountContextValue>(
    () => ({
      accounts,
      selectedAccount,
      selectedAccountId: selectedAccount?.id ?? null,
      selectAccount,
      refresh,
      loading,
      error,
    }),
    [accounts, selectedAccount, selectAccount, refresh, loading, error],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
};

export const useAccounts = (): AccountContextValue => {
  const context = useContext(AccountContext);
  if (!context) throw new Error('useAccounts must be used within an AccountProvider');
  return context;
};
