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
  webappUrl?: string;
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
};

export default integrationService;
