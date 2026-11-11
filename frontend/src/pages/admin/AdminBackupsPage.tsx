import { useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import {
  deleteBackup,
  deleteDatabase,
  downloadBackup,
  generateBackup,
  listBackups,
  restoreBackupFromFile,
} from '@/api/admin';
import type { BackupFile } from '@/api/admin';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import { useToast } from '@/components/common/Toast';
import usePolling from '@/hooks/usePolling';

const HEADER_BUTTON_CLASS = 'h-[48px] px-6 text-[15px] font-semibold';
const ROW_BUTTON_CLASS = 'h-[40px] px-5 text-[14px] font-semibold';

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
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [showRestoreForm, setShowRestoreForm] = useState(false);
  const [deleting, setDeleting] = useState<string>();
  const [deletingDatabase, setDeletingDatabase] = useState(false);
  const [deleteDbConfirm, setDeleteDbConfirm] = useState('');
  const [showDeleteDbForm, setShowDeleteDbForm] = useState(false);
  const toast = useToast();

  const refresh = async (silent = false) => {
    if (!silent) setLoading(true);
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

  // Keep the backup list current without a manual reload.
  usePolling(() => { void refresh(true); });

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
      toast.success(`Downloaded ${name}.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to download the backup.');
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
      toast.success('Backup generated.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to generate a backup.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteBackup = async (name: string) => {
    if (!window.confirm(`Delete backup "${name}"? This cannot be undone.`)) return;
    setDeleting(name);
    setError(undefined);
    try {
      await deleteBackup(name);
      await refresh();
      toast.success(`Deleted ${name}.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to delete the backup.');
    } finally {
      setDeleting(undefined);
    }
  };

  const handleDeleteDatabase = async () => {
    setDeletingDatabase(true);
    setError(undefined);
    try {
      await deleteDatabase();
      setShowDeleteDbForm(false);
      setDeleteDbConfirm('');
      await refresh();
      toast.success('Database deleted.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to delete the database.');
    } finally {
      setDeletingDatabase(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    setRestoring(true);
    setError(undefined);
    try {
      await restoreBackupFromFile(restoreFile);
      await refresh();
      setShowRestoreForm(false);
      setRestoreFile(null);
      setRestoreConfirm('');
      toast.success('Backup restored successfully.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to restore the backup.');
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
        <Button onClick={() => void handleGenerate()} disabled={generating} className={HEADER_BUTTON_CLASS}>
          {generating ? 'Generating…' : 'Generate backup'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={`${HEADER_BUTTON_CLASS} text-red-700 hover:text-ink`}
          onClick={() => {
            setShowRestoreForm((open) => !open);
            setRestoreConfirm('');
          }}
        >
          {showRestoreForm ? 'Cancel restore' : 'Restore a backup'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={`${HEADER_BUTTON_CLASS} text-red-700 hover:text-ink`}
          onClick={() => {
            setShowDeleteDbForm((open) => !open);
            setDeleteDbConfirm('');
          }}
        >
          {showDeleteDbForm ? 'Cancel delete' : 'Delete database'}
        </Button>
      </div>

      {showDeleteDbForm && (
        <div className="flex flex-col gap-4 rounded-2xl border border-red-300 bg-red-50 p-5">
          <p className="text-sm font-medium text-ink">
            Deleting the database erases every customer and teller account and transaction, then
            recreates an empty schema. Your admin account is kept. Backup files on disk are kept.
            This cannot be undone.
          </p>
          <label className="flex flex-col gap-2 text-sm font-medium text-ink">
            Type DELETE DATABASE to confirm
            <div className="max-w-md">
              <Input
                value={deleteDbConfirm}
                onChange={(event) => setDeleteDbConfirm(event.target.value)}
                placeholder="DELETE DATABASE"
                autoComplete="off"
              />
            </div>
          </label>
          <div>
            <button
              type="button"
              onClick={() => void handleDeleteDatabase()}
              disabled={deletingDatabase || deleteDbConfirm !== 'DELETE DATABASE'}
              className="h-[48px] rounded-[20px] bg-red-700 px-6 text-[15px] font-semibold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletingDatabase ? 'Deleting…' : 'Delete database'}
            </button>
          </div>
        </div>
      )}

      {showRestoreForm && (
        <div className="flex flex-col gap-4 rounded-2xl border border-red-300 bg-red-50 p-5">
          <p className="text-sm font-medium text-ink">
            Restoring overwrites the entire database with the contents of the selected dump. Use
            this only to recover from data loss.
          </p>
          <label className="flex flex-col gap-2 text-sm font-medium text-ink">
            Backup file (choose from this computer)
            <span className="flex flex-wrap items-center gap-3">
              <label className="inline-flex h-[48px] cursor-pointer items-center rounded-[20px] bg-surface-card px-6 text-[15px] font-semibold text-ink transition-colors hover:bg-primary-hover focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-hover">
                Choose .sql file
                <input
                  type="file"
                  accept=".sql,application/sql"
                  className="hidden"
                  onChange={(event) => {
                    setRestoreFile(event.target.files?.[0] ?? null);
                    event.target.value = '';
                  }}
                />
              </label>
              <span className="text-sm">
                {restoreFile
                  ? `${restoreFile.name} (${formatSize(restoreFile.size)})`
                  : 'No file selected'}
              </span>
              {restoreFile && (
                <button
                  type="button"
                  className="text-sm text-red-700 hover:underline"
                  onClick={() => setRestoreFile(null)}
                >
                  Remove
                </button>
              )}
            </span>
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
              disabled={restoring || !restoreFile || restoreConfirm !== 'RESTORE'}
              className="h-[48px] rounded-[20px] bg-red-700 px-6 text-[15px] font-semibold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
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
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={() => void handleDownload(backup.name)}
                        disabled={downloading === backup.name}
                        className={ROW_BUTTON_CLASS}
                      >
                        {downloading === backup.name ? 'Downloading…' : 'Download'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void handleDeleteBackup(backup.name)}
                        disabled={deleting === backup.name}
                        className={`${ROW_BUTTON_CLASS} text-red-700 hover:text-ink`}
                      >
                        {deleting === backup.name ? 'Deleting…' : 'Delete'}
                      </Button>
                    </div>
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
