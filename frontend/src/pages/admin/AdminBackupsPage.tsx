import { useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import { downloadBackup, listBackups } from '@/api/admin';
import type { BackupFile } from '@/api/admin';

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const AdminBackupsPage = () => {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [downloading, setDownloading] = useState<string>();

  const refresh = async () => {
    setLoading(true);
    setError(undefined);
    try {
      setBackups(await listBackups());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load backups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleDownload = async (name: string) => {
    setDownloading(name);
    setError(undefined);
    try {
      const blob = await downloadBackup(name);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to download the backup.');
    } finally {
      setDownloading(undefined);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-primary">Database backups</h1>
        <p className="mt-2 text-sm text-muted">
          Download a copy of the database dump. Backups are created with scripts/backup_db.sh.
        </p>
      </header>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="overflow-x-auto rounded-2xl border border-surface-line bg-white">
        {loading ? (
          <p role="status" className="p-6 text-sm text-muted">Loading backups…</p>
        ) : (
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-surface-soft text-muted">
              <tr><th className="px-4 py-3">File</th><th className="px-4 py-3">Size</th><th className="px-4 py-3">Created</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr key={backup.name} className="border-t border-surface-line">
                  <td className="px-4 py-3 font-medium text-ink">{backup.name}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatSize(backup.size)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{backup.createdAt ? new Date(backup.createdAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDownload(backup.name)}
                      disabled={downloading === backup.name}
                      className="rounded-xl bg-primary px-4 py-2 font-semibold text-ink disabled:opacity-60"
                    >
                      {downloading === backup.name ? 'Downloading…' : 'Download'}
                    </button>
                  </td>
                </tr>
              ))}
              {backups.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">No backups found. Run scripts/backup_db.sh to create one.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};

export default AdminBackupsPage;
