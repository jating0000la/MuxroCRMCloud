import api from './api';
import { Form, Enquiry } from '../types';

export const formService = {
  getByCampaign: async (campaignId: string): Promise<Form[]> => {
    const { data } = await api.get(`/campaigns/${campaignId}/forms`);
    return data;
  },

  getOne: async (campaignId: string, id: string): Promise<Form> => {
    const { data } = await api.get(`/campaigns/${campaignId}/forms/${id}`);
    return data;
  },

  create: async (campaignId: string, formData: { title: string; fields: any[] }): Promise<Form> => {
    const { data } = await api.post(`/campaigns/${campaignId}/forms`, formData);
    return data;
  },

  update: async (campaignId: string, id: string, formData: Partial<Form>): Promise<Form> => {
    const { data } = await api.put(`/campaigns/${campaignId}/forms/${id}`, formData);
    return data;
  },

  publish: async (campaignId: string, id: string) => {
    const { data } = await api.post(`/campaigns/${campaignId}/forms/${id}/publish`);
    return data;
  },

  unpublish: async (campaignId: string, id: string) => {
    const { data } = await api.post(`/campaigns/${campaignId}/forms/${id}/unpublish`);
    return data;
  },

  remove: async (campaignId: string, id: string) => {
    const { data } = await api.delete(`/campaigns/${campaignId}/forms/${id}`);
    return data;
  },

  getSubmissions: async (campaignId: string, id: string): Promise<Enquiry[]> => {
    const { data } = await api.get(`/campaigns/${campaignId}/forms/${id}/submissions`);
    return data;
  },

  getPublicForm: async (slug: string): Promise<Form> => {
    const { data } = await api.get(`/forms/public/${slug}`);
    return data;
  },

  submitPublicForm: async (slug: string, formData: Record<string, any>) => {
    const { data } = await api.post(`/forms/public/${slug}/submit`, { data: formData });
    return data;
  },
};
