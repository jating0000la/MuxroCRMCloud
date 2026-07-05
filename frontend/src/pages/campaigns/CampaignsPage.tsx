import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { campaignService } from '../../services/campaigns';
import { formService } from '../../services/forms';
import { userService } from '../../services/users';
import { Campaign, User, FormField } from '../../types';
import Layout from '../../components/layout/Layout';
import toast from 'react-hot-toast';

type WizardStep = 'campaign' | 'form' | 'users';

export default function CampaignsPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

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

  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    let result = [...campaigns];
    if (search) {
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.description?.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (filterStatus === 'active') {
      result = result.filter((c) => c.isActive);
    } else if (filterStatus === 'inactive') {
      result = result.filter((c) => !c.isActive);
    }
    setFilteredCampaigns(result);
  }, [campaigns, search, filterStatus]);

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
      setAllUsers(users);
    } catch {
      setAllUsers([]);
    }
  };

  const closeWizard = () => {
    setShowWizard(false);
    setNewCampaignId(null);
  };

  // Step 1: Create Campaign
  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) {
      toast.error('Campaign name is required');
      return;
    }
    setCreating(true);
    try {
      const campaign = await campaignService.create({ name: campaignName, description: campaignDescription });
      setNewCampaignId(campaign.id);
      toast.success('Campaign created');
      setWizardStep('form');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  // Step 2: Create Form
  const handleCreateForm = async () => {
    if (!formTitle.trim()) {
      toast.error('Form title is required');
      return;
    }
    setCreating(true);
    try {
      const form = await formService.create(newCampaignId!, { title: formTitle, fields: formFields });
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

  // Step 3: Assign Users
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
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to assign users');
    } finally {
      setCreating(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const addFormField = () => {
    setFormFields((prev) => [...prev, { name: '', label: '', type: 'text', required: false }]);
  };

  const updateFormField = (index: number, key: keyof FormField, value: any) => {
    setFormFields((prev) => prev.map((f, i) => (i === index ? { ...f, [key]: value } : f)));
  };

  const removeFormField = (index: number) => {
    setFormFields((prev) => prev.filter((_, i) => i !== index));
  };

  const steps: { key: WizardStep; label: string; num: number }[] = [
    { key: 'campaign', label: 'Campaign', num: 1 },
    { key: 'form', label: 'Form', num: 2 },
    { key: 'users', label: 'Users', num: 3 },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === wizardStep);

  return (
    <Layout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
            <p className="text-gray-500 mt-1">{canManage ? 'Manage your marketing campaigns' : 'View your assigned campaigns'}</p>
          </div>
          {canManage && (
            <button
              onClick={openWizard}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Campaign
            </button>
          )}
        </div>

        {/* Filters & Search */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search campaigns..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-primary-50 text-primary-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  aria-label="Grid view"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-primary-50 text-primary-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  aria-label="List view"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Campaigns */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No campaigns found</h3>
            <p className="text-gray-500 mb-4">
              {search ? 'Try a different search term' : 'Get started by creating your first campaign'}
            </p>
            {canManage && !search && (
              <button
                onClick={openWizard}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Campaign
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCampaigns.map((campaign) => (
              <Link
                key={campaign.id}
                to={`/campaigns/${campaign.id}`}
                className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                    <span className="text-lg font-semibold text-primary-700">
                      {campaign.name.charAt(0)}
                    </span>
                  </div>
                  <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                    campaign.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {campaign.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-primary-600 transition-colors">
                  {campaign.name}
                </h3>
                {campaign.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{campaign.description}</p>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {campaign._count?.leads || 0}
                    </span>
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {campaign._count?.forms || 0}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {campaign.manager?.name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manager</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leads</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Forms</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link to={`/campaigns/${campaign.id}`} className="font-medium text-gray-900 hover:text-primary-600">
                        {campaign.name}
                      </Link>
                      {campaign.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{campaign.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{campaign.manager?.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{campaign._count?.leads || 0}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{campaign._count?.forms || 0}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                        campaign.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {campaign.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 3-Step Wizard Modal */}
        {showWizard && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="p-6 pb-0">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Create Campaign</h2>
                  <button onClick={closeWizard} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Close wizard">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center mb-6">
                  {steps.map((step, i) => (
                    <React.Fragment key={step.key}>
                      <div className="flex items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            currentStepIndex > i
                              ? 'bg-green-500 text-white'
                              : currentStepIndex === i
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {currentStepIndex > i ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            step.num
                          )}
                        </div>
                        <span className={`ml-2 text-sm font-medium hidden sm:inline ${
                          currentStepIndex >= i ? 'text-gray-900' : 'text-gray-400'
                        }`}>
                          {step.label}
                        </span>
                      </div>
                      {i < steps.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-3 ${
                          currentStepIndex > i ? 'bg-green-500' : 'bg-gray-200'
                        }`} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="p-6 pt-0">
                {/* Step 1: Campaign */}
                {wizardStep === 'campaign' && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500">Enter the basic details for your campaign.</p>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
                      <input
                        type="text"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="e.g., Summer Sale 2026"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={campaignDescription}
                        onChange={(e) => setCampaignDescription(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        rows={3}
                        placeholder="Brief description of the campaign"
                      />
                    </div>
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={handleCreateCampaign}
                        disabled={creating || !campaignName.trim()}
                        className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
                      >
                        {creating ? 'Creating...' : 'Next: Create Form →'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Form */}
                {wizardStep === 'form' && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500">Create a form to collect enquiries for this campaign.</p>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Form Title *</label>
                      <input
                        type="text"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="e.g., Contact Form"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">Form Fields</label>
                        <button
                          type="button"
                          onClick={addFormField}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >
                          + Add Field
                        </button>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {formFields.map((field, i) => (
                          <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) => updateFormField(i, 'label', e.target.value)}
                              placeholder="Label"
                              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded"
                            />
                            <select
                              value={field.type}
                              onChange={(e) => updateFormField(i, 'type', e.target.value)}
                              className="px-2 py-1.5 text-sm border border-gray-300 rounded"
                            >
                              <option value="text">Text</option>
                              <option value="email">Email</option>
                              <option value="phone">Phone</option>
                              <option value="number">Number</option>
                              <option value="textarea">Textarea</option>
                              <option value="select">Dropdown</option>
                            </select>
                            <label className="flex items-center text-xs text-gray-500">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => updateFormField(i, 'required', e.target.checked)}
                                className="mr-1 rounded"
                              />
                              Req
                            </label>
                            {formFields.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeFormField(i)}
                                className="p-1 text-red-400 hover:text-red-600"
                                aria-label="Remove field"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between pt-2">
                      <button
                        onClick={handleSkipForm}
                        className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                      >
                        Skip for now
                      </button>
                      <button
                        onClick={handleCreateForm}
                        disabled={creating || !formTitle.trim()}
                        className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
                      >
                        {creating ? 'Creating...' : 'Next: Assign Users →'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Users */}
                {wizardStep === 'users' && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500">Assign users to this campaign so they can manage leads.</p>
                    {allUsers.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">No users available to assign.</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {allUsers.map((u) => (
                          <label
                            key={u.id}
                            className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedUserIds.includes(u.id)
                                ? 'bg-primary-50 border-primary-300'
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(u.id)}
                              onChange={() => toggleUser(u.id)}
                              className="rounded text-primary-600 mr-3"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{u.name}</p>
                              <p className="text-xs text-gray-500">{u.role}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between pt-2">
                      <button
                        onClick={handleAssignUsers}
                        disabled={creating || selectedUserIds.length === 0}
                        className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium ml-auto"
                      >
                        {creating ? 'Saving...' : 'Finish Setup'}
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
