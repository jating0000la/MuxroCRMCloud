import api from './api';

export interface IntegrationSettings {
  indiamartApiKey?: string;
  webappUrl?: string;
  companyName?: string;
  websiteLink?: string;
  processSutraApiKey?: string;
  processSutraSystemName?: string;
}

export interface StartFlowPayload {
  apiKey: string;
  systemName: string;
  orderNumber?: string;
  description?: string;
  initialFormData?: Record<string, any>;
  notifyAssignee?: boolean;
}

export interface IndiamartFetchPayload {
  apiKey: string;
  startTime?: string;
  endTime?: string;
}

export interface IndiamartAutoImportPayload {
  campaignId: string;
  apiKey: string;
  startTime?: string;
  endTime?: string;
}

export interface IndiamartAutoImportResult {
  success: boolean;
  fetched: number;
  imported: number;
  duplicates: number;
  errors: number;
  leads: any[];
  message?: string;
}

const integrationService = {
  // Process Sutra
  startFlow: async (payload: StartFlowPayload) => {
    const { data } = await api.post('/integrations/process-sutra/start-flow', payload);
    return data;
  },

  testProcessSutra: async (payload: StartFlowPayload) => {
    const { data } = await api.post('/integrations/process-sutra/test-connection', payload);
    return data;
  },

  // Indiamart
  fetchLeads: async (payload: IndiamartFetchPayload) => {
    const { data } = await api.post('/integrations/indiamart/fetch-leads', payload);
    return data;
  },

  testIndiamart: async (payload: IndiamartFetchPayload) => {
    const { data } = await api.post('/integrations/indiamart/test-connection', payload);
    return data;
  },

  autoImportLeads: async (payload: IndiamartAutoImportPayload): Promise<IndiamartAutoImportResult> => {
    const { data } = await api.post('/integrations/indiamart/auto-import', payload);
    return data;
  },

  getLastFetchTime: async (): Promise<{ lastFetchTime: string | null }> => {
    const { data } = await api.get('/integrations/indiamart/last-fetch');
    return data;
  },
};

export default integrationService;
