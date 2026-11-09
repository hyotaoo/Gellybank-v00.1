import { useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import {
  downloadBackup,
  generateBackup,
  listBackups,
  restoreBackup,
} from '@/api/admin';
import type { BackupFile } from '@/api/admin';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';

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
  const [generating, setGenerating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreName, setRestoreName] = useState('');
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [showRestoreForm, setShowRestoreForm] = useState(false);

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

  const triggerDownload = (name: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownload = async (name: string) => {
    setDownloading(name);
    setError(undefined);
    try {
      triggerDownload(name, await downloadBackup(name));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to download the backup.');
    } finally {
      setDownloading(undefined);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(undefined);
    try {
      const result = await generateBackup();
      if (result.generated) {
        try {
          triggerDownload(result.generated, await downloadBackup(result.generated));
        } catch {
          // Download is a convenience; the file still exists server-side.
        }
      }
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to generate a backup.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setError(undefined);
    try {
      await restoreBackup(restoreName);
      await refresh();
      setShowRestoreForm(false);
      setRestoreName('');
      setRestoreConfirm('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to restore the backup.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-primary">Database backups</h1>
      </header>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void handleGenerate()} disabled={generating}>
          {generating ? 'Generating…' : 'Generate backup'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setShowRestoreForm((open) => !open);
            setRestoreConfirm('');
          }}
          disabled={backups.length === 0 && !showRestoreForm}
        >
          {showRestoreForm ? 'Cancel restore' : 'Restore a backup'}
        </Button>
      </div>

      {showRestoreForm && (
        <div className="flex flex-col gap-4 rounded-2xl border border-red-300 bg-red-50 p-5">
          <p className="text-sm font-medium text-ink">
            Restoring overwrites the entire database with the contents of the selected dump. Use
            this only to recover from data loss.
          </p>
          <label className="flex flex-col gap-2 text-sm font-medium text-ink">
            Backup file
            <div className="max-w-md">
              <Select
                value={restoreName}
                onChange={(event) => setRestoreName(event.target.value)}
              >
                <option value="">Select a backup…</option>
                {backups.map((backup) => (
                  <option key={backup.name} value={backup.name}>
                    {backup.name}
                  </option>
                ))}
              </Select>
            </div>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-ink">
            Type RESTORE to confirm
            <div className="max-w-md">
              <Input
                value={restoreConfirm}
                onChange={(event) => setRestoreConfirm(event.target.value)}
                placeholder="RESTORE"
                autoComplete="off"
              />
            </div>
          </label>
          <div>
            <button
              type="button"
              onClick={() => void handleRestore()}
              disabled={restoring || !restoreName || restoreConfirm !== 'RESTORE'}
              className="rounded-[20px] bg-red-700 px-4 py-2 font-semibold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {restoring ? 'Restoring…' : 'Restore database'}
            </button>
          </div>
        </div>
      )}

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
              {backups.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">No backups yet. Generate one above.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};

export default AdminBackupsPage;
