import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { dashboardService } from '../../services/dashboard';
import { campaignService } from '../../services/campaigns';
import { statusService } from '../../services/statuses';
import integrationService from '../../services/integrations';
import { followupService } from '../../services/followups';
import { Lead, Campaign, CampaignStatus } from '../../types';
import Layout from '../../components/layout/Layout';
import Pagination from '../../components/common/Pagination';
import LeadDetailDialog from '../../components/leads/LeadDetailDialog';
import { downloadCsv } from '../../utils/csv';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const DEFAULT_PAGE_SIZE = 50;

type SortField = 'name' | 'campaign' | 'status' | 'doer' | 'dueDate' | 'updatedAt';
type SortDir = 'asc' | 'desc';

export default function FollowupDashboardPage() {
  const { user } = useAuth();
  const { notifications, syncWithDelay } = useNotifications();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [dndFilter, setDndFilter] = useState<'all' | 'dnd' | 'no_dnd'>('all');
  const [dueFilter, setDueFilter] = useState<'all' | 'overdue' | 'today' | 'next3' | 'completed'>('all');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [campaignStatuses, setCampaignStatuses] = useState<CampaignStatus[]>([]);
  const [startingFlow, setStartingFlow] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [quickReschedule, setQuickReschedule] = useState<{ leadId: string; followupId: string; value: string } | null>(null);
  const [savingReschedule, setSavingReschedule] = useState(false);
  const rescheduleRef = useRef<HTMLInputElement>(null);

  const getRowHighlightClass = (lead: Lead): string => {
    const followup = lead.followups?.[0];
    if (!followup?.nextCallDate) return '';

    const notif = notifications.find(n => n.followupId === followup.id);
    if (!notif) return '';

    switch (notif.type) {
      case 'overdue':
        return 'bg-red-50 border-l-4 border-red-500 dark:bg-red-900/20';
      case 'today':
        return 'bg-yellow-50 border-l-4 border-yellow-500 dark:bg-yellow-900/20';
      case 'tomorrow':
        return 'bg-green-50 border-l-4 border-green-500 dark:bg-green-900/20';
      default:
        return '';
    }
  };

  const getProcessSutraSettings = () => {
    try {
      const saved = localStorage.getItem('processSutraSettings');
      if (saved) return JSON.parse(saved);
    } catch {
    }
    return { apiKey: '', systemName: '' };
  };

  useEffect(() => {
    loadData();
  }, [selectedCampaign]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!selectedLead) {
        refreshSilently();
      }
    }, 30 * 1000);
    return () => clearInterval(interval);
  }, [selectedCampaign, selectedLead]);

  const refreshSilently = async () => {
    setIsRefreshing(true);
    try {
      const [leadsData, campaignsData] = await Promise.all([
        dashboardService.getAllLeadsDashboard(selectedCampaign || undefined),
        campaignService.getAll(),
      ]);
      setLeads(leadsData);
      setCampaigns(campaignsData);
      setLastRefreshed(new Date());
    } catch {
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [leadsData, campaignsData] = await Promise.all([
        dashboardService.getAllLeadsDashboard(selectedCampaign || undefined),
        campaignService.getAll(),
      ]);
      setLeads(leadsData);
      setCampaigns(campaignsData);
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Failed to load data', error);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const overdue = notifications.filter(n => n.type === 'overdue').length;
    const today = notifications.filter(n => n.type === 'today').length;
    const total = overdue + today;
    if (total > 0) {
      document.title = `(${total}${overdue > 0 ? '🔴' : '⏰'}) Follow-ups`;
    } else {
      document.title = 'Follow-ups';
    }
    return () => { document.title = 'CRM'; };
  }, [notifications]);

  useEffect(() => {
    if (quickReschedule && rescheduleRef.current) {
      rescheduleRef.current.focus();
    }
  }, [quickReschedule]);

  const handleQuickReschedule = async () => {
    if (!quickReschedule?.value) return;
    setSavingReschedule(true);
    try {
      await followupService.update(quickReschedule.followupId, {
        nextCallDate: new Date(quickReschedule.value).toISOString(),
      });
      toast.success('Rescheduled');
      setQuickReschedule(null);
      await refreshSilently();
      syncWithDelay(300);
    } catch {
      toast.error('Failed to reschedule');
    } finally {
      setSavingReschedule(false);
    }
  };

  const loadCampaignStatuses = async (campaignId: string) => {
    try {
      const statuses = await statusService.getByCampaign(campaignId);
      setCampaignStatuses(statuses);
    } catch (error) {
      console.error('Failed to load statuses');
    }
  };

  const handleStartFlow = async (lead: Lead) => {
    const settings = getProcessSutraSettings();
    if (!settings.apiKey || !settings.systemName) {
      toast.error('Process Sutra not configured. Go to Settings to set up.');
      return;
    }

    setStartingFlow(lead.id);
    try {
      const result = await integrationService.startFlow({
        apiKey: settings.apiKey,
        systemName: settings.systemName,
        orderNumber: `LEAD-${lead.id.slice(0, 8).toUpperCase()}`,
        description: `Lead: ${lead.name} | Campaign: ${lead.campaign?.name || 'N/A'} | Source: ${lead.source}`,
        initialFormData: {
          leadId: lead.id,
          name: lead.name,
          email: lead.email || '',
          phone: lead.phone || '',
          campaign: lead.campaign?.name || '',
          source: lead.source,
          status: lead.status?.label || '',
          ...(lead.customData || {}),
        },
        notifyAssignee: true,
      });

      if (result.success) {
        toast.success(`Process Sutra flow started for ${lead.name}`);
      } else {
        toast.error(result.message || 'Failed to start flow');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to start flow');
    } finally {
      setStartingFlow(null);
    }
  };

  const filteredLeads = leads
    .filter((lead) => {
      const matchSearch =
        !search ||
        lead.name.toLowerCase().includes(search.toLowerCase()) ||
        lead.email?.toLowerCase().includes(search.toLowerCase()) ||
        lead.phone?.includes(search);
      const matchSource = !sourceFilter || lead.source === sourceFilter;
      const matchDnd =
        dndFilter === 'all' ||
        (dndFilter === 'dnd' && lead.dnd) ||
        (dndFilter === 'no_dnd' && !lead.dnd);

      const nextCall = lead.followups?.[0]?.nextCallDate ? new Date(lead.followups[0].nextCallDate) : null;
      const now = new Date();
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const after3 = new Date(now);
      after3.setDate(now.getDate() + 3);
      const isCompleted = (lead.status?.label || '').toLowerCase().includes('completed');

      const matchDue =
        dueFilter === 'all' ||
        (dueFilter === 'overdue' && !!nextCall && nextCall < startToday && !isCompleted) ||
        (dueFilter === 'today' && !!nextCall && nextCall >= startToday && nextCall <= endToday) ||
        (dueFilter === 'next3' && !!nextCall && nextCall > endToday && nextCall <= after3) ||
        (dueFilter === 'completed' && isCompleted);

      return matchSearch && matchSource && matchDnd && matchDue;
    })
    .sort((a, b) => {
      const getUrgencyScore = (lead: Lead) => {
        const notif = notifications.find(n => n.followupId === lead.followups?.[0]?.id);
        if (notif?.type === 'overdue') return 0;
        if (notif?.type === 'today') return 1;
        return 2;
      };
      const urgencyDiff = getUrgencyScore(a) - getUrgencyScore(b);
      if (urgencyDiff !== 0) return urgencyDiff;

      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'campaign':
          comparison = (a.campaign?.name || '').localeCompare(b.campaign?.name || '');
          break;
        case 'status':
          comparison = (a.status?.label || '').localeCompare(b.status?.label || '');
          break;
        case 'doer':
          comparison = (a.doer?.name || '').localeCompare(b.doer?.name || '');
          break;
        case 'dueDate':
          const aDate = a.followups?.[0]?.nextCallDate;
          const bDate = b.followups?.[0]?.nextCallDate;
          if (!aDate && !bDate) comparison = 0;
          else if (!aDate) comparison = 1;
          else if (!bDate) comparison = -1;
          else comparison = new Date(aDate).getTime() - new Date(bDate).getTime();
          break;
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [selectedCampaign, search, sourceFilter, dndFilter, dueFilter, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <svg className={`w-4 h-4 inline-block ml-1 ${sortField === field ? 'text-primary-600' : 'text-gray-400 dark:text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {sortField === field && sortDir === 'desc' ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      )}
    </svg>
  );

  const uniqueSources = [...new Set(leads.map((l) => l.source))];

  const handleViewLead = (lead: Lead) => {
    setSelectedLead(lead);
    loadCampaignStatuses(lead.campaignId);
  };

  const exportToCSV = () => {
    const headers = ['Lead ID', 'Campaign', 'Name', 'Phone', 'Due Date', 'Last Updated', 'Status'];
    const rows = filteredLeads.map((l) => [
      l.id.slice(0, 8),
      l.campaign?.name || '',
      l.name,
      l.phone || '',
      l.followups?.[0]?.nextCallDate ? format(new Date(l.followups[0].nextCallDate), 'MMM d, yyyy h:mm a') : '',
      format(new Date(l.updatedAt), 'MMM d, yyyy'),
      l.status?.label || '',
    ]);

    downloadCsv(`leads-${format(new Date(), 'yyyy-MM-dd')}.csv`, headers, rows);
  };

  const clearFilters = () => {
    setSearch('');
    setSourceFilter('');
    setDndFilter('all');
    setDueFilter('all');
    setSelectedCampaign('');
  };

  return (
    <Layout>
      {error && (
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between dark:bg-red-900/20 dark:border-red-800">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700 dark:text-red-400">{error}</span>
            </div>
            <button onClick={loadData} className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/40">
              Retry
            </button>
          </div>
        </div>
      )}
      <div className="sleek-page p-3 lg:p-4">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 text-xs font-medium ${isRefreshing ? 'text-amber-600' : 'text-green-600'}`}>
              <span className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-amber-400 animate-pulse' : 'bg-green-400 animate-pulse'}`} />
              {isRefreshing ? 'Refreshing...' : 'Live'}
            </span>
            <span className="text-xs text-slate-400 dark:text-gray-500">
              Updated {format(lastRefreshed, 'h:mm:ss a')}
            </span>
          </div>
          <button
            onClick={() => { setLoading(false); refreshSilently(); }}
            disabled={isRefreshing}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors dark:text-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700"
          >
            <svg className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
        {notifications.length > 0 && (
          <div className="mb-4 p-4 bg-gradient-to-r from-red-50 to-yellow-50 border border-red-200 rounded-lg dark:from-red-900/20 dark:to-yellow-900/20 dark:border-red-800">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="font-semibold text-red-900 dark:text-red-300">
                    ⚠️ {notifications.length} PENDING FOLLOWUP{notifications.length > 1 ? 'S' : ''}
                  </h3>
                  <p className="text-sm text-red-700 mt-1 dark:text-red-400">
                    {notifications.filter(n => n.type === 'overdue').length > 0 && (
                      <span>🔴 {notifications.filter(n => n.type === 'overdue').length} OVERDUE  </span>
                    )}
                    {notifications.filter(n => n.type === 'today').length > 0 && (
                      <span>⏰ {notifications.filter(n => n.type === 'today').length} DUE TODAY  </span>
                    )}
                    {notifications.filter(n => n.type === 'tomorrow').length > 0 && (
                      <span>📅 {notifications.filter(n => n.type === 'tomorrow').length} DUE TOMORROW</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border dark:bg-gray-800 dark:border-gray-700">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No leads found</h3>
            <p className="text-gray-500 mt-1 dark:text-gray-400">
              {search || selectedCampaign || sourceFilter || dndFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Import leads to get started'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden dark:bg-gray-800 dark:border-gray-700">
            <div className="border-b border-gray-200 bg-gray-50/80 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/50">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                <div className="lg:col-span-3 relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search lead"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 dark:border-gray-600"
                  />
                </div>

                <select
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                  className="lg:col-span-2 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 dark:border-gray-600"
                >
                  <option value="">Campaign</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="lg:col-span-2 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 dark:border-gray-600"
                >
                  <option value="">Source</option>
                  {uniqueSources.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <select
                  value={dndFilter}
                  onChange={(e) => setDndFilter(e.target.value as any)}
                  className="lg:col-span-2 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 dark:border-gray-600"
                >
                  <option value="all">All</option>
                  <option value="no_dnd">Non-DND</option>
                  <option value="dnd">DND</option>
                </select>

                <div className="lg:col-span-3 flex items-center justify-end gap-2">
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 dark:border-gray-600"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <button
                    onClick={clearFilters}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Clear
                  </button>
                  {user?.role === 'ADMIN' && (
                    <button
                      onClick={exportToCSV}
                      className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Export
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'overdue', label: 'Overdue' },
                  { key: 'today', label: 'Today' },
                  { key: 'next3', label: 'Next 3 Days' },
                  { key: 'completed', label: 'Completed' },
                ].map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setDueFilter(chip.key as any)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${dueFilter === chip.key ? 'border-primary-300 bg-primary-100 text-primary-700 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Showing {paginatedLeads.length} of {filteredLeads.length} filtered leads ({leads.length} total)
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Lead ID</th>
                    <th
                      onClick={() => handleSort('campaign')}
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                      Campaign <SortIcon field="campaign" />
                    </th>
                    <th
                      onClick={() => handleSort('name')}
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                      Name <SortIcon field="name" />
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Phone</th>
                    <th
                      onClick={() => handleSort('dueDate')}
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                      Due Date <SortIcon field="dueDate" />
                    </th>
                    <th
                      onClick={() => handleSort('updatedAt')}
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                      Updated <SortIcon field="updatedAt" />
                    </th>
                    <th
                      onClick={() => handleSort('status')}
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                      Status <SortIcon field="status" />
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedLeads.map((lead) => (
                    <tr key={lead.id} className={`transition-colors ${getRowHighlightClass(lead)} ${!getRowHighlightClass(lead) ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50' : 'hover:opacity-90'}`}>
                      <td className="px-3 py-2 text-xs text-gray-500 font-mono dark:text-gray-400">{lead.id.slice(0, 8)}</td>
                      <td className="px-3 py-2 text-sm text-gray-500 truncate max-w-[120px] dark:text-gray-400">{lead.campaign?.name}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${lead.dnd ? 'bg-red-100 dark:bg-red-900/30' : 'bg-primary-100 dark:bg-primary-900/30'}`}>
                            {lead.dnd ? (
                              <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            ) : (
                              <span className="text-xs font-medium text-primary-700 dark:text-primary-300">{lead.name.charAt(0)}</span>
                            )}
                          </div>
                          <div className="ml-2 min-w-0">
                            <p className="font-medium text-gray-900 truncate text-sm leading-tight dark:text-gray-100">{lead.name}</p>
                            {lead.dnd && <span className="text-xs text-red-600 font-medium">DND</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{lead.phone || '-'}</td>
                      <td className="px-3 py-2">
                        {quickReschedule?.leadId === lead.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              ref={rescheduleRef}
                              type="datetime-local"
                              value={quickReschedule.value}
                              onChange={e => setQuickReschedule(q => q ? { ...q, value: e.target.value } : null)}
                              onKeyDown={e => { if (e.key === 'Enter') handleQuickReschedule(); if (e.key === 'Escape') setQuickReschedule(null); }}
                              className="text-xs border border-primary-400 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 w-40 dark:border-primary-600"
                            />
                            <button
                              onClick={handleQuickReschedule}
                              disabled={savingReschedule}
                              className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/40"
                              title="Save"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button onClick={() => setQuickReschedule(null)} className="p-1 bg-gray-100 text-gray-500 rounded hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600" title="Cancel">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : lead.followups?.[0]?.nextCallDate ? (
                          <button
                            onClick={() => setQuickReschedule({
                              leadId: lead.id,
                              followupId: lead.followups![0].id,
                              value: format(new Date(lead.followups![0].nextCallDate!), "yyyy-MM-dd'T'HH:mm"),
                            })}
                            className={`text-xs font-medium text-left hover:underline ${
                              new Date(lead.followups[0].nextCallDate) < new Date()
                                ? 'text-red-600'
                                : new Date(lead.followups[0].nextCallDate).toDateString() === new Date().toDateString()
                                  ? 'text-amber-600'
                                  : 'text-gray-900 dark:text-gray-100'
                            }`}
                            title="Click to reschedule"
                          >
                            {format(new Date(lead.followups[0].nextCallDate), 'MMM d, h:mm a')}
                            <span className="block text-[10px] text-gray-400 dark:text-gray-500">click to reschedule</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => lead.followups?.[0] && setQuickReschedule({
                              leadId: lead.id,
                              followupId: lead.followups[0].id,
                              value: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                            })}
                            className="text-xs text-blue-400 hover:text-blue-600 hover:underline"
                            title="Set next call date"
                          >
                            + Schedule
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{format(new Date(lead.updatedAt), 'MMM d, yyyy')}</td>
                      <td className="px-3 py-2">
                        {lead.status ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                            style={{ backgroundColor: lead.status.color + '20', color: lead.status.color }}
                          >
                            {lead.status.label}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {lead.phone && (
                            <a
                               href={`https://api.whatsapp.com/send/?phone=91${encodeURIComponent(lead.phone.replace(/[^0-9]/g, ''))}&text=${encodeURIComponent(`Dear ${lead.name}`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center w-7 h-7 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/40"
                              title="WhatsApp"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            </a>
                          )}
                          {lead.email && (
                            <a
                               href={`https://mail.google.com/mail/u/0/?to=${encodeURIComponent(lead.email)}&body=${encodeURIComponent(`Dear ${lead.name}`)}&fs=1&tf=cm`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center w-7 h-7 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/40"
                              title="Email"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </a>
                          )}
                          <button
                            onClick={() => handleStartFlow(lead)}
                            disabled={startingFlow === lead.id}
                            className={`inline-flex items-center justify-center w-7 h-7 rounded transition-colors ${
                              startingFlow === lead.id
                                ? 'bg-purple-200 text-purple-400 cursor-wait'
                                : 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/40'
                            }`}
                            title="Start Process Sutra Flow"
                            aria-label="Start flow"
                          >
                            {startingFlow === lead.id ? (
                              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => handleViewLead(lead)}
                            className="inline-flex items-center justify-center w-7 h-7 bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition-colors dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/30"
                            title="View Details"
                            aria-label="View details"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              totalItems={filteredLeads.length}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {selectedLead && (
        <LeadDetailDialog
          leadId={selectedLead.id}
          statuses={campaignStatuses}
          onClose={() => setSelectedLead(null)}
          onUpdate={() => {
            setSelectedLead(null);
            loadData();
            syncWithDelay(500);
          }}
        />
      )}
    </Layout>
  );
}
