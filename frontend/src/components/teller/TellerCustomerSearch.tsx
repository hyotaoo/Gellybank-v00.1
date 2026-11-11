import { useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import { listTellerCustomers } from '@/api/teller';
import type { TellerCustomer } from '@/api/teller';

interface TellerCustomerSearchProps {
  selectedId?: string;
  onSelect: (customer: TellerCustomer) => void;
}

const statusTone: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  suspended: 'bg-red-50 text-red-700',
  closed: 'bg-gray-100 text-gray-600',
};

const TellerCustomerSearch = ({ selectedId, onSelect }: TellerCustomerSearchProps) => {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<TellerCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = async (value = '') => {
    setLoading(true);
    setError(undefined);
    try {
      setCustomers(await listTellerCustomers(value));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to look up customers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="flex flex-col gap-4 rounded-[24px] border border-surface-line bg-white p-5">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void load(search);
        }}
      >
        <input
          aria-label="Search customers"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or email"
          className="min-w-[220px] flex-1 rounded-xl border border-surface-line bg-white px-4 py-3 outline-none focus:border-primary"
        />
        <button type="submit" className="rounded-xl bg-primary px-5 font-semibold text-ink">
          Search
        </button>
      </form>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {loading ? (
        <p role="status" className="py-4 text-sm text-muted">Loading customers…</p>
      ) : customers.length === 0 ? (
        <p className="py-4 text-sm text-muted">No matching customers.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {customers.map((customer) => (
            <li key={customer.customerId}>
              <button
                type="button"
                onClick={() => onSelect(customer)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                  selectedId === customer.customerId
                    ? 'border-primary bg-surface-card'
                    : 'border-surface-line hover:bg-surface-card/60'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{customer.name}</span>
                  <span
                    className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                      statusTone[customer.status] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {customer.status}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted">{customer.email}</span>
                <span className="mt-1 block text-xs text-muted">
                  {customer.accounts.length} account{customer.accounts.length === 1 ? '' : 's'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default TellerCustomerSearch;
