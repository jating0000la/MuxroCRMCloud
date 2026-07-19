import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { campaignService } from '../../services/campaigns';
import { formService } from '../../services/forms';
import { userService } from '../../services/users';
import { Campaign, User, FormField } from '../../types';
import Layout from '../../components/layout/Layout';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

type WizardStep = 'campaign' | 'form' | 'users';
type SortField = 'name' | 'manager' | 'leads' | 'forms' | 'status' | 'created';
type SortDir = 'asc' | 'desc';

const DEFAULT_PAGE_SIZE = 24;

const toFieldName = (value: string, fallback: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function CampaignsPage() {
  const { user } = useAuth();
  const { syncWithDelay } = useNotifications();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Wizard state
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('campaign');
  const [creating, setCreating] = useState(false);
  const [newCampaignId, setNewCampaignId] = useState<string | null>(null);

  // Step 1: Campaign
  const [campaignName, setCampaignName] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');

  // Step 2: Form
  const [formTitle, setFormTitle] = useState('');
  const [formFields, setFormFields] = useState<FormField[]>([
    { name: 'name', label: 'Full Name', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'phone', label: 'Phone', type: 'phone', required: true },
  ]);

  // Step 3: Users
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const canManage = user?.role === 'ADMIN';

  useEffect(() => {
    let cancelled = false;

    const loadAll = async () => {
      try {
        const data = await campaignService.getAll();
        if (!cancelled) setCampaigns(data);
      } catch (error: any) {
        if (!cancelled) toast.error(error.response?.data?.message || 'Failed to load campaigns');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAll();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let result = [...campaigns];
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q)
      );
    }
    if (filterStatus === 'active') {
      result = result.filter((c) => c.isActive);
    } else if (filterStatus === 'inactive') {
      result = result.filter((c) => !c.isActive);
    }
    setFilteredCampaigns(result);
    setPage(1);
  }, [campaigns, debouncedSearch, filterStatus]);

  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'manager':
        comparison = (a.manager?.name || '').localeCompare(b.manager?.name || '');
        break;
      case 'leads':
        comparison = (a._count?.leads || 0) - (b._count?.leads || 0);
        break;
      case 'forms':
        comparison = (a._count?.forms || 0) - (b._count?.forms || 0);
        break;
      case 'status':
        comparison = Number(a.isActive) - Number(b.isActive);
        break;
      case 'created':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }
    return sortDir === 'asc' ? comparison : -comparison;
  });

  const totalPages = Math.max(1, Math.ceil(sortedCampaigns.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedCampaigns = sortedCampaigns.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const loadCampaigns = async () => {
    try {
      const data = await campaignService.getAll();
      setCampaigns(data);
      setFilteredCampaigns(data);
    } catch (error: any) {
      if (error.response?.status === 403) {
        toast.error('You do not have access to campaigns');
      } else {
        toast.error('Failed to load campaigns');
      }
    } finally {
      setLoading(false);
    }
  };

  const openWizard = async () => {
    setShowWizard(true);
    setWizardStep('campaign');
    setNewCampaignId(null);
    setCampaignName('');
    setCampaignDescription('');
    setFormTitle('');
    setFormFields([
      { name: 'name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'phone', required: true },
    ]);
    setSelectedUserIds([]);
    try {
      const users = await userService.getAll();
      const filteredUsers = users.filter((u: User) => u.role === 'USER');
      setAllUsers(filteredUsers);
    } catch {
      setAllUsers([]);
    }
  };

  const closeWizard = (skipConfirm = false) => {
    const hasData = campaignName.trim() || formTitle.trim() || selectedUserIds.length > 0;
    if (hasData && newCampaignId && !skipConfirm) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        return;
      }
    }
    setShowWizard(false);
    setNewCampaignId(null);
  };

  const handleCloseWizard = () => closeWizard();

  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) {
      toast.error('Campaign name is required');
      return;
    }
    setCreating(true);
    try {
      const campaign = await campaignService.create({ name: campaignName, description: campaignDescription });
      setNewCampaignId(campaign.id);
      setFormTitle(`${campaignName.trim()} - Enquiry Form`);
      toast.success('Campaign created');
      setWizardStep('form');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateForm = async () => {
    if (!formTitle.trim()) {
      toast.error('Form title is required');
      return;
    }

    const normalizedFields = normalizeFormFields();
    if (!normalizedFields) return;

    setCreating(true);
    try {
      const form = await formService.create(newCampaignId!, { title: formTitle.trim(), fields: normalizedFields });
      await formService.publish(newCampaignId!, form.id);
      toast.success('Form created and published');
      setWizardStep('users');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create form');
    } finally {
      setCreating(false);
    }
  };

  const handleSkipForm = () => {
    setWizardStep('users');
  };

  const handleSkipAll = () => {
    toast.success('Campaign created. You can add form and users later.');
    closeWizard(true);
    loadCampaigns();
  };

  const handleAssignUsers = async () => {
    if (selectedUserIds.length === 0) {
      toast.error('Please select at least one user');
      return;
    }
    setCreating(true);
    try {
      await campaignService.assignUsers(newCampaignId!, selectedUserIds);
      toast.success('Users assigned successfully');
      closeWizard();
      loadCampaigns();
      syncWithDelay(500);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to assign users');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (campaignId: string, currentStatus: boolean) => {
    try {
      await campaignService.update(campaignId, { isActive: !currentStatus } as any);
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaignId ? { ...c, isActive: !currentStatus } : c))
      );
      toast.success(`Campaign ${currentStatus ? 'deactivated' : 'activated'}`);
    } catch (error: any) {
      toast.error('Failed to update campaign status');
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const addFormField = () => {
    setFormFields((prev) => [...prev, { name: `field_${prev.length + 1}`, label: '', type: 'text', required: false }]);
  };

  const updateFormField = (index: number, key: keyof FormField, value: any) => {
    setFormFields((prev) => prev.map((f, i) => (i === index ? { ...f, [key]: value } : f)));
  };

  const removeFormField = (index: number) => {
    setFormFields((prev) => prev.filter((_, i) => i !== index));
  };

  const normalizeFormFields = () => {
    const names = new Set<string>();
    const normalized: FormField[] = [];

    for (let index = 0; index < formFields.length; index += 1) {
      const field = formFields[index];
      const label = field.label.trim();
      const name = toFieldName(field.name || label, `field_${index + 1}`);
      const options = field.type === 'select'
        ? (field.options || []).map((option) => option.trim()).filter(Boolean)
        : undefined;

      if (!label) {
        toast.error(`Field ${index + 1} needs a label`);
        return null;
      }

      if (names.has(name)) {
        toast.error(`Field name "${name}" is duplicated`);
        return null;
      }

      if (field.type === 'select' && (!options || options.length === 0)) {
        toast.error(`Add options for "${label}"`);
        return null;
      }

      names.add(name);
      normalized.push({ ...field, label, name, options });
    }

    return normalized;
  };

  const steps: { key: WizardStep; label: string; num: number }[] = [
    { key: 'campaign', label: 'Campaign', num: 1 },
    { key: 'form', label: 'Form', num: 2 },
    { key: 'users', label: 'Users', num: 3 },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === wizardStep);

  const clearFilters = () => {
    setSearch('');
    setFilterStatus('all');
    setSortField('name');
    setSortDir('asc');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDir('asc');
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <svg className={`w-3.5 h-3.5 inline-block ml-1 ${sortField === field ? 'text-primary-600' : 'text-gray-400 dark:text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {sortField === field && sortDir === 'desc' ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      )}
    </svg>
  );

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <Layout>
      <div className="p-3 lg:p-4">

        {/* ── Stats Bar ──────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-gray-900 dark:text-gray-100">{campaigns.length} Total</span>
          <span className="text-green-600 dark:text-green-400">{campaigns.filter((c) => c.isActive).length} Active</span>
          <span className="text-gray-400">{campaigns.filter((c) => !c.isActive).length} Inactive</span>
          <span className="text-gray-400">•</span>
          <span>Showing {paginatedCampaigns.length} of {filteredCampaigns.length}</span>
        </div>

        {/* ── Filter Bar ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-3 dark:bg-gray-800 dark:border-gray-700">
          <div className="p-3">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
              <div className="lg:col-span-4 relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search campaign..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="lg:col-span-2 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <select
                value={`${sortField}-${sortDir}`}
                onChange={(e) => {
                  const [field, dir] = e.target.value.split('-');
                  setSortField(field as SortField);
                  setSortDir(dir as SortDir);
                }}
                className="lg:col-span-2 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
              >
                <option value="name-asc">Name A→Z</option>
                <option value="name-desc">Name Z→A</option>
                <option value="leads-desc">Most Leads</option>
                <option value="leads-asc">Least Leads</option>
                <option value="created-desc">Newest First</option>
                <option value="created-asc">Oldest First</option>
                <option value="status-desc">Active First</option>
              </select>

              <div className="lg:col-span-2 flex border border-gray-300 rounded-lg overflow-hidden dark:border-gray-600">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`flex-1 px-2 py-1.5 ${viewMode === 'grid' ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-400'}`}
                  aria-label="Grid view"
                >
                  <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex-1 px-2 py-1.5 ${viewMode === 'list' ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-400'}`}
                  aria-label="List view"
                >
                  <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>

              <div className="lg:col-span-2 flex items-center justify-end gap-2">
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
                >
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                </select>
                {(search || filterStatus !== 'all') && (
                  <button onClick={clearFilters} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                    Clear
                  </button>
                )}
                {canManage && (
                  <button
                    onClick={openWizard}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-xs font-semibold"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    New
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Campaigns ──────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border dark:bg-gray-800 dark:border-gray-700">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">No campaigns found</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              {search ? `No results for "${search}". Try a different search.` : 'Create your first campaign to get started.'}
            </p>
            {canManage && !search && (
              <button
                onClick={openWizard}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                Create Campaign
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {paginatedCampaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  to={`/campaigns/${campaign.id}`}
                  className="bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-all group dark:bg-gray-800 dark:border-gray-700 flex flex-col"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center group-hover:bg-primary-100 transition-colors dark:bg-primary-900/30">
                      <span className="text-lg font-bold text-primary-700 dark:text-primary-300">
                        {campaign.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleToggleStatus(campaign.id, campaign.isActive);
                      }}
                      className={`px-2 py-0.5 text-[10px] rounded-full font-semibold border transition-colors ${
                        campaign.isActive
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600'
                      }`}
                    >
                      {campaign.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </div>

                  <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1 group-hover:text-primary-600 transition-colors">
                    {campaign.name}
                  </h3>
                  {campaign.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2 flex-1">{campaign.description}</p>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700 mt-auto">
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {campaign._count?.leads || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        {campaign._count?.forms || 0}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {campaign.manager ? (
                        <>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${getAvatarColor(campaign.manager.name)}`}>
                            {getInitials(campaign.manager.name)}
                          </div>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{campaign.manager.name.split(' ')[0]}</span>
                        </>
                      ) : (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">Unassigned</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-3">
              <Pagination page={currentPage} pageSize={pageSize} totalItems={filteredCampaigns.length} onPageChange={setPage} />
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden dark:bg-gray-800 dark:border-gray-700">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th onClick={() => handleSort('name')} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50">Campaign <SortIcon field="name" /></th>
                    <th onClick={() => handleSort('manager')} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50">Manager <SortIcon field="manager" /></th>
                    <th onClick={() => handleSort('leads')} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50">Leads <SortIcon field="leads" /></th>
                    <th onClick={() => handleSort('forms')} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50">Forms <SortIcon field="forms" /></th>
                    <th onClick={() => handleSort('status')} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50">Status <SortIcon field="status" /></th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedCampaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-3 py-2.5">
                        <Link to={`/campaigns/${campaign.id}`} className="font-medium text-gray-900 hover:text-primary-600 dark:text-gray-100">
                          {campaign.name}
                        </Link>
                        {campaign.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{campaign.description}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {campaign.manager ? (
                          <div className="flex items-center gap-1.5">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${getAvatarColor(campaign.manager.name)}`}>
                              {getInitials(campaign.manager.name)}
                            </div>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{campaign.manager.name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300">{campaign._count?.leads || 0}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300">{campaign._count?.forms || 0}</td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => handleToggleStatus(campaign.id, campaign.isActive)}
                          className={`px-2 py-0.5 text-xs rounded-full font-semibold border transition-colors ${
                            campaign.isActive
                              ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                              : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600'
                          }`}
                        >
                          {campaign.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <Link
                            to={`/campaigns/${campaign.id}`}
                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors dark:hover:bg-primary-900/20"
                            title="View"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={currentPage} pageSize={pageSize} totalItems={filteredCampaigns.length} onPageChange={setPage} />
          </div>
        )}

        {/* ── 3-Step Wizard Modal ──────────────────────────────── */}
        {showWizard && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleCloseWizard}>
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="p-5 pb-0">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Create Campaign</h2>
                  <button onClick={handleCloseWizard} className="p-1.5 hover:bg-gray-100 rounded-lg dark:hover:bg-gray-700" aria-label="Close wizard">
                    <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center mb-5">
                  {steps.map((step, i) => (
                    <React.Fragment key={step.key}>
                      <div className="flex items-center">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                            currentStepIndex > i
                              ? 'bg-green-500 text-white'
                              : currentStepIndex === i
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                          }`}
                        >
                          {currentStepIndex > i ? (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            step.num
                          )}
                        </div>
                        <span className={`ml-1.5 text-xs font-medium hidden sm:inline ${
                          currentStepIndex >= i ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {step.label}
                        </span>
                      </div>
                      {i < steps.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-2 ${
                          currentStepIndex > i ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                        }`} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="p-5 pt-0">
                {/* Step 1: Campaign */}
                {wizardStep === 'campaign' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Campaign Name *</label>
                      <input
                        type="text"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-700"
                        placeholder="e.g., Summer Sale 2026"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                      <textarea
                        value={campaignDescription}
                        onChange={(e) => setCampaignDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-700"
                        rows={2}
                        placeholder="Brief description (optional)"
                      />
                    </div>
                    <div className="flex justify-between pt-1">
                      <button
                        onClick={handleSkipAll}
                        className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700/50"
                      >
                        Skip All
                      </button>
                      <button
                        onClick={handleCreateCampaign}
                        disabled={creating || !campaignName.trim()}
                        className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium text-sm"
                      >
                        {creating ? 'Creating...' : 'Next →'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Form */}
                {wizardStep === 'form' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Form Title *</label>
                      <input
                        type="text"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-700"
                        placeholder="e.g., Contact Form"
                        autoFocus
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Form Fields</label>
                        <button type="button" onClick={addFormField} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Add Field</button>
                      </div>
                      <div className="space-y-1.5 max-h-44 overflow-y-auto">
                        {formFields.map((field, i) => (
                          <div key={i} className="bg-gray-50 rounded-lg p-2 dark:bg-gray-900/50">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => updateFormField(i, 'label', e.target.value)}
                                placeholder="Label"
                                className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                              />
                              <select
                                value={field.type}
                                onChange={(e) => updateFormField(i, 'type', e.target.value)}
                                className="px-2 py-1.5 text-sm border border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                              >
                                <option value="text">Text</option>
                                <option value="email">Email</option>
                                <option value="phone">Phone</option>
                                <option value="number">Number</option>
                                <option value="textarea">Textarea</option>
                                <option value="select">Dropdown</option>
                              </select>
                              <label className="flex items-center text-[10px] text-gray-500 dark:text-gray-400 gap-0.5">
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={(e) => updateFormField(i, 'required', e.target.checked)}
                                  className="rounded"
                                />
                                Req
                              </label>
                              {formFields.length > 1 && (
                                <button type="button" onClick={() => removeFormField(i)} className="p-1 text-red-400 hover:text-red-600" aria-label="Remove field">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              )}
                            </div>
                            {field.type === 'select' && (
                              <input
                                type="text"
                                value={(field.options || []).join(', ')}
                                onChange={(e) => updateFormField(i, 'options', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                                placeholder="Options separated by commas"
                                className="w-full mt-1.5 px-2 py-1.5 text-sm border border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between pt-1">
                      <div className="flex gap-2">
                        <button onClick={() => setWizardStep('campaign')} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700/50">
                          ← Back
                        </button>
                        <button onClick={handleSkipForm} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700/50">
                          Skip
                        </button>
                      </div>
                      <button
                        onClick={handleCreateForm}
                        disabled={creating || !formTitle.trim()}
                        className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium text-sm"
                      >
                        {creating ? 'Creating...' : 'Next →'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Users */}
                {wizardStep === 'users' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Assign users to manage leads in this campaign.</p>
                    {allUsers.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No users available to assign.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto">
                        {allUsers.map((u) => (
                          <label
                            key={u.id}
                            className={`flex items-center p-2.5 rounded-lg border cursor-pointer transition-colors ${
                              selectedUserIds.includes(u.id)
                                ? 'bg-primary-50 border-primary-300 dark:bg-primary-900/30 dark:border-primary-700'
                                : 'bg-white border-gray-200 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(u.id)}
                              onChange={() => toggleUser(u.id)}
                              className="rounded text-primary-600 mr-2.5"
                            />
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white mr-2.5 ${getAvatarColor(u.name)}`}>
                              {getInitials(u.name)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{u.name}</p>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400">@{u.username}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between pt-1">
                      <button onClick={() => setWizardStep('form')} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700/50">
                        ← Back
                      </button>
                      <button
                        onClick={handleAssignUsers}
                        disabled={creating || selectedUserIds.length === 0}
                        className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium text-sm"
                      >
                        {creating ? 'Saving...' : 'Finish'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
