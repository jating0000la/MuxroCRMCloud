import api from './api';
import { Lead } from '../types';

// Backend caps page size at 500 (see PaginationDto). These endpoints return a
// plain array with no total count, so to avoid silently truncating results at
// the backend's default limit of 50, we fetch full pages until a short page is
// returned. The safety cap prevents runaway loops for pathological data sets.
const MAX_PAGE_LIMIT = 500;
const MAX_PAGES_SAFETY = 20; // up to 10,000 records

async function fetchAllLeadPages(url: string): Promise<Lead[]> {
  const all: Lead[] = [];
  let page = 1;
  while (page <= MAX_PAGES_SAFETY) {
    const { data } = await api.get(url, { params: { page, limit: MAX_PAGE_LIMIT } });
    const batch: Lead[] = Array.isArray(data) ? data : data?.data || [];
    all.push(...batch);
    if (batch.length < MAX_PAGE_LIMIT) break;
    page++;
  }
  return all;
}

export const leadService = {
  getByCampaign: async (campaignId: string): Promise<Lead[]> => {
    return fetchAllLeadPages(`/leads/campaign/${campaignId}`);
  },

  getOne: async (id: string): Promise<Lead> => {
    const { data } = await api.get(`/leads/${id}`);
    return data;
  },

  getDnd: async (): Promise<Lead[]> => {
    return fetchAllLeadPages('/leads/dnd');
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
