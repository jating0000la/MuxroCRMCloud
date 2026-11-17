import api from './api';

export interface BackupInfo {
  filename: string;
  size: number;
  created: string;
}

export interface TriggerBackupResult {
  file: string;
  size: number;
  duration: number;
  warnings?: string;
}

export interface RestoreBackupResult {
  filename: string;
  duration: number;
  recoveryBackup: string;
  requiresLogin: true;
}

export interface BackupStatus {
  scope: 'database';
  retentionDays: number;
  scheduling: 'external';
  busy: boolean;
  creationAvailable: boolean;
  unavailableReason: string | null;
  restoreAvailable: boolean;
  restoreUnavailableReason: string | null;
}

const BACKUP_REQUEST_TIMEOUT = 660000;

export async function backupErrorMessage(error: any, fallback: string): Promise<string> {
  let data = error.response?.data;
  if (data instanceof Blob) {
    try { data = JSON.parse(await data.text()); } catch { /* use fallback */ }
  }
  if (Array.isArray(data?.message)) return data.message.join('. ');
  if (typeof data?.message === 'string') return data.message;
  if (error.code === 'ECONNABORTED') return 'Request timed out. Check the backup list before retrying; the server may still be working.';
  return fallback;
}

export const adminService = {
  getBackups: async (): Promise<BackupInfo[]> => {
    const { data } = await api.get('/admin/backups');
    return data;
  },

  getBackupStatus: async (): Promise<BackupStatus> => {
    const { data } = await api.get('/admin/backups/status');
    return data;
  },

  triggerBackup: async (retentionDays?: number): Promise<TriggerBackupResult> => {
    // pg_dump can take a while on larger databases; use a longer timeout than
    // the default 30s so the request isn't aborted while the backup is still running.
    const { data } = await api.post(
      '/admin/backups/trigger',
      retentionDays === undefined ? {} : { retentionDays },
      { timeout: BACKUP_REQUEST_TIMEOUT },
    );
    return data;
  },

  deleteBackup: async (filename: string): Promise<void> => {
    await api.delete(`/admin/backups/${encodeURIComponent(filename)}`);
  },

  restoreBackup: async (filename: string, confirmation: string): Promise<RestoreBackupResult> => {
    // Allow time for recovery backup, SQL generation, and transactional restore.
    const { data } = await api.post(
      `/admin/backups/${encodeURIComponent(filename)}/restore`,
      { confirmation },
      { timeout: BACKUP_REQUEST_TIMEOUT },
    );
    return data;
  },

  getBackupDownloadUrl: (filename: string): string => {
    return `/api/v1/admin/backups/${encodeURIComponent(filename)}/download`;
  },

  uploadBackup: async (file: File): Promise<TriggerBackupResult> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/admin/backups/upload', form, {
      headers: { 'Content-Type': undefined },
      timeout: BACKUP_REQUEST_TIMEOUT,
    });
    return data;
  },

  downloadBackup: async (filename: string): Promise<{ blob: Blob; filename: string }> => {
    const { data, headers } = await api.get(
      `/admin/backups/${encodeURIComponent(filename)}/download`,
      { responseType: 'blob', timeout: BACKUP_REQUEST_TIMEOUT },
    );
    const downloadName = /filename="([^"]+)"/.exec(headers['content-disposition'] || '')?.[1];
    return { blob: data, filename: downloadName || filename };
  },

  getSystemHealth: async (): Promise<any> => {
    const { data } = await api.get('/admin/health');
    return data;
  },
};
