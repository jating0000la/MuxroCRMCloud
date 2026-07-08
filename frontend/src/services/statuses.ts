import api from './api';
import { CampaignStatus } from '../types';

export const statusService = {
  getByCampaign: async (campaignId: string): Promise<CampaignStatus[]> => {
    const { data } = await api.get(`/campaigns/${campaignId}/statuses`);
    return data;
  },

  create: async (campaignId: string, statusData: { label: string; color?: string; whatsappMessage?: string }): Promise<CampaignStatus> => {
    const { data } = await api.post(`/campaigns/${campaignId}/statuses`, statusData);
    return data;
  },

  update: async (campaignId: string, id: string, statusData: { label?: string; color?: string; order?: number; whatsappMessage?: string }): Promise<CampaignStatus> => {
    const { data } = await api.put(`/campaigns/${campaignId}/statuses/${id}`, statusData);
    return data;
  },

  remove: async (campaignId: string, id: string) => {
    const { data } = await api.delete(`/campaigns/${campaignId}/statuses/${id}`);
    return data;
  },
};
