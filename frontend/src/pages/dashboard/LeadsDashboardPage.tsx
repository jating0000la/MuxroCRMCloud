import React, { useEffect, useState } from 'react';
import { dashboardService } from '../../services/dashboard';
import { campaignService } from '../../services/campaigns';
import { Lead, Campaign } from '../../types';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/layout/Layout';
import Pagination from '../../components/common/Pagination';
import StatusUpdateDialog from '../../components/leads/StatusUpdateDialog';
import { downloadCsv } from '../../utils/csv';
import { format } from 'date-fns';

const PAGE_SIZE = 25;

type SortField = 'name' | 'campaign' | 'status' | 'doer' | 'source' | 'updatedAt';
type SortDir = 'asc' | 'desc';

export default function LeadsDashboardPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadData();
  }, [selectedCampaign]);

  const loadData = async () => {
    try {
      const [leadsData, campaignsData] = await Promise.all([
        dashboardService.getAllLeadsDashboard(selectedCampaign || undefined),
        campaignService.getAll(),
      ]);
      setLeads(leadsData);
      setCampaigns(campaignsData);
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setLoading(false);
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
      return matchSearch && matchSource;
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
        case 'source':
          comparison = a.source.localeCompare(b.source);
          break;
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [selectedCampaign, search, sourceFilter]);

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

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Campaign', 'Doer', 'Status', 'Source', 'Last Updated'];
    const rows = filteredLeads.map((l) => [
      l.name,
      l.email || '',
      l.phone || '',
      l.campaign?.name || '',
      l.doer?.name || 'Unassigned',
      l.status?.label || 'No status',
      l.source,
      format(new Date(l.updatedAt), 'MMM d, yyyy'),
    ]);

    downloadCsv(`leads-${format(new Date(), 'yyyy-MM-dd')}.csv`, headers, rows);
  };

  return (
    <Layout>
      <div className="sleek-page p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-4">
          <div>
            <p className="text-gray-500">Manage and track all your leads across campaigns</p>
          </div>
          {user?.role === 'ADMIN' && (
            <button
              onClick={exportToCSV}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          )}
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
              {search || selectedCampaign || sourceFilter ? 'Try adjusting your filters' : 'Import leads to get started'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      onClick={() => handleSort('name')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    >
                      Name <SortIcon field="name" />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                    <th
                      onClick={() => handleSort('campaign')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    >
                      Campaign <SortIcon field="campaign" />
                    </th>
                    <th
                      onClick={() => handleSort('doer')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    >
                      Doer <SortIcon field="doer" />
                    </th>
                    <th
                      onClick={() => handleSort('status')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    >
                      Status <SortIcon field="status" />
                    </th>
                    <th
                      onClick={() => handleSort('source')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    >
                      Source <SortIcon field="source" />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-primary-700">{lead.name.charAt(0)}</span>
                          </div>
                          <span className="ml-3 font-medium text-gray-900">{lead.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{lead.email || '-'}</div>
                        <div className="text-sm text-gray-500">{lead.phone || '-'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{lead.campaign?.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {lead.doer?.name || <span className="text-gray-400 italic">Unassigned</span>}
                      </td>
                      <td className="px-6 py-4">
                        {lead.status ? (
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{ backgroundColor: lead.status.color + '20', color: lead.status.color }}
                          >
                            {lead.status.label}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">No status</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          lead.source === 'form' ? 'bg-blue-100 text-blue-700' :
                          lead.source === 'bulk' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {lead.source}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              totalItems={filteredLeads.length}
              onPageChange={setPage}
            />
          </div>
        )}

        {/* Status Update Dialog */}
        {selectedLead && (
          <StatusUpdateDialog
            lead={selectedLead}
            statuses={
              campaigns.find((c) => c.id === selectedLead.campaignId)?.statuses || []
            }
            onClose={() => setSelectedLead(null)}
            onUpdate={() => {
              setSelectedLead(null);
              loadData();
            }}
          />
        )}
      </div>
    </Layout>
  );
}
