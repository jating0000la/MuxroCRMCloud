import api from './api';

// Large CSV imports can take a long time (parsing, validation, batched DB inserts).
// Use a dedicated timeout for import requests instead of the global 30s API timeout.
const IMPORT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export const bulkImportService = {
  importCSV: async (campaignId: string, file: File, allocateRoundRobin: boolean = true) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('allocateRoundRobin', String(allocateRoundRobin));
    const { data } = await api.post(`/campaigns/${campaignId}/bulk-import/csv`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: IMPORT_TIMEOUT_MS,
    });
    return data;
  },

  importJSON: async (campaignId: string, jsonData: any[], allocateRoundRobin: boolean = true) => {
    const { data } = await api.post(`/campaigns/${campaignId}/bulk-import/json`, {
      data: jsonData,
      allocateRoundRobin,
    }, {
      timeout: IMPORT_TIMEOUT_MS,
    });
    return data;
  },
};
