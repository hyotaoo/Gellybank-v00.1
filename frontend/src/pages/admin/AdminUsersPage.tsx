import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '@/api/client';
import {
  createAdminUser,
  getAdminUser,
  issuePasswordReset,
  listAdminUsers,
  updateAdminUser,
} from '@/api/admin';
import type {
  AdminAccountSummary,
  AdminRole,
  AdminStatus,
  AdminUser,
  AdminUserDetail,
} from '@/api/admin';
import Button from '@/components/common/Button';
import Field from '@/components/common/Field';
import Input from '@/components/common/Input';
import PasswordField from '@/components/auth/PasswordField';
import Select from '@/components/common/Select';
import { useToast } from '@/components/common/Toast';
import usePolling from '@/hooks/usePolling';
import { formatCurrency } from '@/utils/format';

const ROLES: (AdminRole | 'all')[] = ['all', 'customer', 'teller', 'admin'];
const STATUSES: (AdminStatus | 'all')[] = ['all', 'active', 'suspended'];

const overlay = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4';
const modal = 'w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl';

const AdminUsersPage = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<AdminRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AdminStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [resetToken, setResetToken] = useState<string>();
  const [busyId, setBusyId] = useState<string>();
  const toast = useToast();

  const [creating, setCreating] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<'teller' | 'admin'>('teller');
  const [creatingUser, setCreatingUser] = useState(false);

  const [detail, setDetail] = useState<AdminUserDetail>();
  const [detailLoading, setDetailLoading] = useState(false);

  const refresh = async (term = search, silent = false) => {
    if (!silent) setLoading(true);
    setError(undefined);
    try {
      setUsers(await listAdminUsers(term, {
        role: roleFilter === 'all' ? undefined : roleFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, statusFilter]);

  // Keep the user list current without a manual reload.
  usePolling(() => { void refresh(search, true); });

  const changeUser = async (user: AdminUser, update: { role?: AdminRole; isActive?: boolean }) => {
    setBusyId(user.id);
    setError(undefined);
    try {
      const updated = await updateAdminUser(user.id, update);
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (detail?.id === updated.id) setDetail((current) => current && { ...current, ...updated });
      toast.success(`${updated.email} was updated.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to update this user.');
    } finally {
      setBusyId(undefined);
    }
  };

  const createResetToken = async (user: AdminUser) => {
    setBusyId(user.id);
    setError(undefined);
    setResetToken(undefined);
    try {
      const result = await issuePasswordReset(user.id);
      setResetToken(new URL(`/reset-password#token=${encodeURIComponent(result.resetToken)}`, window.location.origin).toString());
      toast.success(`Password reset link issued for ${user.email}.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to issue a reset token.');
    } finally {
      setBusyId(undefined);
    }
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatingUser(true);
    setError(undefined);
    try {
      const created = await createAdminUser({
        email: createEmail.trim(),
        password: createPassword,
        role: createRole,
      });
      toast.success(`Created an ${createRole} account for ${created.email}.`);
      setCreating(false);
      setCreateEmail('');
      setCreatePassword('');
      setCreateRole('teller');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to create this account.');
    } finally {
      setCreatingUser(false);
    }
  };

  const openDetail = async (user: AdminUser) => {
    setError(undefined);
    setDetailLoading(true);
    setDetail(undefined);
    try {
      setDetail(await getAdminUser(user.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load this user.');
    } finally {
      setDetailLoading(false);
    }
  };

  const accountRow = (account: AdminAccountSummary) => (
    <div key={account.id} className="rounded-xl border border-surface-line px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{account.accountNumber}</span>
        <span className="rounded-full bg-surface-card px-3 py-0.5 text-xs font-semibold capitalize">{account.status}</span>
      </div>
      <p className="mt-1 text-xs text-muted">
        {account.label} · <span className="font-semibold text-ink">{formatCurrency(account.balance, account.currency)}</span>
      </p>
    </div>
  );

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-primary">Manage users</h1>
        </div>
        <Button type="button" className="h-[44px] px-5 text-[14px] font-semibold" onClick={() => setCreating(true)}>
          Create staff account
        </Button>
      </header>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void refresh();
        }}
      >
        <input
          aria-label="Search users"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by ID, name, or email"
          className="min-w-0 flex-1 rounded-xl border border-surface-line bg-white px-4 py-3 outline-none focus:border-primary"
        />
        <button type="submit" className="rounded-xl bg-primary px-5 font-semibold text-ink">Search</button>
      </form>

      <div className="flex flex-wrap gap-2">
        {ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setRoleFilter(role)}
            className={`rounded-full px-4 py-2 text-xs font-semibold capitalize transition-colors ${
              roleFilter === role
                ? 'bg-primary text-ink'
                : 'border border-surface-line bg-white text-muted hover:bg-surface-card'
            }`}
          >
            {role === 'all' ? 'All roles' : `${role}s`}
          </button>
        ))}
        <span className="mx-1 hidden w-px self-stretch bg-surface-line sm:block" />
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-full px-4 py-2 text-xs font-semibold capitalize transition-colors ${
              statusFilter === status
                ? 'bg-primary text-ink'
                : 'border border-surface-line bg-white text-muted hover:bg-surface-card'
            }`}
          >
            {status === 'all' ? 'All statuses' : status}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {resetToken && (
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="font-semibold">One-time password reset link</p>
          <a href={resetToken} className="mt-1 block break-all font-mono text-sm text-primary underline">{resetToken}</a>
          <p className="mt-2 text-xs text-muted">Share securely with the user. It expires in one hour and is shown only once.</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-surface-line bg-white">
        {loading ? (
          <p role="status" className="p-6 text-sm text-muted">Loading users…</p>
        ) : (
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-surface-soft text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-surface-line">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void openDetail(user)}
                      className="font-medium text-primary hover:underline"
                    >
                      {user.name}
                    </button>
                  </td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Role for ${user.name}`}
                      value={user.role}
                      disabled={busyId === user.id}
                      onChange={(event) => void changeUser(user, { role: event.target.value as AdminRole })}
                      className="rounded-lg border border-surface-line bg-white px-2 py-1"
                    >
                      <option value="customer">Customer</option><option value="teller">Teller</option><option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 capitalize">{user.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === user.id}
                        onClick={() => void changeUser(user, { isActive: user.status !== 'active' })}
                        className="rounded-lg border border-surface-line px-3 py-1.5 hover:bg-surface-card disabled:opacity-50"
                      >
                        {user.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === user.id}
                        onClick={() => void createResetToken(user)}
                        className="rounded-lg border border-surface-line px-3 py-1.5 hover:bg-surface-card disabled:opacity-50"
                      >
                        Reset password
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No users match these filters.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <div className={overlay}>
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-user-title"
            className={modal}
            onSubmit={submitCreate}
          >
            <h2 id="create-user-title" className="text-xl font-semibold">Create staff account</h2>
            <p className="mt-2 text-sm text-muted">
              Customers sign up through the public registration form. Accounts created here are tellers or admins.
            </p>
            <div className="mt-4 flex flex-col gap-4">
              <Field label="Email address">
                <Input
                  type="email"
                  value={createEmail}
                  onChange={(event) => setCreateEmail(event.target.value)}
                  placeholder="name@gellybank.com"
                  autoComplete="off"
                  required
                />
              </Field>
              <div>
                <PasswordField
                  label="Temporary password"
                  value={createPassword}
                  onChange={setCreatePassword}
                  autoComplete="new-password"
                />
                <p className="mt-2 text-[12px] leading-[1.21] text-muted">
                  8+ characters with at least one letter and one number. The user can change it after signing in.
                </p>
              </div>
              <Field label="Role">
                <Select value={createRole} onChange={(event) => setCreateRole(event.target.value as 'teller' | 'admin')}>
                  <option value="teller">Teller</option>
                  <option value="admin">Admin</option>
                </Select>
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-xl border border-surface-line px-4 py-2"
              >
                Cancel
              </button>
              <Button type="submit" disabled={creatingUser} className="rounded-xl px-4 py-2 font-semibold">
                {creatingUser ? 'Creating…' : 'Create account'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {(detail || detailLoading) && (
        <div className={overlay}>
          <div role="dialog" aria-modal="true" aria-labelledby="user-detail-title" className={modal}>
            <div className="flex items-start justify-between gap-3">
              <h2 id="user-detail-title" className="text-xl font-semibold">
                {detailLoading ? 'Loading user…' : 'User details'}
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => { setDetail(undefined); }}
                className="rounded-full text-muted transition-colors hover:text-primary"
              >
                ✕
              </button>
            </div>

            {detail && (
              <>
                <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted">Name</dt><dd className="font-semibold">{detail.name}</dd></div>
                  <div><dt className="text-muted">Email</dt><dd className="break-all font-semibold">{detail.email}</dd></div>
                  <div><dt className="text-muted">Role</dt><dd className="capitalize">{detail.role}</dd></div>
                  <div><dt className="text-muted">Status</dt><dd className="capitalize">{detail.status}</dd></div>
                  <div><dt className="text-muted">Email verified</dt><dd>{detail.emailVerified ? 'Yes' : 'No'}</dd></div>
                  <div><dt className="text-muted">Last login</dt><dd>{detail.lastLoginAt ? new Date(detail.lastLoginAt).toLocaleString() : '—'}</dd></div>
                  <div><dt className="text-muted">Created</dt><dd>{detail.createdAt ? new Date(detail.createdAt).toLocaleString() : '—'}</dd></div>
                  {detail.customerStatus && (
                    <div><dt className="text-muted">Customer status</dt><dd className="capitalize">{detail.customerStatus}</dd></div>
                  )}
                  {detail.phone && (
                    <div><dt className="text-muted">Phone</dt><dd>{detail.phone}</dd></div>
                  )}
                  {detail.address && (
                    <div className="sm:col-span-2"><dt className="text-muted">Address</dt><dd>{detail.address}</dd></div>
                  )}
                </dl>

                {detail.accounts.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold">Accounts ({detail.accounts.length})</p>
                    <div className="mt-2 flex flex-col gap-2">
                      {detail.accounts.map(accountRow)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminUsersPage;
