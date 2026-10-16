import api from './api';

export interface CloudConnectOperator {
  agentId: string;
  name: string;
}

export interface CloudConnectConfig {
  enabled: boolean;
  tenantId: string;
  crmCampaignId: string;
  inboundCampaignIds: string[];
  operators: CloudConnectOperator[];
  webhookTokenConfigured: boolean;
}

export interface CloudConnectCall {
  id: string;
  leadId: string;
  phone: string;
  status: 'ringing' | 'answered' | 'ended';
  answered: boolean;
  callbackNeeded: boolean;
  operatorName: string | null;
  agentId: string | null;
  receivedAt: string;
  lastEventAt: string;
  endedAt: string | null;
  externalCallId: string;
  crmCampaignId: string;
}

export interface CloudConnectEvent {
  id: string;
  status: 'pending' | 'processed' | 'failed';
  attempts: number;
  error: string | null;
  createdAt: string;
  processedAt: string | null;
  externalCallId: string;
}

export interface CloudConnectPage<T> {
  data: T[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

const cloudconnectService = {
  getConfig: async (): Promise<CloudConnectConfig> => (await api.get('/integrations/cloudconnect/config')).data,
  saveConfig: async (config: Omit<CloudConnectConfig, 'webhookTokenConfigured'>): Promise<CloudConnectConfig> =>
    (await api.put('/integrations/cloudconnect/config', config)).data,
  generateWebhookToken: async (): Promise<{ token: string }> =>
    (await api.post('/integrations/cloudconnect/webhook-token')).data,
  getCalls: async (leadId: string, page = 1): Promise<CloudConnectPage<CloudConnectCall>> =>
    (await api.get('/integrations/cloudconnect/calls', { params: { leadId, page, limit: 20 } })).data,
  getEvents: async (page = 1): Promise<CloudConnectPage<CloudConnectEvent>> =>
    (await api.get('/integrations/cloudconnect/events', { params: { page, limit: 20 } })).data,
  retryEvent: async (id: string): Promise<{ accepted: boolean }> =>
    (await api.post(`/integrations/cloudconnect/events/${id}/retry`)).data,
};

export function cloudconnectError(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(message) ? message.join('. ') : message || fallback;
}

export default cloudconnectService;
