import api from './api';
export interface TemplateMessageConfig { templateId: string; params: string[]; mediaUrl?: string; recipientField?: string; }
export interface GupshupTemplate {
  id: string; appId: string; name: string; language: string; status: string; category: string; body: string;
  headerType: 'text' | 'image' | 'video' | 'document'; mediaUrl: string; mediaId: string; parameterCount: number;
  buttons: { type: string; text: string; url?: string; phoneNumber?: string }[];
  supported: boolean; unsupportedReason?: string;
}
export const gupshupTemplates = {
  list: async (): Promise<{ templates: GupshupTemplate[]; syncedAt: string | null }> => (await api.get('/integrations/gupshup/templates')).data,
  sync: async (): Promise<{ success: boolean; templates: GupshupTemplate[]; error?: string }> => (await api.post('/integrations/gupshup/sync-templates')).data,
};
export function templateError(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  return Array.isArray(message) ? message.join('. ') : typeof message === 'string' ? message : error?.message || fallback;
}
