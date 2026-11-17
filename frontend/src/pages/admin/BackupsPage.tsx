import React, { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { adminService, BackupInfo, BackupStatus, backupErrorMessage } from '../../services/admin';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export default function BackupsPage() {
  const { clearSession } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BackupInfo | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<BackupInfo | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [restoringFile, setRestoringFile] = useState<string | null>(null);

  const busy = triggering || uploading || !!deletingFile || !!restoringFile || !!downloadingFile || !!status?.busy;

  useEffect(() => {
    let cancelled = false;

    const loadAll = async () => {
      try {
        setLoading(true);
        const [data, capabilities] = await Promise.all([adminService.getBackups(), adminService.getBackupStatus()]);
        if (!cancelled) { setBackups(data); setStatus(capabilities); setError(null); }
      } catch (error: any) {
        const message = await backupErrorMessage(error, 'Failed to load backups');
        if (!cancelled) setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAll();
    return () => { cancelled = true; };
  }, []);

  const loadBackups = async () => {
    try {
      setLoading(true);
      const [data, capabilities] = await Promise.all([adminService.getBackups(), adminService.getBackupStatus()]);
      setBackups(data); setStatus(capabilities); setError(null);
    } catch (error: any) {
      setError(await backupErrorMessage(error, 'Failed to load backups'));
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerBackup = async () => {
    if (busy || !status?.creationAvailable) return;
    setTriggering(true);
    try {
      const result = await adminService.triggerBackup();
      toast.success(`Backup created: ${formatBytes(result.size)} in ${(result.duration / 1000).toFixed(1)}s`);
      if (result.warnings) toast(result.warnings, { icon: '⚠️', duration: 8000 });
      await loadBackups();
    } catch (error: any) {
      toast.error(await backupErrorMessage(error, 'Backup failed'));
      await loadBackups();
    } finally {
      setTriggering(false);
    }
  };

  const handleDownload = async (filename: string) => {
    if (busy) return;
    setDownloadingFile(filename);
    try {
      const { blob, filename: downloadName } = await adminService.downloadBackup(filename);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(await backupErrorMessage(error, 'Download failed'));
    } finally { setDownloadingFile(null); }
  };

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !status?.creationAvailable) return;
    const form = event.currentTarget;
    const file = new FormData(form).get('file');
    if (!(file instanceof File) || !file.size) {
      toast.error('Choose a backup file to upload.');
      return;
    }
    if (file.size > 45 * 1024 * 1024) {
      toast.error('The backup file exceeds the 45 MiB upload limit.');
      return;
    }
    setUploading(true);
    try {
      await adminService.uploadBackup(file);
      form.reset();
      toast.success('Backup uploaded. Select Restore next to the new backup.');
      await loadBackups();
    } catch (error) {
      toast.error(await backupErrorMessage(error, 'Backup upload failed.'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete || busy) return;
    setDeletingFile(confirmDelete.filename);
    try {
      await adminService.deleteBackup(confirmDelete.filename);
      toast.success('Backup deleted');
      setConfirmDelete(null);
      await loadBackups();
    } catch (error: any) {
      toast.error(await backupErrorMessage(error, 'Failed to delete backup'));
    } finally {
      setDeletingFile(null);
    }
  };

  const handleRestore = async () => {
    if (!confirmRestore || busy || restoreConfirmText !== 'RESTORE' || !status?.restoreAvailable) return;
    setRestoringFile(confirmRestore.filename);
    try {
      const result = await adminService.restoreBackup(confirmRestore.filename, restoreConfirmText);
      sessionStorage.setItem('backupRestoreNotice',
        `Database restored successfully. Sign in using an account and password from the selected backup. A recovery backup was saved as ${result.recoveryBackup}. Restart any workers you stopped.`);
      clearSession();
      navigate('/login', { replace: true });
    } catch (error: any) {
      toast.error(await backupErrorMessage(error, 'Restore failed. Check the server before retrying.'), { duration: 8000 });
      await loadBackups();
    } finally {
      setRestoringFile(null);
    }
  };

  return (
    <Layout>
      <div className="sleek-page p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Database Backups</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Create, download, and manage on-demand database backups
            </p>
          </div>
          <button
            onClick={handleTriggerBackup}
            disabled={busy || !status?.creationAvailable}
            className="inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {triggering ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating Backup...
              </>
            ) : (
              'Create Backup Now'
            )}
          </button>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300">
          Backups contain database records; uploaded files and server encryption keys must be backed up separately.
          Automatic backups require a server schedule. On-demand backups retain {status?.retentionDays ?? 7} days of backups.
          Restore saves a recovery backup first and signs everyone out after success.
        </div>

        {(status?.unavailableReason || status?.restoreUnavailableReason || status?.busy) && (
          <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
            {status.busy ? 'A backup or restore operation is already running.' : status.unavailableReason || status.restoreUnavailableReason}
          </div>
        )}
        <form onSubmit={handleUpload} className="rounded-xl border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <label htmlFor="backup-upload" className="block text-sm font-semibold">Upload backup for restore</label>
          <p id="backup-upload-help" className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Choose a PostgreSQL custom-format .dump backup from a trusted source. Maximum size is 45 MiB.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input id="backup-upload" name="file" type="file" accept=".dump" required
              aria-describedby="backup-upload-help" disabled={busy || !status?.creationAvailable}
              className="max-w-full text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5" />
            <button type="submit" disabled={busy || !status?.creationAvailable}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
              {uploading ? 'Uploading…' : 'Upload backup'}
            </button>
          </div>
        </form>
        <button onClick={loadBackups} disabled={triggering || uploading || !!restoringFile || !!deletingFile} className="text-sm font-semibold text-primary-700 disabled:opacity-50">Refresh backups</button>

        <div className="bg-white rounded-xl shadow-sm border dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <svg className="animate-spin h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : error ? (
            <div role="alert" className="p-6 text-sm text-red-700 dark:text-red-300">{error}</div>
          ) : backups.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No backups yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Click "Create Backup Now" to generate the first one.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Filename</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {backups.map((backup) => (
                  <tr key={backup.filename}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{backup.filename}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatBytes(backup.size)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {format(new Date(backup.created), 'MMM d, yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDownload(backup.filename)}
                          disabled={busy}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md border border-primary-200 text-primary-700 hover:bg-primary-50 dark:border-primary-800 dark:text-primary-300 dark:hover:bg-primary-900/30"
                        >
                          {downloadingFile === backup.filename ? 'Downloading…' : 'Download'}
                        </button>
                        <button
                          onClick={() => { setConfirmRestore(backup); setRestoreConfirmText(''); }}
                          disabled={busy || !status?.restoreAvailable}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-60 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/30"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => setConfirmDelete(backup)}
                          disabled={busy}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 max-w-sm w-full p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Delete backup?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              This will permanently delete <span className="font-mono text-xs">{confirmDelete.filename}</span>. This
              cannot be undone.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={!!deletingFile}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deletingFile === confirmDelete.filename}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingFile ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 max-w-md w-full p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Restore database?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              This will <span className="font-semibold text-red-600 dark:text-red-400">overwrite all current data</span> in
              the database with the contents of <span className="font-mono text-xs">{confirmRestore.filename}</span>.
              A recovery backup is saved first. Database changes are applied atomically; if restore fails, current data is preserved.
              After success, all sessions and pending jobs are cleared. Sign in using an account from the backup, then restart any stopped workers.
              Uploaded files and server encryption keys are unchanged.
            </p>
            <label className="block mt-4">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                Type RESTORE to confirm
              </span>
              <input
                type="text"
                value={restoreConfirmText}
                onChange={(e) => setRestoreConfirmText(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                placeholder="RESTORE"
                disabled={!!restoringFile}
                autoFocus
              />
            </label>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setConfirmRestore(null); setRestoreConfirmText(''); }}
                disabled={!!restoringFile}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={restoreConfirmText !== 'RESTORE' || busy || !status?.restoreAvailable}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {restoringFile === confirmRestore.filename ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
