import api from './api';
import { DashboardStats, Lead, Followup } from '../types';

export const dashboardService = {
  getOverview: async (): Promise<DashboardStats> => {
    const { data } = await api.get('/dashboard/overview');
    return data;
  },

  getFollowupDashboard: async (campaignId?: string): Promise<Followup[]> => {
    const params = campaignId ? { campaignId } : {};
    const { data } = await api.get('/dashboard/followups', { params });
    return data;
  },

  getAllLeadsDashboard: async (campaignId?: string): Promise<Lead[]> => {
    const params = campaignId ? { campaignId } : {};
    const { data } = await api.get('/dashboard/leads', { params });
    return data;
  },

  getCampaignStats: async (campaignId: string) => {
    const { data } = await api.get(`/dashboard/campaign-stats/${campaignId}`);
    return data;
  },
};
