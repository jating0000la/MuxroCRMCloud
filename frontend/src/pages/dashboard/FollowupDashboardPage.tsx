import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { dashboardService } from '../../services/dashboard';
import { campaignService } from '../../services/campaigns';
import { statusService } from '../../services/statuses';
import integrationService from '../../services/integrations';
import { followupService } from '../../services/followups';
import { leadService } from '../../services/leads';
import { Lead, Campaign, CampaignStatus } from '../../types';
import Layout from '../../components/layout/Layout';
import Pagination from '../../components/common/Pagination';
import LeadDetailDialog from '../../components/leads/LeadDetailDialog';
import { downloadCsv } from '../../utils/csv';
import { format, isToday, isTomorrow, isPast, startOfDay, endOfDay, addDays, addMinutes, isAfter, isBefore, subHours } from 'date-fns';
import toast from 'react-hot-toast';

const DEFAULT_PAGE_SIZE = 50;

type SortField = 'name' | 'campaign' | 'status' | 'doer' | 'dueDate' | 'updatedAt';
type SortDir = 'asc' | 'desc';
type DueFilter = 'all' | 'missed' | 'due' | 'upcoming' | 'today' | 'completed';

export default function FollowupDashboardPage() {
  const { user } = useAuth();
  const { notifications, syncWithDelay } = useNotifications();

  // Data
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [dndFilter, setDndFilter] = useState<'all' | 'dnd' | 'no_dnd'>('all');
  const [dueFilter, setDueFilter] = useState<DueFilter>('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [availableStatuses, setAvailableStatuses] = useState<CampaignStatus[]>([]);

  // Sort & Pagination
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Dialogs
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [campaignStatuses, setCampaignStatuses] = useState<CampaignStatus[]>([]);
  const [startingFlow, setStartingFlow] = useState<string | null>(null);
  const [showNotifBanner, setShowNotifBanner] = useState(true);

  const canManage = user?.role === 'ADMIN';
  const hasProcessSutra = useMemo(() => {
    try {
      const saved = localStorage.getItem('processSutraSettings');
      if (saved) {
        const s = JSON.parse(saved);
        return !!s.apiKey && !!s.systemName;
      }
    } catch {}
    return false;
  }, []);

  // ── Data Loading ──────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [leadsRaw, campaignsData] = await Promise.all([
        dashboardService.getAllLeadsDashboard(selectedCampaign || undefined),
        campaignService.getAll(),
      ]);
      const leadsData = Array.isArray(leadsRaw) ? leadsRaw : (leadsRaw as any).data;
      // Deduplicate by lead ID as a safety net against backend returning duplicates
      const deduped = leadsData.filter((lead: any, idx: number, arr: any[]) =>
        arr.findIndex((l: any) => l.id === lead.id) === idx,
      );
      setLeads(deduped);
      setCampaigns(campaignsData);
      setLoaded(true);
    } catch (err) {
      console.error('Failed to load data', err);
      setError('Failed to load dashboard data. Please try again.');
      setLoaded(true);
    }
  }, [selectedCampaign]);

  // Auto-refresh every 10s only when page is visible
  useEffect(() => {
    loadData();
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startInterval = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (!selectedLead && !document.hidden) loadData();
      }, 10000);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalId) { clearInterval(intervalId); intervalId = null; }
      } else {
        loadData();
        startInterval();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    startInterval();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (intervalId) clearInterval(intervalId);
    };
  }, [selectedLead, loadData]);

  // Load statuses for filter dropdown
  useEffect(() => {
    const loadStatuses = async () => {
      if (selectedCampaign) {
        try {
          const statuses = await statusService.getByCampaign(selectedCampaign);
          setAvailableStatuses(statuses);
        } catch {
          setAvailableStatuses([]);
        }
      } else {
        const unique = new Map<string, CampaignStatus>();
        leads.forEach((l) => {
          if (l.status && !unique.has(l.status.id)) unique.set(l.status.id, l.status);
        });
        setAvailableStatuses(Array.from(unique.values()));
      }
      setStatusFilter('');
    };
    loadStatuses();
  }, [selectedCampaign, leads]);

  // Document title
  useEffect(() => {
    const upcoming = notifications.filter((n) => n.type === 'upcoming').length;
    document.title = upcoming > 0 ? `(${upcoming}) Follow-ups` : 'Follow-ups';
    return () => { document.title = 'CRM'; };
  }, [notifications]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [selectedCampaign, search, sourceFilter, dndFilter, dueFilter, statusFilter, pageSize]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleStartFlow = async (lead: Lead) => {
    if (!confirm(`Start Process Sutra flow for "${lead.name}"?`)) return;
    try {
      const saved = localStorage.getItem('processSutraSettings');
      const settings = saved ? JSON.parse(saved) : {};
      if (!settings.apiKey || !settings.systemName) {
        toast.error('Process Sutra not configured. Go to Settings.');
        return;
      }
      setStartingFlow(lead.id);
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
        toast.success(`Flow started for ${lead.name}`);
      } else {
        toast.error(result.message || 'Failed to start flow');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to start flow');
    } finally {
      setStartingFlow(null);
    }
  };

  const handleViewLead = (lead: Lead) => {
    setSelectedLead(lead);
    if (lead.campaignId) {
      statusService.getByCampaign(lead.campaignId).then(setCampaignStatuses).catch(() => {});
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setSourceFilter('');
    setDndFilter('all');
    setDueFilter('all');
    setStatusFilter('');
    setSelectedCampaign('');
  };

  // ── Computed ──────────────────────────────────────────────────
  const uniqueSources = useMemo(() => [...new Set(leads.map((l) => l.source))], [leads]);

  const twoHoursAgo = subHours(new Date(), 2);

  // Missed: nextCallDate < twoHoursAgo
  const activeCampaignIds = useMemo(() => new Set(campaigns.filter((c) => c.isActive).map((c) => c.id)), [campaigns]);
  const campaignsLoaded = campaigns.length > 0;

  const missedCount = useMemo(() => {
    return leads.filter((l) => {
      if (campaignsLoaded && !activeCampaignIds.has(l.campaignId)) return false;
      const next = l.followups?.[0]?.nextCallDate;
      if (!next) return false;
      const nextDate = new Date(next);
      return isBefore(nextDate, twoHoursAgo) && !(l.status?.label || '').toLowerCase().includes('completed');
    }).length;
  }, [leads, activeCampaignIds, campaignsLoaded]);

  // Pending: nextCallDate > twoHoursAgo AND nextCallDate < now
  const dueCount = useMemo(() => {
    const now = new Date();
    return leads.filter((l) => {
      if (campaignsLoaded && !activeCampaignIds.has(l.campaignId)) return false;
      const next = l.followups?.[0]?.nextCallDate;
      if (!next) return false;
      const nextDate = new Date(next);
      return isAfter(nextDate, twoHoursAgo) && isBefore(nextDate, now) && !(l.status?.label || '').toLowerCase().includes('completed');
    }).length;
  }, [leads, activeCampaignIds, campaignsLoaded]);

  const todayCount = useMemo(() => {
    return leads.filter((l) => {
      if (campaignsLoaded && !activeCampaignIds.has(l.campaignId)) return false;
      const next = l.followups?.[0]?.nextCallDate;
      return next && isToday(new Date(next)) && !(l.status?.label || '').toLowerCase().includes('completed');
    }).length;
  }, [leads, activeCampaignIds, campaignsLoaded]);

  const upcomingCount = useMemo(() => {
    const now = new Date();
    const tenMinutesFromNow = addMinutes(now, 10);
    return leads.filter((l) => {
      if (campaignsLoaded && !activeCampaignIds.has(l.campaignId)) return false;
      const next = l.followups?.[0]?.nextCallDate;
      if (!next) return false;
      const nextDate = new Date(next);
      return isAfter(nextDate, now) && isBefore(nextDate, tenMinutesFromNow) && !(l.status?.label || '').toLowerCase().includes('completed');
    }).length;
  }, [leads, activeCampaignIds, campaignsLoaded]);

  const getUrgencyScore = useCallback((lead: Lead) => {
    const notif = notifications.find((n) => n.followupId === lead.followups?.[0]?.id);
    if (notif?.type === 'upcoming') return 1;
    return 3;
  }, [notifications]);

  const getRowHighlight = useCallback((lead: Lead): string => {
    const notif = notifications.find((n) => n.followupId === lead.followups?.[0]?.id);
    if (!notif) return '';
    if (notif.type === 'upcoming') return 'bg-blue-50/80 dark:bg-blue-950/30 border-l-[3px] border-l-blue-500';
    return '';
  }, [notifications]);

  const filteredLeads = useMemo(() => {
    const now = new Date();
    const startToday = startOfDay(now);
    const endToday = endOfDay(now);
    const after3 = addDays(now, 3);
    const twoHoursAgo = subHours(now, 2);
    const tenMinutesFromNow = addMinutes(now, 10);

    return leads
      .filter((lead) => {
        if (campaignsLoaded && !activeCampaignIds.has(lead.campaignId)) return false;
        if (search) {
          const q = search.toLowerCase();
          const matchName = lead.name.toLowerCase().includes(q);
          const matchEmail = lead.email?.toLowerCase().includes(q);
          const matchPhone = lead.phone?.includes(search);
          if (!matchName && !matchEmail && !matchPhone) return false;
        }
        if (sourceFilter && lead.source !== sourceFilter) return false;
        if (dndFilter === 'dnd' && !lead.dnd) return false;
        if (dndFilter === 'no_dnd' && lead.dnd) return false;

        const nextCall = lead.followups?.[0]?.nextCallDate ? new Date(lead.followups[0].nextCallDate) : null;
        const isCompleted = (lead.status?.label || '').toLowerCase().includes('completed');

        if (dueFilter === 'missed' && (!nextCall || !isBefore(nextCall, twoHoursAgo) || isCompleted)) return false;
        if (dueFilter === 'due' && (!nextCall || !isAfter(nextCall, twoHoursAgo) || !isBefore(nextCall, now) || isCompleted)) return false;
        if (dueFilter === 'upcoming' && (!nextCall || !isAfter(nextCall, now) || !isBefore(nextCall, tenMinutesFromNow) || isCompleted)) return false;
        if (dueFilter === 'today' && (!nextCall || !isToday(nextCall) || isCompleted)) return false;
        if (statusFilter && lead.status?.label !== statusFilter) return false;

        return true;
      })
      .sort((a, b) => {
        const urgencyDiff = getUrgencyScore(a) - getUrgencyScore(b);
        if (urgencyDiff !== 0) return urgencyDiff;

        let cmp = 0;
        switch (sortField) {
          case 'name': cmp = a.name.localeCompare(b.name); break;
          case 'campaign': cmp = (a.campaign?.name || '').localeCompare(b.campaign?.name || ''); break;
          case 'status': cmp = (a.status?.label || '').localeCompare(b.status?.label || ''); break;
          case 'doer': cmp = (a.doer?.name || '').localeCompare(b.doer?.name || ''); break;
          case 'dueDate': {
            const ad = a.followups?.[0]?.nextCallDate;
            const bd = b.followups?.[0]?.nextCallDate;
            if (!ad && !bd) cmp = 0;
            else if (!ad) cmp = 1;
            else if (!bd) cmp = -1;
            else cmp = new Date(ad).getTime() - new Date(bd).getTime();
            break;
          }
          case 'updatedAt': cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(); break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [leads, activeCampaignIds, campaignsLoaded, search, sourceFilter, dndFilter, dueFilter, statusFilter, sortField, sortDir, getUrgencyScore]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
    downloadCsv(`followups-${format(new Date(), 'yyyy-MM-dd')}.csv`, headers, rows);
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <svg className={`w-3.5 h-3.5 inline-block ml-0.5 ${sortField === field ? 'text-primary-600' : 'text-gray-300 dark:text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {sortField === field && sortDir === 'desc' ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
      )}
    </svg>
  );

  // ── Due Date Cell ─────────────────────────────────────────────
  const DueDateCell = ({ lead }: { lead: Lead }) => {
    const nextCall = lead.followups?.[0]?.nextCallDate;

    if (!nextCall) {
      return <span className="text-xs text-gray-400 dark:text-gray-600">-</span>;
    }

    const date = new Date(nextCall);
    const isOverdue = isPast(date) && !isToday(date);
    const isDueToday = isToday(date);
    const isDueTomorrow = isTomorrow(date);

    return (
      <div className="text-left">
        <span className={`text-xs font-medium ${
          isOverdue ? 'text-red-600 dark:text-red-400' :
          isDueToday ? 'text-amber-600 dark:text-amber-400' :
          isDueTomorrow ? 'text-emerald-600 dark:text-emerald-400' :
          'text-gray-700 dark:text-gray-300'
        }`}>
          {format(date, 'MMM d, h:mm a')}
        </span>
        <span className="block text-[10px] text-gray-400 dark:text-gray-600">
          {isOverdue ? 'overdue' : isDueToday ? 'today' : isDueTomorrow ? 'tomorrow' : 'scheduled'}
        </span>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <Layout>
      {error && (
        <div className="p-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between dark:bg-red-950/30 dark:border-red-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center dark:bg-red-900/40">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
            </div>
            <button onClick={loadData} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-xs font-semibold dark:bg-red-900/30 dark:text-red-400">Retry</button>
          </div>
        </div>
      )}

      <div className="sleek-page p-3 lg:p-4">
        {/* Header Bar */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Follow-ups</h1>
            <span className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>
        </div>

        {/* Notification Banner */}
        {notifications.length > 0 && showNotifBanner && (
          <div className="mb-3 bg-gradient-to-r from-red-50 via-amber-50 to-red-50 border border-red-200/60 rounded-xl p-3 dark:from-red-950/30 dark:via-amber-950/20 dark:to-red-950/30 dark:border-red-800/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center dark:bg-red-900/40 flex-shrink-0">
                  <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                    {notifications.length} Pending Follow-up{notifications.length > 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">

                    {todayCount > 0 && <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{todayCount} due today</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowNotifBanner(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        )}

        {!loaded ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
            {/* Skeleton loader */}
            <div className="border-b border-gray-100 bg-gray-50/50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900/30">
              <div className="flex gap-2">
                <div className="h-8 bg-gray-200 rounded-lg animate-pulse flex-1 dark:bg-gray-700" />
                <div className="h-8 bg-gray-200 rounded-lg w-32 animate-pulse dark:bg-gray-700" />
                <div className="h-8 bg-gray-200 rounded-lg w-24 animate-pulse dark:bg-gray-700" />
              </div>
              <div className="flex gap-1.5 mt-2">
                {[1,2,3,4,5].map((i) => <div key={i} className="h-6 bg-gray-200 rounded-lg w-16 animate-pulse dark:bg-gray-700" />)}
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {[1,2,3,4,5,6,7,8].map((i) => (
                <div key={i} className="px-3 py-3 flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-2 bg-gray-200 rounded dark:bg-gray-700" />
                  <div className="w-20 h-2 bg-gray-200 rounded dark:bg-gray-700" />
                  <div className="w-32 h-2 bg-gray-200 rounded dark:bg-gray-700" />
                  <div className="w-16 h-2 bg-gray-200 rounded dark:bg-gray-700" />
                  <div className="flex-1" />
                  <div className="w-24 h-2 bg-gray-200 rounded dark:bg-gray-700" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
            {/* Filters */}
            <div className="border-b border-gray-100 bg-gray-50/50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900/30">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                <div className="lg:col-span-3 relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input type="text" placeholder="Search name, phone, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
                </div>
                <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)} className="lg:col-span-2 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                  <option value="">All Campaigns</option>
                  {campaigns.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
                <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="lg:col-span-2 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                  <option value="">All Sources</option>
                  {uniqueSources.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
                <select value={dndFilter} onChange={(e) => setDndFilter(e.target.value as any)} className="lg:col-span-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                  <option value="all">All</option>
                  <option value="no_dnd">Non-DND</option>
                  <option value="dnd">DND</option>
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="lg:col-span-2 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                  <option value="">All Status</option>
                  {availableStatuses.map((s) => (<option key={s.id} value={s.label}>{s.label}</option>))}
                </select>
                <div className="lg:col-span-2 flex items-center justify-end gap-1.5">
                  <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <button onClick={clearFilters} className="px-2 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors">Clear</button>
                  {canManage && (
                    <button onClick={exportToCSV} className="px-2 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors">Export</button>
                  )}
                </div>
              </div>

              {/* Due filter chips */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {([
                  { key: 'all' as DueFilter, label: 'All', count: leads.length },
                  { key: 'missed' as DueFilter, label: 'Missed (>2h)', count: missedCount },
                  { key: 'due' as DueFilter, label: 'Pending (<2h)', count: dueCount },
                  { key: 'upcoming' as DueFilter, label: 'Upcoming (10 min)', count: upcomingCount },
                  { key: 'today' as DueFilter, label: 'Today', count: todayCount }
                ]).map((chip) => (
                  <button
                    key={chip.key}
                    onClick={() => setDueFilter(chip.key)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                      dueFilter === chip.key
                        ? 'bg-primary-100 text-primary-700 border border-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-700'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-700'
                    }`}
                  >
                    {chip.label}
                    {chip.key === 'missed' && missedCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-red-200 text-red-700 rounded-full dark:bg-red-900/50 dark:text-red-300">{missedCount}</span>
                    )}
                    {chip.key === 'due' && dueCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-orange-100 text-orange-700 rounded-full dark:bg-orange-900/30 dark:text-orange-400">{dueCount}</span>
                    )}
                    {chip.key === 'upcoming' && upcomingCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-600 rounded-full dark:bg-blue-900/30 dark:text-blue-400">{upcomingCount}</span>
                    )}
                    {chip.key === 'today' && todayCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-600 rounded-full dark:bg-amber-900/30 dark:text-amber-400">{todayCount}</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-2 text-[11px] text-gray-400 dark:text-gray-600">
                {paginatedLeads.length} of {filteredLeads.length} leads ({leads.length} total)
              </div>
            </div>

            {/* Table */}
            {filteredLeads.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-gray-700">
                  <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">No leads found</h3>
                <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
                  {search || selectedCampaign || sourceFilter || dndFilter !== 'all' || statusFilter || dueFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Import leads to get started'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
                    <thead className="bg-gray-50/80 dark:bg-gray-900/40">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider dark:text-gray-500">ID</th>
                        <th onClick={() => handleSort('campaign')} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-700 transition-colors select-none">Campaign <SortIcon field="campaign" /></th>
                        <th onClick={() => handleSort('name')} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-700 transition-colors select-none">Name <SortIcon field="name" /></th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider dark:text-gray-500">Phone</th>
                        <th onClick={() => handleSort('dueDate')} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-700 transition-colors select-none">Due <SortIcon field="dueDate" /></th>
                        <th onClick={() => handleSort('updatedAt')} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-700 transition-colors select-none">Updated <SortIcon field="updatedAt" /></th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider dark:text-gray-500">Status</th>
                        <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider dark:text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                      {paginatedLeads.map((lead) => {
                        const highlight = getRowHighlight(lead);
                        return (
                          <tr key={lead.id} className={`transition-colors ${highlight || 'hover:bg-gray-50/50 dark:hover:bg-gray-700/30'}`}>
                            <td className="px-3 py-2 text-[11px] text-gray-400 font-mono dark:text-gray-600">{lead.id.slice(0, 6)}</td>
                            <td className="px-3 py-2 text-xs text-gray-500 truncate max-w-[110px] dark:text-gray-400">{lead.campaign?.name || '-'}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-semibold ${lead.dnd ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'}`}>
                                  {lead.dnd ? (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                  ) : lead.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-gray-900 truncate text-sm leading-tight dark:text-gray-100">{lead.name}</p>
                                  {lead.dnd && <span className="text-[10px] text-red-500 font-semibold uppercase tracking-wide">DND</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{lead.phone || '-'}</td>
                            <td className="px-3 py-2">
                              <DueDateCell lead={lead} />
                            </td>
                            <td className="px-3 py-2 text-[11px] text-gray-400 dark:text-gray-600">{format(new Date(lead.updatedAt), 'MMM d')}</td>
                            <td className="px-3 py-2">
                              {lead.status ? (
                                <span
                                  className="inline-flex max-w-[120px] truncate rounded-full px-1.5 py-0.5 text-[11px] font-medium"
                                  style={{
                                    backgroundColor: (lead.status.color || '#9CA3AF') + '18',
                                    color: lead.status.color || '#9CA3AF',
                                  }}
                                  title={lead.status.label}
                                >
                                  {lead.status.label}
                                </span>
                              ) : (
                                <span className="text-[11px] text-gray-400 dark:text-gray-600">No status</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1">
                                {lead.phone && (
                                  <a
                                    href={`https://api.whatsapp.com/send/?phone=${encodeURIComponent(lead.phone.replace(/[^0-9]/g, ''))}&text=${encodeURIComponent(`Dear ${lead.name}`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                                    title="WhatsApp"
                                  >
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                  </a>
                                )}
                                {lead.email && (
                                  <a
                                    href={`https://mail.google.com/mail/u/0/?to=${encodeURIComponent(lead.email)}&body=${encodeURIComponent(`Dear ${lead.name}`)}&fs=1&tf=cm`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
                                    title="Email"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                  </a>
                                )}
                                {hasProcessSutra && (
                                  <button
                                    onClick={() => handleStartFlow(lead)}
                                    disabled={startingFlow === lead.id}
                                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                                      startingFlow === lead.id
                                        ? 'bg-purple-100 text-purple-400 cursor-wait dark:bg-purple-900/20'
                                        : 'bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/30'
                                    }`}
                                    title="Start Process Sutra Flow"
                                  >
                                    {startingFlow === lead.id ? (
                                      <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                    ) : (
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleViewLead(lead)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                                  title="View Details"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination page={currentPage} pageSize={pageSize} totalItems={filteredLeads.length} onPageChange={setPage} />
              </>
            )}
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
