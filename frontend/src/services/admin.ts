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

export const adminService = {
  getBackups: async (): Promise<BackupInfo[]> => {
    const { data } = await api.get('/admin/backups');
    return data;
  },

  triggerBackup: async (retentionDays?: number): Promise<TriggerBackupResult> => {
    const { data } = await api.post('/admin/backups/trigger', retentionDays ? { retentionDays } : {});
    return data;
  },

  deleteBackup: async (filename: string): Promise<void> => {
    await api.delete(`/admin/backups/${encodeURIComponent(filename)}`);
  },

  getBackupDownloadUrl: (filename: string): string => {
    return `/api/v1/admin/backups/${encodeURIComponent(filename)}/download`;
  },

  getSystemHealth: async (): Promise<any> => {
    const { data } = await api.get('/admin/health');
    return data;
  },
};
