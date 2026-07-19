import api from './api';

export interface DeleteAllDataResult {
  deletedFollowups: number;
  deletedLeads: number;
  deletedEnquiries: number;
  deletedForms: number;
  deletedStatuses: number;
  deletedCampaignUsers: number;
  deletedCampaigns: number;
}

export const dataExportService = {
  /**
   * Download all campaign data as a ZIP file containing CSVs.
   * Returns a Blob for direct browser download.
   */
  downloadAllData: async (): Promise<Blob> => {
    const { data } = await api.get('/admin/data-export/download', {
      responseType: 'blob',
      timeout: 300000, // 5 minutes for large datasets
    });
    return data;
  },

  /**
   * Delete ALL campaign data (campaigns, leads, forms, followups, statuses).
   * This is irreversible.
   */
  deleteAllData: async (): Promise<DeleteAllDataResult> => {
    const { data } = await api.delete('/admin/data-export/all', {
      timeout: 120000, // 2 minutes for large deletions
    });
    return data;
  },
};
