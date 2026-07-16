import api from './api';
import { DashboardStats, Lead, Followup } from '../types';

export interface SalesFunnelData {
  totalLeads: number;
  contactedLeads: number;
  contactRate: number;
  leadsWithStatus: number;
  conversionRate: number;
  dndLeads: number;
  statusFunnel: Array<{
    status: string;
    color: string;
    count: number;
    percentage: number;
  }>;
}

export interface UserConversionData {
  userId: string;
  name: string;
  username: string;
  totalLeads: number;
  contactedLeads: number;
  contactRate: number;
  leadsWithStatus: number;
  qualifiedRate: number;
  convertedLeads: number;
  conversionRate: number;
  dndLeads: number;
}

export interface KpiData {
  totalLeads: number;
  todayNewLeads: number;
  dueFollowups: number;
  missedFollowups: number;
  wonDeals: number;
  overallConversion: number;
}

export interface CampaignReportData {
  campaignId: string;
  campaignName: string;
  totalLeads: number;
  converted: number;
  lost: number;
  conversionRate: number;
}

export interface StatusReportData {
  label: string;
  color: string;
  count: number;
}

export interface DailyTrendData {
  date: string;
  newLeads: number;
  convertedLeads: number;
  missedFollowups: number;
}

export interface MissedByUserData {
  userId: string;
  userName: string;
  username: string;
  missedCount: number;
  oldestPending: string;
  overdueCount: number;
}

export const dashboardService = {
  getOverview: async (): Promise<DashboardStats> => {
    const { data } = await api.get('/dashboard/overview');
    return data;
  },

  getFollowupDashboard: async (campaignId?: string): Promise<Followup[]> => {
    const params = campaignId ? { campaignId } : {};
    const { data } = await api.get('/dashboard/followups', { params });
    return Array.isArray(data) ? data : data.data || [];
  },

  getAllLeadsDashboard: async (campaignId?: string): Promise<Lead[]> => {
    const params = campaignId ? { campaignId } : {};
    const { data } = await api.get('/dashboard/leads', { params });
    return Array.isArray(data) ? data : data.data || [];
  },

  getCampaignStats: async (campaignId: string) => {
    const { data } = await api.get(`/dashboard/campaign-stats/${campaignId}`);
    return data;
  },

  getSalesFunnel: async (campaignId?: string): Promise<SalesFunnelData> => {
    const params = campaignId ? { campaignId } : {};
    const { data } = await api.get('/dashboard/sales-funnel', { params });
    return data;
  },

  getUserConversion: async (campaignId?: string, startDate?: string, endDate?: string): Promise<UserConversionData[]> => {
    const params: Record<string, string> = {};
    if (campaignId) params.campaignId = campaignId;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const { data } = await api.get('/dashboard/user-conversion', { params });
    return data;
  },

  getKpi: async (campaignId?: string, startDate?: string, endDate?: string): Promise<KpiData> => {
    const params: Record<string, string> = {};
    if (campaignId) params.campaignId = campaignId;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const { data } = await api.get('/dashboard/kpi', { params });
    return data;
  },

  getAlerts: async (): Promise<string[]> => {
    const { data } = await api.get('/dashboard/alerts');
    return data;
  },

  getCampaignReport: async (startDate?: string, endDate?: string): Promise<CampaignReportData[]> => {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const { data } = await api.get('/dashboard/campaign-report', { params });
    return data;
  },

  getStatusReport: async (campaignId?: string): Promise<StatusReportData[]> => {
    const params = campaignId ? { campaignId } : {};
    const { data } = await api.get('/dashboard/status-report', { params });
    return data;
  },

  getDailyTrend: async (campaignId?: string, startDate?: string, endDate?: string): Promise<DailyTrendData[]> => {
    const params: Record<string, string> = {};
    if (campaignId) params.campaignId = campaignId;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const { data } = await api.get('/dashboard/daily-trend', { params });
    return data;
  },

  getMissedByUser: async (campaignId?: string): Promise<MissedByUserData[]> => {
    const params = campaignId ? { campaignId } : {};
    const { data } = await api.get('/dashboard/missed-by-user', { params });
    return data;
  },
};
