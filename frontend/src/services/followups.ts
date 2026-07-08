import api from './api';
import { Followup } from '../types';

export const followupService = {
  getByLead: async (leadId: string): Promise<Followup[]> => {
    const { data } = await api.get(`/followups/lead/${leadId}`);
    return data;
  },

  create: async (followupData: {
    leadId: string;
    status: string;
    remarks?: string;
    nextCallDate?: string;
  }): Promise<Followup> => {
    const { data } = await api.post('/followups', followupData);
    return data;
  },

  getMyFollowups: async (campaignId?: string): Promise<Followup[]> => {
    const params = campaignId ? { campaignId } : {};
    const { data } = await api.get('/followups/my', { params });
    return data;
  },

  getUpcomingFollowups: async (campaignId?: string): Promise<Followup[]> => {
    const params = campaignId ? { campaignId } : {};
    const { data } = await api.get('/followups/upcoming', { params });
    return data;
  },

  update: async (id: string, payload: { status?: string; remarks?: string; nextCallDate?: string | null }): Promise<Followup> => {
    const { data } = await api.put(`/followups/${id}`, payload);
    return data;
  },

  getCrossCampaign: async (params: { phone?: string; email?: string; excludeLeadId?: string }): Promise<any[]> => {
    const { data } = await api.get('/followups/cross-campaign', { params });
    return data;
  },
};
