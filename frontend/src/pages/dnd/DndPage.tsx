import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { leadService } from '../../services/leads';
import { campaignService } from '../../services/campaigns';
import { statusService } from '../../services/statuses';
import { Lead, Campaign, CampaignStatus } from '../../types';
import Layout from '../../components/layout/Layout';
import Pagination from '../../components/common/Pagination';
import LeadDetailDialog from '../../components/leads/LeadDetailDialog';
import { downloadCsv } from '../../utils/csv';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const DEFAULT_PAGE_SIZE = 50;

export default function DndPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [campaignStatuses, setCampaignStatuses] = useState<CampaignStatus[]>([]);
  const [removingDndId, setRemovingDndId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setError(null);
    try {
      const [leadsData, campaignsData] = await Promise.all([
        leadService.getDnd(),
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

  const filteredLeads = leads.filter((lead) => {
    const matchCampaign = !selectedCampaign || lead.campaignId === selectedCampaign;
    const matchSearch =
      !search ||
      lead.name.toLowerCase().includes(search.toLowerCase()) ||
      lead.email?.toLowerCase().includes(search.toLowerCase()) ||
      lead.phone?.includes(search);
    return matchCampaign && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [selectedCampaign, search, pageSize]);

  const handleViewLead = (lead: Lead) => {
    setSelectedLead(lead);
    loadCampaignStatuses(lead.campaignId);
  };

  const handleRemoveDnd = async (lead: Lead) => {
    if (removingDndId) return;
    if (!confirm(`Remove DND for ${lead.name}?`)) return;
    setRemovingDndId(lead.id);
    try {
      await leadService.updateStatus(lead.id, {
        status: lead.status?.label || 'Updated',
        statusId: lead.statusId || undefined,
        dnd: false,
        remarks: 'DND removed',
      });
      toast.success('DND removed');
      loadData();
    } catch (error) {
      toast.error('Failed to remove DND');
    } finally {
      setRemovingDndId(null);
    }
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Campaign', 'Doer', 'Source', 'Date'];
    const rows = filteredLeads.map((lead) => [
      lead.name,
      lead.email || '',
      lead.phone || '',
      lead.campaign?.name || '',
      lead.doer?.name || '',
      lead.source,
      format(new Date(lead.createdAt), 'MMM d, yyyy'),
    ]);

    downloadCsv(`dnd-leads-${format(new Date(), 'yyyy-MM-dd')}.csv`, headers, rows);
  };

  const clearFilters = () => {
    setSearch('');
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
            <button onClick={loadData} className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium dark:bg-red-900/30 dark:text-red-400">
              Retry
            </button>
          </div>
        </div>
      )}
      <div className="sleek-page p-3 lg:p-4">

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border dark:bg-gray-800 dark:border-gray-700">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No DND leads</h3>
            <p className="text-gray-500 mt-1 dark:text-gray-400">
              {search || selectedCampaign
                ? 'Try adjusting your filters'
                : 'No leads have been marked as DND'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden dark:bg-gray-800 dark:border-gray-700">
            <div className="border-b border-gray-200 bg-gray-50/80 px-3 py-2 dark:border-b dark:border-gray-700 dark:bg-gray-900/50">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                <div className="lg:col-span-4 relative">
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
                  className="lg:col-span-3 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 dark:border-gray-600"
                >
                  <option value="">All campaigns</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <div className="lg:col-span-5 flex items-center justify-end gap-2 flex-wrap">
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
                  <button
                    onClick={loadData}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Refresh
                  </button>
                  {user?.role === 'ADMIN' && (
                    <button
                      onClick={exportToCSV}
                      className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 text-xs font-semibold dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Export CSV
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Showing {paginatedLeads.length} of {filteredLeads.length} filtered DND leads ({leads.length} total)
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Lead</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Contact</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Campaign</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Doer</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Source</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50 transition-colors dark:hover:bg-gray-700/50">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center dark:bg-red-900/30">
                            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </div>
                          <span className="ml-2.5 font-medium text-gray-900 text-sm dark:text-gray-100">{lead.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-sm text-gray-900 leading-tight dark:text-gray-100">{lead.email || '-'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{lead.phone || '-'}</div>
                      </td>
                      <td className="px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400">{lead.campaign?.name}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400">{lead.doer?.name || '-'}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          lead.source === 'form' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          lead.source === 'bulk' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {lead.source}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                        {format(new Date(lead.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewLead(lead)}
                            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleRemoveDnd(lead)}
                            disabled={removingDndId === lead.id}
                            className="text-green-600 hover:text-green-700 text-sm font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
                          >
                            {removingDndId === lead.id ? 'Removing...' : 'Remove DND'}
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
