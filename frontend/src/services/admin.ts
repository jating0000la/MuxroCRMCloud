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
}

export interface RestoreBackupResult {
  filename: string;
  duration: number;
  warnings?: string;
}

export const adminService = {
  getBackups: async (): Promise<BackupInfo[]> => {
    const { data } = await api.get('/admin/backups');
    return data;
  },

  triggerBackup: async (retentionDays?: number): Promise<TriggerBackupResult> => {
    // pg_dump can take a while on larger databases; use a longer timeout than
    // the default 30s so the request isn't aborted while the backup is still running.
    const { data } = await api.post(
      '/admin/backups/trigger',
      retentionDays ? { retentionDays } : {},
      { timeout: 300000 },
    );
    return data;
  },

  deleteBackup: async (filename: string): Promise<void> => {
    await api.delete(`/admin/backups/${encodeURIComponent(filename)}`);
  },

  restoreBackup: async (filename: string): Promise<RestoreBackupResult> => {
    // pg_restore can take a while on larger databases; match the backend's own
    // 300s child-process timeout so the request isn't aborted mid-restore.
    const { data } = await api.post(
      `/admin/backups/${encodeURIComponent(filename)}/restore`,
      undefined,
      { timeout: 300000 },
    );
    return data;
  },

  getBackupDownloadUrl: (filename: string): string => {
    return `/api/v1/admin/backups/${encodeURIComponent(filename)}/download`;
  },

  getSystemHealth: async (): Promise<any> => {
    const { data } = await api.get('/admin/health');
    return data;
  },
};
