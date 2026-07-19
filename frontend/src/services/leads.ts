import api from './api';
import { Lead } from '../types';
import { fetchAllPages } from './pagination';

export const leadService = {
  getByCampaign: async (campaignId: string): Promise<Lead[]> => {
    return fetchAllPages<Lead>(`/leads/campaign/${campaignId}`, {}, { maxPageLimit: 500, maxPages: 20 });
  },

  getOne: async (id: string): Promise<Lead> => {
    const { data } = await api.get(`/leads/${id}`);
    return data;
  },

  getDnd: async (): Promise<Lead[]> => {
    return fetchAllPages<Lead>('/leads/dnd', {}, { maxPageLimit: 500, maxPages: 20 });
  },

  create: async (leadData: Partial<Lead>): Promise<Lead> => {
    const { data } = await api.post('/leads', leadData);
    return data;
  },

  update: async (id: string, leadData: Partial<Lead>): Promise<Lead> => {
    const { data } = await api.put(`/leads/${id}`, leadData);
    return data;
  },

  updateStatus: async (
    id: string,
    statusData: {
      status: string;
      statusId?: string;
      remarks?: string;
      nextCallDate?: string;
      dnd?: boolean;
    }
  ) => {
    const { data } = await api.put(`/leads/${id}/status`, statusData);
    return data;
  },

  bulkAllocate: async (campaignId: string, leadIds: string[]) => {
    const { data } = await api.post(`/leads/bulk-allocate/${campaignId}`, { leadIds });
    return data;
  },

  getStats: async (campaignId: string) => {
    const { data } = await api.get(`/leads/stats/${campaignId}`);
    return data;
  },

  remove: async (id: string) => {
    const { data } = await api.delete(`/leads/${id}`);
    return data;
  },
};
