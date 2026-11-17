import api from './api';
import { Campaign, CampaignUser } from '../types';

export const campaignService = {
  getAll: async (): Promise<Campaign[]> => {
    const { data } = await api.get('/campaigns');
    return data;
  },

  getOne: async (id: string): Promise<Campaign> => {
    const { data } = await api.get(`/campaigns/${id}`);
    return data;
  },

  create: async (campaignData: { name: string; description?: string }): Promise<Campaign> => {
    const { data } = await api.post('/campaigns', campaignData);
    return data;
  },

  update: async (id: string, campaignData: Partial<Campaign>): Promise<Campaign> => {
    const { data } = await api.put(`/campaigns/${id}`, campaignData);
    return data;
  },

  remove: async (id: string) => {
    const { data } = await api.delete(`/campaigns/${id}`);
    return data;
  },

  assignUsers: async (campaignId: string, userIds: string[]): Promise<CampaignUser[]> => {
    const { data } = await api.post(`/campaigns/${campaignId}/users`, { userIds });
    return data;
  },

  removeUser: async (campaignId: string, userId: string) => {
    const { data } = await api.delete(`/campaigns/${campaignId}/users/${userId}`);
    return data;
  },

  getAssignedUsers: async (campaignId: string): Promise<CampaignUser[]> => {
    const { data } = await api.get(`/campaigns/${campaignId}/users`);
    return data;
  },
};
