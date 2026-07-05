import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/dashboard';
import { campaignService } from '../../services/campaigns';
import { statusService } from '../../services/statuses';
import integrationService from '../../services/integrations';
import { Lead, Campaign, CampaignStatus } from '../../types';
import Layout from '../../components/layout/Layout';
import LeadDetailDialog from '../../components/leads/LeadDetailDialog';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

type SortField = 'name' | 'campaign' | 'status' | 'doer' | 'dueDate' | 'updatedAt';
type SortDir = 'asc' | 'desc';

export default function FollowupDashboardPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [dndFilter, setDndFilter] = useState<'all' | 'dnd' | 'no_dnd'>('all');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [campaignStatuses, setCampaignStatuses] = useState<CampaignStatus[]>([]);
  const [startingFlow, setStartingFlow] = useState<string | null>(null);

  // Process Sutra settings (loaded from localStorage or settings page)
  const getProcessSutraSettings = () => {
    try {
      const saved = localStorage.getItem('processSutraSettings');
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore corrupted data
    }
    return { apiKey: '', systemName: '' };
  };

  useEffect(() => {
    loadData();
  }, [selectedCampaign]);

  const loadData = async () => {
    setError(null);
    try {
      const [leadsData, campaignsData] = await Promise.all([
        dashboardService.getAllLeadsDashboard(selectedCampaign || undefined),
        campaignService.getAll(),
      ]);
      setLeads(leadsData);
      setCampaigns(campaignsData);
    } catch (error) {
      console.error('Failed to load data', error);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
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
      return matchSearch && matchSource && matchDnd;
    })
    .sort((a, b) => {
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <svg className={`w-4 h-4 inline-block ml-1 ${sortField === field ? 'text-primary-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    const headers = ['Lead ID', 'Campaign', 'Name', 'Phone', 'Due Date', 'Last Updated', 'Status', 'Remark'];
    const rows = filteredLeads.map((l) => [
      l.id.slice(0, 8),
      l.campaign?.name || '',
      l.name,
      l.phone || '',
      l.followups?.[0]?.nextCallDate ? format(new Date(l.followups[0].nextCallDate), 'MMM d, yyyy h:mm a') : '',
      format(new Date(l.updatedAt), 'MMM d, yyyy'),
      l.status?.label || '',
      l.followups?.[0]?.remarks || '',
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      {error && (
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700">{error}</span>
            </div>
            <button onClick={loadData} className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium">
              Retry
            </button>
          </div>
        </div>
      )}
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {user?.role === 'USER' ? 'My Leads' : 'All Leads'}
            </h1>
            <p className="text-gray-500 mt-1">
              {user?.role === 'USER' ? 'View and manage your assigned leads' : 'Manage and track all leads across campaigns'}
            </p>
          </div>
          <button
            onClick={exportToCSV}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Sources</option>
              {uniqueSources.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={dndFilter}
              onChange={(e) => setDndFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Leads</option>
              <option value="no_dnd">Non-DND Only</option>
              <option value="dnd">DND Only</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            Showing {filteredLeads.length} of {leads.length} leads
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900">No leads found</h3>
            <p className="text-gray-500 mt-1">
              {search || selectedCampaign || sourceFilter || dndFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Import leads to get started'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead ID</th>
                    <th
                      onClick={() => handleSort('campaign')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    >
                      Campaign <SortIcon field="campaign" />
                    </th>
                    <th
                      onClick={() => handleSort('name')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    >
                      Name <SortIcon field="name" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th
                      onClick={() => handleSort('dueDate')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    >
                      Due Date <SortIcon field="dueDate" />
                    </th>
                    <th
                      onClick={() => handleSort('updatedAt')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    >
                      Updated <SortIcon field="updatedAt" />
                    </th>
                    <th
                      onClick={() => handleSort('status')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    >
                      Status <SortIcon field="status" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remark</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{lead.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[120px]">{lead.campaign?.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${lead.dnd ? 'bg-red-100' : 'bg-primary-100'}`}>
                            {lead.dnd ? (
                              <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            ) : (
                              <span className="text-xs font-medium text-primary-700">{lead.name.charAt(0)}</span>
                            )}
                          </div>
                          <div className="ml-2 min-w-0">
                            <p className="font-medium text-gray-900 truncate text-sm">{lead.name}</p>
                            {lead.dnd && <span className="text-xs text-red-600 font-medium">DND</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{lead.phone || '-'}</td>
                      <td className="px-4 py-3">
                        {lead.followups?.[0]?.nextCallDate ? (
                          <span className={`text-xs font-medium ${
                            new Date(lead.followups[0].nextCallDate) < new Date()
                              ? 'text-red-600'
                              : new Date(lead.followups[0].nextCallDate).toDateString() === new Date().toDateString()
                                ? 'text-amber-600'
                                : 'text-gray-900'
                          }`}>
                            {format(new Date(lead.followups[0].nextCallDate), 'MMM d, h:mm a')}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{format(new Date(lead.updatedAt), 'MMM d, yyyy')}</td>
                      <td className="px-4 py-3">
                        {lead.status ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                            style={{ backgroundColor: lead.status.color + '20', color: lead.status.color }}
                          >
                            {lead.status.label}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[120px] truncate" title={lead.followups?.[0]?.remarks || ''}>
                        {lead.followups?.[0]?.remarks || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {lead.phone && (
                            <a
                               href={`https://api.whatsapp.com/send/?phone=91${encodeURIComponent(lead.phone.replace(/[^0-9]/g, ''))}&text=${encodeURIComponent(`Dear ${lead.name}`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center w-7 h-7 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
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
                              className="inline-flex items-center justify-center w-7 h-7 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
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
                                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
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
                            className="inline-flex items-center justify-center w-7 h-7 bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition-colors"
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
          </div>
        )}
      </div>

      {/* Lead Detail Dialog */}
      {selectedLead && (
        <LeadDetailDialog
          leadId={selectedLead.id}
          statuses={campaignStatuses}
          onClose={() => setSelectedLead(null)}
          onUpdate={() => {
            setSelectedLead(null);
            loadData();
          }}
        />
      )}
    </Layout>
  );
}
