import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { campaignService } from '../../services/campaigns';
import { leadService } from '../../services/leads';
import { formService } from '../../services/forms';
import { bulkImportService } from '../../services/bulkImport';
import { statusService } from '../../services/statuses';
import { userService } from '../../services/users';
import { Campaign, Lead, Form, User, CampaignStatus } from '../../types';
import Layout from '../../components/layout/Layout';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';
import StatusUpdateDialog from '../../components/leads/StatusUpdateDialog';
import LeadDetailDialog from '../../components/leads/LeadDetailDialog';
import FormBuilder from '../../components/forms/FormBuilder';

const STATUS_COLORS = [
  '#3B82F6', '#F59E0B', '#10B981', '#059669', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316',
];

const DEFAULT_LEAD_PAGE_SIZE = 50;

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { syncWithDelay } = useNotifications();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'leads' | 'forms' | 'users' | 'settings'>('leads');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [showAssignUsers, setShowAssignUsers] = useState(false);
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);
  const [assigningUsers, setAssigningUsers] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState('');
  const [leadPage, setLeadPage] = useState(1);
  const [leadPageSize, setLeadPageSize] = useState(DEFAULT_LEAD_PAGE_SIZE);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status management
  const [newStatusLabel, setNewLabelStatus] = useState('');
  const [newStatusColor, setNewStatusColor] = useState(STATUS_COLORS[0]);
  const [newStatusWhatsapp, setNewStatusWhatsapp] = useState('');
  const [addingStatus, setAddingStatus] = useState(false);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editStatusWhatsapp, setEditStatusWhatsapp] = useState('');

  // Campaign edit
  const [editingCampaign, setEditingCampaign] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [savingCampaign, setSavingCampaign] = useState(false);

  const canManage = user?.role === 'ADMIN';

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [campaignData, leadsData, formsData, assignedUsers] = await Promise.all([
        campaignService.getOne(id!),
        leadService.getByCampaign(id!),
        formService.getByCampaign(id!),
        campaignService.getAssignedUsers(id!),
      ]);
      setCampaign(campaignData);
      setLeads(leadsData);
      setForms(formsData);
      setUsers(assignedUsers.map((au) => au.user!).filter(Boolean));

      if (canManage) {
        const allUsersData = await userService.getAll();
        const filteredUsers = allUsersData.filter((u: User) => u.role === 'USER');
        setAllUsers(filteredUsers);
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        toast.error('You do not have access to this campaign');
      } else {
        toast.error('Failed to load campaign data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCampaign = async () => {
    if (!editName.trim()) {
      toast.error('Campaign name is required');
      return;
    }
    setSavingCampaign(true);
    try {
      const updated = await campaignService.update(id!, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        isActive: editIsActive,
      });
      setCampaign(updated);
      setEditingCampaign(false);
      toast.success('Campaign updated');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update campaign');
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleBulkImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const result = await bulkImportService.importCSV(id!, file);
      toast.success(`Successfully imported ${result.imported} leads`);
      setShowBulkImport(false);
      setFile(null);
      loadData();
    } catch (error: any) {
      if (error.response?.status === 403) {
        toast.error('You do not have permission to import leads');
      } else {
        toast.error(error.response?.data?.message || 'Failed to import leads');
      }
    } finally {
      setImporting(false);
    }
  };

  const handleAssignUsers = async (userIds: string[]) => {
    if (userIds.length === 0 && !confirm('Remove all users from this campaign? New leads cannot be assigned until a telecaller is added.')) {
      return;
    }
    setAssigningUsers(true);
    try {
      await campaignService.assignUsers(id!, userIds);
      toast.success('Users assigned successfully');
      setShowAssignUsers(false);
      loadData();
      syncWithDelay(500); // Sync notifications after users assigned
    } catch (error: any) {
      if (error.response?.status === 403) {
        toast.error('You do not have permission to assign users');
      } else {
        toast.error('Failed to assign users');
      }
      } finally {
        setAssigningUsers(false);
    }
  };

    const openAssignUsers = () => {
      setAssignUserIds(users.map((assignedUser) => assignedUser.id));
      setShowAssignUsers(true);
    };

    const toggleAssignUser = (userId: string) => {
      setAssignUserIds((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      );
    };

  const handleCreateForm = async (title: string, fields: any[]) => {
    try {
      const form = await formService.create(id!, { title, fields });
      await formService.publish(id!, form.id);
      toast.success('Form created and published');
      setShowFormBuilder(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create form');
    }
  };

  const handleUpdateForm = async (title: string, fields: any[]) => {
    if (!editingForm) return;
    try {
      await formService.update(id!, editingForm.id, { title, fields } as any);
      toast.success('Form updated');
      setEditingForm(null);
      setShowFormBuilder(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update form');
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const matchSearch =
      !leadSearch ||
      lead.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
      lead.email?.toLowerCase().includes(leadSearch.toLowerCase()) ||
      lead.phone?.includes(leadSearch);
    const matchStatus = !leadStatusFilter || lead.statusId === leadStatusFilter;
    return matchSearch && matchStatus;
  });

  const totalLeadPages = Math.max(1, Math.ceil(filteredLeads.length / leadPageSize));
  const currentLeadPage = Math.min(leadPage, totalLeadPages);
  const paginatedLeads = filteredLeads.slice((currentLeadPage - 1) * leadPageSize, currentLeadPage * leadPageSize);

  useEffect(() => {
    setLeadPage(1);
  }, [leadSearch, leadStatusFilter, leadPageSize]);

  const clearLeadFilters = () => {
    setLeadSearch('');
    setLeadStatusFilter('');
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      </Layout>
    );
  }

  if (!campaign) {
    return (
      <Layout>
        <div className="p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Campaign not found</h2>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="sleek-page p-3 lg:p-4">
        {/* Header */}
        <div className="mb-3">
          <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Campaigns</span>
            <span>/</span>
            <span className="text-gray-900 dark:text-gray-100">{campaign.name}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{campaign.name}</h1>
              {campaign.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{campaign.description}</p>
              )}
            </div>
            {canManage && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setEditName(campaign.name);
                    setEditDescription(campaign.description || '');
                    setEditIsActive(campaign.isActive);
                    setEditingCampaign(true);
                  }}
                  className="inline-flex items-center px-2.5 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50 text-xs font-semibold"
                >
                  <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => setShowBulkImport(true)}
                  className="inline-flex items-center px-2.5 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs font-semibold"
                >
                  <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Import CSV
                </button>
                {forms.length === 0 && (
                  <button
                    onClick={() => setShowFormBuilder(true)}
                    className="inline-flex items-center px-2.5 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-xs font-semibold"
                  >
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    New Form
                  </button>
                )}
                <button
                  onClick={openAssignUsers}
                  className="inline-flex items-center px-2.5 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-xs font-semibold"
                >
                  <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Assign Users
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-b dark:border-gray-700 mb-3">
          <nav className="flex space-x-8">
            {([
              { key: 'leads' as const, label: 'Leads', count: leads.length },
              { key: 'forms' as const, label: 'Forms', count: forms.length },
              { key: 'users' as const, label: 'Team Members', count: users.length },
              ...(canManage ? [{ key: 'settings' as const, label: 'Settings', count: 0 }] : []),
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {tab.label}
                {tab.key !== 'settings' && (
                  <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                    activeTab === tab.key ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Leads Tab */}
        {activeTab === 'leads' && (
          <div>
            {/* Leads Table */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden dark:bg-gray-800 dark:border-gray-700">
              <div className="border-b border-gray-200 bg-gray-50/80 px-3 py-2 dark:border-b dark:border-gray-700 dark:bg-gray-900/50">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                  <div className="lg:col-span-5 relative">
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search leads"
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                  </div>
                  <select
                    value={leadStatusFilter}
                    onChange={(e) => setLeadStatusFilter(e.target.value)}
                    className="lg:col-span-2 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  >
                    <option value="">All status</option>
                    {campaign.statuses?.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                  <div className="lg:col-span-5 flex items-center justify-end gap-2 flex-wrap">
                    <select
                      value={leadPageSize}
                      onChange={(e) => setLeadPageSize(Number(e.target.value))}
                      className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <button
                      onClick={clearLeadFilters}
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
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Showing {paginatedLeads.length} of {filteredLeads.length} filtered leads ({leads.length} total)
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Contact</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Doer</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Source</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {paginatedLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center dark:bg-primary-900/30">
                              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">{lead.name.charAt(0)}</span>
                            </div>
                            <span className="ml-2.5 font-medium text-gray-900 dark:text-gray-100 text-sm">{lead.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="text-sm text-gray-900 dark:text-gray-100 leading-tight">{lead.email || '-'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{lead.phone || '-'}</div>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                          {lead.doer?.name || <span className="text-gray-400 italic">Unassigned</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {lead.status ? (
                            <span
                              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                              style={{ backgroundColor: lead.status.color + '20', color: lead.status.color }}
                            >
                              {lead.status.label}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-sm">No status</span>
                          )}
                        </td>
                          <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            lead.source === 'form' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            lead.source === 'bulk' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                            lead.source === 'indiamart' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {lead.source}
                          </span>
                        </td>
                          <td className="px-3 py-2.5">
                          <button
                            onClick={() => setSelectedLead(lead)}
                            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={currentLeadPage}
                pageSize={leadPageSize}
                totalItems={filteredLeads.length}
                onPageChange={setLeadPage}
              />
              {filteredLeads.length === 0 && (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No leads found</h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    {leadSearch || leadStatusFilter ? 'Try adjusting your filters' : 'Import leads or create a form to get started'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Forms Tab */}
        {activeTab === 'forms' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {forms.map((form) => (
              <div key={form.id} className="bg-white rounded-xl shadow-sm border p-5 dark:bg-gray-800 dark:border-gray-700">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center dark:bg-purple-900/30">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                    form.isPublished ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {form.isPublished ? 'Published' : 'Draft'}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{form.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {form._count?.submissions || 0} submissions · {form.fields?.length || 0} fields
                </p>
                {canManage && (
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => {
                        setEditingForm(form);
                        setShowFormBuilder(true);
                      }}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50 text-sm font-medium"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete form "${form.title}"?`)) return;
                        try {
                          await formService.remove(id!, form.id);
                          toast.success('Form deleted');
                          loadData();
                        } catch (error: any) {
                          toast.error(error.response?.data?.message || 'Failed to delete');
                        }
                      }}
                      aria-label="Delete form"
                      className="px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
                {form.isPublished && (
                  <div className="bg-gray-50 rounded-lg p-3 dark:bg-gray-900/50">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Public Link</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/form/${form.publicSlug}`}
                        className="flex-1 text-xs text-primary-600 bg-transparent border-none p-0"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/form/${form.publicSlug}`);
                          toast.success('Link copied!');
                        }}
                        aria-label="Copy link"
                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                      >
                        <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {forms.length === 0 && (
              <div className="col-span-full text-center py-12 bg-white rounded-xl border dark:bg-gray-800 dark:border-gray-700">
                <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No form yet</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1 mb-4">Create a form to collect enquiries. Each campaign can have one form.</p>
            {canManage && (
                  <button
                    onClick={() => setShowFormBuilder(true)}
                    className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Create Form
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden dark:bg-gray-800 dark:border-gray-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {users.map((u) => (
                <div key={u.id} className="flex items-center p-4 bg-gray-50 rounded-xl dark:bg-gray-900/50">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center dark:bg-primary-900/30">
                    <span className="text-sm font-medium text-primary-700 dark:text-primary-300">{u.name.charAt(0)}</span>
                  </div>
                  <div className="ml-3">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{u.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{u.username}</p>
                  </div>
                  <span className={`ml-auto px-2 py-1 text-xs rounded-full ${
                    u.role === 'ADMIN' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  }`}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
            {users.length === 0 && (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No team members</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Assign users to this campaign</p>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && canManage && (
          <div className="space-y-6">
            {/* Status Management */}
            <div className="bg-white rounded-xl shadow-sm border p-6 dark:bg-gray-800 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Lead Statuses</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Customize the status options for leads in this campaign</p>
                </div>
              </div>

              {/* Add New Status */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6 dark:bg-gray-900/50">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Add New Status</h4>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status Label</label>
                    <input
                      type="text"
                      value={newStatusLabel}
                      onChange={(e) => setNewLabelStatus(e.target.value)}
                      placeholder="e.g., Qualified, Proposal Sent"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newStatusColor}
                        onChange={(e) => setNewStatusColor(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
                      />
                      <div className="flex flex-wrap gap-1">
                        {STATUS_COLORS.slice(0, 5).map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setNewStatusColor(color)}
                            className={`w-6 h-6 rounded-full border-2 ${
                              newStatusColor === color ? 'border-gray-600' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!newStatusLabel.trim()) {
                        toast.error('Please enter a status label');
                        return;
                      }
                      setAddingStatus(true);
                      try {
                        await statusService.create(id!, {
                          label: newStatusLabel.trim(),
                          color: newStatusColor,
                          whatsappMessage: newStatusWhatsapp.trim() || undefined,
                        });
                        toast.success('Status added');
                        setNewLabelStatus('');
                        setNewStatusColor(STATUS_COLORS[0]);
                        setNewStatusWhatsapp('');
                        loadData();
                      } catch (error) {
                        toast.error('Failed to add status');
                      } finally {
                        setAddingStatus(false);
                      }
                    }}
                    disabled={addingStatus || !newStatusLabel.trim()}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                  >
                    {addingStatus ? 'Adding...' : 'Add Status'}
                  </button>
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">WhatsApp Message (optional)</label>
                  <textarea
                    value={newStatusWhatsapp}
                    onChange={(e) => setNewStatusWhatsapp(e.target.value)}
                    placeholder="e.g., Hi {{name}}, we tried reaching you. Please call us back."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 h-16"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Auto-send when a lead is moved to this status. Use {'{{name}}'}, {'{{phone}}'}, {'{{email}}'} for field values.</p>
                </div>
              </div>

              {/* Current Statuses */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Current Statuses</h4>
                <div className="space-y-2">
                  {campaign.statuses?.map((status) => {
                    const leadCount = leads.filter((l) => l.statusId === status.id).length;
                    const isEditing = editingStatusId === status.id;
                    return (
                      <div
                        key={status.id}
                        className="p-3 bg-gray-50 rounded-lg dark:bg-gray-900/50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: status.color }}
                            />
                            <span className="font-medium text-gray-900 dark:text-gray-100">{status.label}</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">({leadCount} leads)</span>
                            {status.whatsappMessage && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">WA</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                if (isEditing) {
                                  setEditingStatusId(null);
                                } else {
                                  setEditingStatusId(status.id);
                                  setEditStatusWhatsapp(status.whatsappMessage || '');
                                }
                              }}
                              className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                              title="Edit WhatsApp message"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button
                              onClick={async () => {
                                if (leadCount > 0) {
                                  toast.error(`Cannot delete "${status.label}" - ${leadCount} lead(s) are using it`);
                                  return;
                                }
                                if (!confirm(`Delete status "${status.label}"?`)) return;
                                try {
                                  await statusService.remove(id!, status.id);
                                  toast.success('Status deleted');
                                  loadData();
                                } catch (error: any) {
                                  toast.error(error.response?.data?.message || 'Failed to delete status');
                                }
                              }}
                              aria-label="Delete status"
                              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        {isEditing && (
                          <div className="mt-3 pl-7">
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">WhatsApp Message for "{status.label}"</label>
                            <textarea
                              value={editStatusWhatsapp}
                              onChange={(e) => setEditStatusWhatsapp(e.target.value)}
                              placeholder="e.g., Hi {{name}}, we tried reaching you. Please call us back."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 h-16"
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={async () => {
                                  try {
                                    await statusService.update(id!, status.id, {
                                      whatsappMessage: editStatusWhatsapp.trim() || undefined,
                                    });
                                    toast.success('WhatsApp message saved');
                                    setEditingStatusId(null);
                                    loadData();
                                  } catch (error) {
                                    toast.error('Failed to save');
                                  }
                                }}
                                className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingStatusId(null)}
                                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-1">Use {'{{name}}'}, {'{{phone}}'}, {'{{email}}'} for field values</p>
                          </div>
                        )}
                        {!isEditing && status.whatsappMessage && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-7 truncate">{status.whatsappMessage}</p>
                        )}
                      </div>
                    );
                  })}
                  {(!campaign.statuses || campaign.statuses.length === 0) && (
                    <p className="text-gray-500 dark:text-gray-400 text-sm py-4">No statuses defined</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Import Modal */}
        {editingCampaign && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl dark:bg-gray-800">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Edit Campaign</h2>
                  <button onClick={() => setEditingCampaign(false)} aria-label="Close" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                    <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Campaign Name *</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                      placeholder="Enter campaign name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                      placeholder="Enter campaign description (optional)"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg dark:bg-gray-900/50">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Active Status</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Inactive campaigns hide leads from telecallers</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditIsActive(!editIsActive)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        editIsActive ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-100 shadow ring-0 transition duration-200 ease-in-out ${
                          editIsActive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setEditingCampaign(false)}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCampaign}
                    disabled={savingCampaign || !editName.trim()}
                    className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {savingCampaign ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Import Modal */}
        {showBulkImport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl dark:bg-gray-800">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Import Leads</h2>
                  <button onClick={() => { setShowBulkImport(false); setFile(null); }} aria-label="Close" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                    <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    dragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {file ? (
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Drag & drop a CSV file here, or</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        browse files
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  CSV should have columns: name, email, phone
                </p>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => { setShowBulkImport(false); setFile(null); }}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkImport}
                    disabled={!file || importing}
                    className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {importing ? 'Importing...' : 'Import Leads'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form Builder Modal */}
        {showFormBuilder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
            <div className="bg-white rounded-2xl w-full max-w-7xl h-[95vh] overflow-hidden shadow-xl dark:bg-gray-800">
              <FormBuilder
                initialForm={editingForm || undefined}
                onSubmit={editingForm ? handleUpdateForm : handleCreateForm}
                onCancel={() => { setShowFormBuilder(false); setEditingForm(null); }}
              />
            </div>
          </div>
        )}

        {/* Assign Users Modal */}
        {showAssignUsers && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl dark:bg-gray-800">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Assign Users</h2>
                  <button onClick={() => setShowAssignUsers(false)} aria-label="Close" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                    <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {allUsers.filter((u) => u.isActive).map((u) => {
                    const isAssigned = assignUserIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          isAssigned ? 'bg-primary-50 dark:bg-primary-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={() => toggleAssignUser(u.id)}
                          className="user-checkbox w-4 h-4 text-primary-600 rounded"
                        />
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center dark:bg-gray-700">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{u.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{u.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{u.role}</p>
                        </div>
                      </label>
                    );
                  })}
                  {allUsers.filter((u) => u.isActive).length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">No active users available.</p>
                  )}
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowAssignUsers(false)}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleAssignUsers(assignUserIds)}
                    disabled={assigningUsers}
                    className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {assigningUsers ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lead Detail Dialog */}
        {selectedLead && campaign && (
          <LeadDetailDialog
            leadId={selectedLead.id}
            statuses={campaign.statuses || []}
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
