import { useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import { issuePasswordReset, listAdminUsers, updateAdminUser } from '@/api/admin';
import type { AdminRole, AdminUser } from '@/api/admin';

const AdminUsersPage = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [resetToken, setResetToken] = useState<string>();
  const [busyId, setBusyId] = useState<string>();

  const refresh = async (term = search) => {
    setLoading(true);
    setError(undefined);
    try {
      setUsers(await listAdminUsers(term));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh('');
  }, []);

  const changeUser = async (user: AdminUser, update: { role?: AdminRole; isActive?: boolean }) => {
    setBusyId(user.id);
    setError(undefined);
    try {
      const updated = await updateAdminUser(user.id, update);
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update this user.');
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to issue a reset token.');
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-primary">Manage users</h1>
        <p className="mt-2 text-sm text-muted">Update roles and access status for customer, teller, and admin accounts.</p>
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
                <th className="px-4 py-3">User ID</th><th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-surface-line">
                  <td className="px-4 py-3">{user.id}</td>
                  <td className="px-4 py-3">{user.name}</td>
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
              {users.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No users found.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};

export default AdminUsersPage;
