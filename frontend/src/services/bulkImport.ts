import api from './api';

export const bulkImportService = {
  importCSV: async (campaignId: string, file: File, allocateRoundRobin: boolean = true) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('allocateRoundRobin', String(allocateRoundRobin));
    const { data } = await api.post(`/campaigns/${campaignId}/bulk-import/csv`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  importJSON: async (campaignId: string, jsonData: any[], allocateRoundRobin: boolean = true) => {
    const { data } = await api.post(`/campaigns/${campaignId}/bulk-import/json`, {
      data: jsonData,
      allocateRoundRobin,
    });
    return data;
  },
};
