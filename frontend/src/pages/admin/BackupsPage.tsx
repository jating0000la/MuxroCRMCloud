import React, { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { adminService, BackupInfo } from '../../services/admin';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export default function BackupsPage() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BackupInfo | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<BackupInfo | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [restoringFile, setRestoringFile] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadAll = async () => {
      try {
        setLoading(true);
        const data = await adminService.getBackups();
        if (!cancelled) setBackups(data);
      } catch (error: any) {
        if (!cancelled) toast.error(error.response?.data?.message || 'Failed to load backups');
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
      const data = await adminService.getBackups();
      setBackups(data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerBackup = async () => {
    setTriggering(true);
    try {
      const result = await adminService.triggerBackup();
      toast.success(`Backup created: ${formatBytes(result.size)} in ${(result.duration / 1000).toFixed(1)}s`);
      await loadBackups();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Backup failed');
    } finally {
      setTriggering(false);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      const blob = await adminService.downloadBackup(filename);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Download failed');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeletingFile(confirmDelete.filename);
    try {
      await adminService.deleteBackup(confirmDelete.filename);
      toast.success('Backup deleted');
      setConfirmDelete(null);
      await loadBackups();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete backup');
    } finally {
      setDeletingFile(null);
    }
  };

  const handleRestore = async () => {
    if (!confirmRestore) return;
    setRestoringFile(confirmRestore.filename);
    try {
      const result = await adminService.restoreBackup(confirmRestore.filename);
      toast.success(
        `Database restored from ${result.filename} in ${(result.duration / 1000).toFixed(1)}s. Restart the backend and worker now.`,
        { duration: 8000 },
      );
      if (result.warnings) {
        toast(`Restore completed with warnings — check server logs.`, { icon: '⚠️', duration: 8000 });
      }
      setConfirmRestore(null);
      setRestoreConfirmText('');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Restore failed');
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
            disabled={triggering}
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
          Automatic backups run daily at 2:00 AM server time and old backups are cleaned up automatically based on
          the configured retention period. Use "Create Backup Now" for an on-demand backup, or "Restore" to recover
          the database from a specific backup.
        </div>

        <div className="bg-white rounded-xl shadow-sm border dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <svg className="animate-spin h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : backups.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No backups yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Click "Create Backup Now" to generate the first one, or wait for the nightly scheduled backup.
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
                          className="px-2.5 py-1 text-xs font-semibold rounded-md border border-primary-200 text-primary-700 hover:bg-primary-50 dark:border-primary-800 dark:text-primary-300 dark:hover:bg-primary-900/30"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => { setConfirmRestore(backup); setRestoreConfirmText(''); }}
                          disabled={restoringFile === backup.filename}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-60 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/30"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => setConfirmDelete(backup)}
                          disabled={deletingFile === backup.filename}
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
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deletingFile === confirmDelete.filename}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                Delete
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
              This cannot be undone, and the backend/worker should be restarted immediately after.
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
                autoFocus
              />
            </label>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setConfirmRestore(null); setRestoreConfirmText(''); }}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={restoreConfirmText !== 'RESTORE' || restoringFile === confirmRestore.filename}
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
