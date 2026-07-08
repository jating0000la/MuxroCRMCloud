import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/layout/Layout';
import integrationService from '../../services/integrations';
import settingsService from '../../services/settings';
import { campaignService } from '../../services/campaigns';
import { readBranding, saveBranding } from '../../utils/branding';
import toast from 'react-hot-toast';

type Tab = 'profile' | 'api-webhook' | 'communication';

interface Campaign {
  id: string;
  name: string;
  isActive: boolean;
}

interface ImportResult {
  fetched: number;
  imported: number;
  duplicates: number;
  errors: number;
  message: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Profile settings
  const initialBranding = readBranding();
  const [companyName, setCompanyName] = useState(initialBranding.appName || 'Muxro CRM');
  const [appLogoUrl, setAppLogoUrl] = useState(initialBranding.appLogoUrl || '');
  const [websiteLink, setWebsiteLink] = useState('https://your-company.com');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');

  // API & Webhook settings
  const [indiamartApiKey, setIndiamartApiKey] = useState('');
  const [indiamartCampaignId, setIndiamartCampaignId] = useState('');
  const [indiamartAutoFetch, setIndiamartAutoFetch] = useState(false);
  const [indiamartLastFetch, setIndiamartLastFetch] = useState<string | null>(null);
  const [processSutraApiKey, setProcessSutraApiKey] = useState('');
  const [processSutraSystemName, setProcessSutraSystemName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  // Communication settings (Gupshup)
  const [gupshupApiKey, setGupshupApiKey] = useState('');
  const [gupshupSource, setGupshupSource] = useState('');
  const [gupshupAppName, setGupshupAppName] = useState('');
  const [gupshupWebhookUrl, setGupshupWebhookUrl] = useState('');
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoReplyMessage, setAutoReplyMessage] = useState('Thank you for reaching out! We will get back to you shortly.');
  const [formGreetingEnabled, setFormGreetingEnabled] = useState(true);
  const [formGreetingMessage, setFormGreetingMessage] = useState('Thank you for your inquiry! Our team will contact you within 24 hours.');
  const [welcomeTemplateId, setWelcomeTemplateId] = useState('');
  const [followupTemplateId, setFollowupTemplateId] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testingIndiamart, setTestingIndiamart] = useState(false);
  const [testingProcessSutra, setTestingProcessSutra] = useState(false);
  const [testingGupshup, setTestingGupshup] = useState(false);
  const [fetchingNow, setFetchingNow] = useState(false);
  const [showIndiamartApiKey, setShowIndiamartApiKey] = useState(false);
  const [showProcessSutraApiKey, setShowProcessSutraApiKey] = useState(false);
  const [showGupshupApiKey, setShowGupshupApiKey] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    loadSettings();
    loadCampaigns();
  }, []);

  const normalizeUrl = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const isValidUrl = (value: string): boolean => {
    if (!value) return true;
    try { new URL(normalizeUrl(value)); return true; } catch { return false; }
  };

  const loadCampaigns = async () => {
    try {
      const data = await campaignService.getAll();
      setCampaigns(data.filter((c: any) => c.isActive).map((c: any) => ({ id: c.id, name: c.name, isActive: c.isActive })));
    } catch (error: any) {
      console.log('Failed to load campaigns:', error.message);
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const allSettings = await settingsService.getAllSettings(true);
      allSettings.forEach((setting) => {
        switch (setting.key) {
          case 'companyName': setCompanyName(setting.value); break;
          case 'appLogoUrl': setAppLogoUrl(setting.value); break;
          case 'websiteLink': setWebsiteLink(setting.value); break;
          case 'companyEmail': setCompanyEmail(setting.value); break;
          case 'companyPhone': setCompanyPhone(setting.value); break;
          case 'companyAddress': setCompanyAddress(setting.value); break;
          case 'indiamartApiKey': setIndiamartApiKey(setting.value); break;
          case 'indiamartCampaignId': setIndiamartCampaignId(setting.value); break;
          case 'indiamartAutoFetch': setIndiamartAutoFetch(setting.value === 'true'); break;
          case 'processSutraApiKey': setProcessSutraApiKey(setting.value); break;
          case 'processSutraSystemName': setProcessSutraSystemName(setting.value); break;
          case 'webhookUrl': setWebhookUrl(setting.value); break;
          case 'gupshupApiKey': setGupshupApiKey(setting.value); break;
          case 'gupshupSource': setGupshupSource(setting.value); break;
          case 'gupshupAppName': setGupshupAppName(setting.value); break;
          case 'gupshupWebhookUrl': setGupshupWebhookUrl(setting.value); break;
          case 'autoReplyEnabled': setAutoReplyEnabled(setting.value === 'true'); break;
          case 'autoReplyMessage': setAutoReplyMessage(setting.value); break;
          case 'formGreetingEnabled': setFormGreetingEnabled(setting.value !== 'false'); break;
          case 'formGreetingMessage': setFormGreetingMessage(setting.value); break;
          case 'welcomeTemplateId': setWelcomeTemplateId(setting.value); break;
          case 'followupTemplateId': setFollowupTemplateId(setting.value); break;
        }
      });
      try {
        const { lastFetchTime } = await integrationService.getLastFetchTime();
        setIndiamartLastFetch(lastFetchTime);
      } catch {}
    } catch (error: any) {
      console.log('Settings not yet configured:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (settings: { key: string; value: string; reason?: string }[]) => {
    for (const setting of settings) {
      if (setting.value || setting.key.includes('Enabled') || setting.key.includes('AutoFetch')) {
        try {
          await settingsService.updateSetting(setting.key, {
            value: setting.value,
            reason: setting.reason || 'Updated via Settings',
          });
        } catch (error: any) {
          if (error.response?.status === 404) {
            await settingsService.createSetting({
              key: setting.key,
              value: setting.value,
              reason: setting.reason || 'Updated via Settings',
            });
          } else {
            throw error;
          }
        }
      }
    }
  };

  const isMasked = (v: string) => v.includes('•');

  const handleSaveProfile = async () => {
    if (!isValidUrl(appLogoUrl) || !isValidUrl(websiteLink)) {
      toast.error('Please enter valid URL values');
      return;
    }
    setSaving(true);
    try {
      await saveSettings([
        { key: 'companyName', value: companyName },
        { key: 'appLogoUrl', value: normalizeUrl(appLogoUrl) },
        { key: 'websiteLink', value: normalizeUrl(websiteLink) },
        { key: 'companyEmail', value: companyEmail },
        { key: 'companyPhone', value: companyPhone },
        { key: 'companyAddress', value: companyAddress },
      ]);
      saveBranding({ appName: companyName || 'Muxro CRM', appLogoUrl: normalizeUrl(appLogoUrl) || '' });
      toast.success('Profile saved successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApiWebhook = async () => {
    setSaving(true);
    try {
      await saveSettings([
        { key: 'indiamartApiKey', value: isMasked(indiamartApiKey) ? '' : indiamartApiKey },
        { key: 'indiamartCampaignId', value: indiamartCampaignId },
        { key: 'indiamartAutoFetch', value: String(indiamartAutoFetch) },
        { key: 'processSutraApiKey', value: isMasked(processSutraApiKey) ? '' : processSutraApiKey },
        { key: 'processSutraSystemName', value: processSutraSystemName },
        { key: 'webhookUrl', value: webhookUrl },
      ]);
      toast.success('API & Webhook settings saved');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCommunication = async () => {
    setSaving(true);
    try {
      await saveSettings([
        { key: 'gupshupApiKey', value: isMasked(gupshupApiKey) ? '' : gupshupApiKey },
        { key: 'gupshupSource', value: gupshupSource },
        { key: 'gupshupAppName', value: gupshupAppName },
        { key: 'gupshupWebhookUrl', value: gupshupWebhookUrl },
        { key: 'autoReplyEnabled', value: String(autoReplyEnabled) },
        { key: 'autoReplyMessage', value: autoReplyMessage },
        { key: 'formGreetingEnabled', value: String(formGreetingEnabled) },
        { key: 'formGreetingMessage', value: formGreetingMessage },
        { key: 'welcomeTemplateId', value: welcomeTemplateId },
        { key: 'followupTemplateId', value: followupTemplateId },
      ]);
      toast.success('Communication settings saved');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (activeTab === 'profile') return handleSaveProfile();
    if (activeTab === 'api-webhook') return handleSaveApiWebhook();
    if (activeTab === 'communication') return handleSaveCommunication();
  };

  const handleTestIndiamart = async () => {
    if (!indiamartApiKey) { toast.error('Enter IndiaMART API key first'); return; }
    setTestingIndiamart(true);
    try {
      const key = indiamartApiKey.includes('•') ? await settingsService.getSettingUnmasked('indiamartApiKey') : indiamartApiKey;
      const result = await integrationService.testIndiamart({ apiKey: key });
      if (result.success) {
        toast.success(result.message);
        await settingsService.updateSetting('indiamartApiKey', { value: key, lastTestedAt: new Date().toISOString(), reason: 'Test OK' }).catch(() => {});
      } else {
        toast.error(result.message || 'Connection failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Test failed');
    } finally {
      setTestingIndiamart(false);
    }
  };

  const handleFetchNow = async () => {
    if (!indiamartApiKey) { toast.error('Enter IndiaMART API key first'); return; }
    if (!indiamartCampaignId) { toast.error('Select a campaign first'); return; }
    setFetchingNow(true); setImportResult(null);
    try {
      const key = indiamartApiKey.includes('•') ? await settingsService.getSettingUnmasked('indiamartApiKey') : indiamartApiKey;
      const result = await integrationService.autoImportLeads({ campaignId: indiamartCampaignId, apiKey: key });
      setImportResult({ fetched: result.fetched, imported: result.imported, duplicates: result.duplicates, errors: result.errors, message: result.message || '' });
      if (result.imported > 0) toast.success(`Imported ${result.imported} new leads`);
      else if (result.fetched === 0) toast('No new leads found');
      else toast(`All ${result.fetched} leads were duplicates`);
      try { const { lastFetchTime } = await integrationService.getLastFetchTime(); setIndiamartLastFetch(lastFetchTime); } catch {}
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Fetch failed');
    } finally {
      setFetchingNow(false);
    }
  };

  const handleTestProcessSutra = async () => {
    if (!processSutraApiKey || !processSutraSystemName) { toast.error('Enter API key and system name'); return; }
    setTestingProcessSutra(true);
    try {
      const key = processSutraApiKey.includes('•') ? await settingsService.getSettingUnmasked('processSutraApiKey') : processSutraApiKey;
      const result = await integrationService.testProcessSutra({ apiKey: key, systemName: processSutraSystemName });
      if (result.success) {
        toast.success(result.message);
        await settingsService.updateSetting('processSutraApiKey', { value: key, lastTestedAt: new Date().toISOString(), reason: 'Test OK' }).catch(() => {});
      } else { toast.error(result.message || 'Connection failed'); }
    } catch (error: any) { toast.error(error.response?.data?.message || 'Test failed'); }
    finally { setTestingProcessSutra(false); }
  };

  const handleTestGupshup = async () => {
    if (!gupshupApiKey || !gupshupSource || !gupshupAppName) { toast.error('Enter Gupshup API key, source, and app name'); return; }
    setTestingGupshup(true);
    try {
      const key = gupshupApiKey.includes('•') ? await settingsService.getSettingUnmasked('gupshupApiKey') : gupshupApiKey;
      const result = await integrationService.testGupshup({ apiKey: key, source: gupshupSource, appName: gupshupAppName, testPhone: gupshupSource });
      if (result.success) {
        toast.success(result.message);
        await settingsService.updateSetting('gupshupApiKey', { value: key, lastTestedAt: new Date().toISOString(), reason: 'Test OK' }).catch(() => {});
      } else { toast.error(result.message || 'Connection failed'); }
    } catch (error: any) { toast.error(error.response?.data?.message || 'Test failed'); }
    finally { setTestingGupshup(false); }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
  const hintCls = 'text-xs text-gray-400 mt-1 dark:text-gray-500';

  const tabs: { key: Tab; label: string; icon: JSX.Element }[] = [
    { key: 'profile', label: 'Profile', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
    { key: 'api-webhook', label: 'API & Webhook', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg> },
    { key: 'communication', label: 'Communication Setup', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg className="animate-spin h-8 w-8 text-primary-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-gray-600 dark:text-gray-300">Loading settings...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="sleek-page p-6 max-w-5xl mx-auto space-y-6">
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border dark:bg-gray-800 dark:border-gray-700">
          <div className="flex border-b dark:border-gray-700">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* ====== PROFILE TAB ====== */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Company Profile</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Manage your company information and branding</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelCls}>Company / Tool Name</label>
                    <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} placeholder="Muxro CRM" />
                  </div>
                  <div>
                    <label className={labelCls}>Logo URL</label>
                    <input type="text" inputMode="url" value={appLogoUrl} onChange={(e) => setAppLogoUrl(e.target.value)} onBlur={() => setAppLogoUrl((v) => normalizeUrl(v))} className={inputCls} placeholder="https://your-domain.com/logo.png" />
                  </div>
                  <div>
                    <label className={labelCls}>Website</label>
                    <input type="text" inputMode="url" value={websiteLink} onChange={(e) => setWebsiteLink(e.target.value)} onBlur={() => setWebsiteLink((v) => normalizeUrl(v))} className={inputCls} placeholder="https://your-company.com" />
                  </div>
                  <div>
                    <label className={labelCls}>Company Email</label>
                    <input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} className={inputCls} placeholder="info@company.com" />
                  </div>
                  <div>
                    <label className={labelCls}>Company Phone</label>
                    <input type="tel" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} className={inputCls} placeholder="+91 98765 43210" />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>Address</label>
                    <input type="text" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} className={inputCls} placeholder="123 Business St, City, State" />
                  </div>
                </div>
                {appLogoUrl && (
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg dark:bg-gray-900/50">
                    <img src={appLogoUrl} alt="Logo preview" className="h-12 w-12 object-contain rounded" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Logo Preview</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{appLogoUrl}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ====== API & WEBHOOK TAB ====== */}
            {activeTab === 'api-webhook' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">API & Webhook Configuration</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Manage API keys and webhook endpoints for integrations</p>
                </div>

                {/* IndiaMART */}
                <div className="p-5 border border-gray-200 rounded-xl dark:border-gray-600 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center dark:bg-orange-900/30">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">IndiaMART</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Auto-fetch leads from IndiaMART</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Pull API Key</label>
                      <div className="relative">
                        <input type={showIndiamartApiKey ? 'text' : 'password'} value={indiamartApiKey} onChange={(e) => setIndiamartApiKey(e.target.value)} className={inputCls + ' pr-16'} placeholder="IndiaMART Pull API key" />
                        <button type="button" onClick={() => setShowIndiamartApiKey((v) => !v)} className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">{showIndiamartApiKey ? 'Hide' : 'Show'}</button>
                      </div>
                      <p className={hintCls}>seller.indiamart.com &gt; Lead Manager &gt; Pull API</p>
                    </div>
                    <div>
                      <label className={labelCls}>Target Campaign</label>
                      <select value={indiamartCampaignId} onChange={(e) => setIndiamartCampaignId(e.target.value)} className={inputCls}>
                        <option value="">Select a campaign</option>
                        {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg dark:bg-gray-900/50">
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-Fetch Leads</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Fetch new leads every 10 minutes</p>
                    </div>
                    <button type="button" onClick={() => setIndiamartAutoFetch(!indiamartAutoFetch)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${indiamartAutoFetch ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${indiamartAutoFetch ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  {indiamartLastFetch && <p className={hintCls}>Last fetched: {new Date(indiamartLastFetch).toLocaleString()}</p>}
                  <div className="flex gap-3">
                    <button onClick={handleTestIndiamart} disabled={testingIndiamart || !indiamartApiKey} className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium">
                      {testingIndiamart ? <><svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Testing...</> : 'Test Connection'}
                    </button>
                    <button onClick={handleFetchNow} disabled={fetchingNow || !indiamartApiKey || !indiamartCampaignId} className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
                      {fetchingNow ? <><svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Fetching...</> : 'Fetch Now'}
                    </button>
                  </div>
                  {importResult && (
                    <div className={`p-3 rounded-lg border text-xs space-y-1 ${importResult.imported > 0 ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700'}`}>
                      <p className="font-medium text-gray-900 dark:text-gray-100">Fetch Result</p>
                      <p>Fetched: {importResult.fetched} | <span className="text-green-600 dark:text-green-400">Imported: {importResult.imported}</span> | Duplicates: {importResult.duplicates}{importResult.errors > 0 && <span className="text-red-600 dark:text-red-400"> | Errors: {importResult.errors}</span>}</p>
                    </div>
                  )}
                </div>

                {/* Process Sutra */}
                <div className="p-5 border border-gray-200 rounded-xl dark:border-gray-600 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center dark:bg-purple-900/30">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">Process Sutra</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Workflow automation</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>API Key</label>
                      <div className="relative">
                        <input type={showProcessSutraApiKey ? 'text' : 'password'} value={processSutraApiKey} onChange={(e) => setProcessSutraApiKey(e.target.value)} className={inputCls + ' pr-16'} placeholder="Process Sutra API key" />
                        <button type="button" onClick={() => setShowProcessSutraApiKey((v) => !v)} className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">{showProcessSutraApiKey ? 'Hide' : 'Show'}</button>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>System Name</label>
                      <input type="text" value={processSutraSystemName} onChange={(e) => setProcessSutraSystemName(e.target.value)} className={inputCls} placeholder="muxro-crm" />
                    </div>
                  </div>
                  <button onClick={handleTestProcessSutra} disabled={testingProcessSutra || !processSutraApiKey || !processSutraSystemName} className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium">
                    {testingProcessSutra ? <><svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Testing...</> : 'Test Connection'}
                  </button>
                </div>

                {/* Webhook URL */}
                <div className="p-5 border border-gray-200 rounded-xl dark:border-gray-600 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center dark:bg-blue-900/30">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">Webhook URL</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Endpoint for receiving inbound events</p>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Callback Webhook URL</label>
                    <input type="text" inputMode="url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className={inputCls} placeholder="https://your-domain.com/api/webhooks" />
                    <p className={hintCls}>Configure this URL in your Gupshup / IndiaMART dashboards</p>
                  </div>
                </div>
              </div>
            )}

            {/* ====== COMMUNICATION SETUP TAB ====== */}
            {activeTab === 'communication' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Communication Setup</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Configure WhatsApp messaging, auto-replies, and form greetings</p>
                </div>

                {/* Gupshup WhatsApp Setup */}
                <div className="p-5 border border-gray-200 rounded-xl dark:border-gray-600 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center dark:bg-green-900/30">
                      <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">Gupshup WhatsApp Setup</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Configure your WhatsApp Business API connection</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>API Key</label>
                      <div className="relative">
                        <input type={showGupshupApiKey ? 'text' : 'password'} value={gupshupApiKey} onChange={(e) => setGupshupApiKey(e.target.value)} className={inputCls + ' pr-16'} placeholder="Gupshup API key" />
                        <button type="button" onClick={() => setShowGupshupApiKey((v) => !v)} className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">{showGupshupApiKey ? 'Hide' : 'Show'}</button>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Source Phone (E.164)</label>
                      <input type="text" value={gupshupSource} onChange={(e) => setGupshupSource(e.target.value)} className={inputCls} placeholder="917834811114" />
                    </div>
                    <div>
                      <label className={labelCls}>App Name</label>
                      <input type="text" value={gupshupAppName} onChange={(e) => setGupshupAppName(e.target.value)} className={inputCls} placeholder="MyBusinessApp" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Gupshup Webhook URL (for inbound messages)</label>
                    <div className="flex gap-2">
                      <input type="text" readOnly value={`${window.location.origin}/api/integrations/gupshup/webhook`} className={inputCls + ' bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-sm'} />
                      <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/integrations/gupshup/webhook`); toast.success('Copied!'); }} className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 whitespace-nowrap">Copy</button>
                    </div>
                    <p className={hintCls}>Paste this in Gupshup Console &gt; Settings &gt; Webhooks</p>
                  </div>
                  <button onClick={handleTestGupshup} disabled={testingGupshup || !gupshupApiKey || !gupshupSource || !gupshupAppName} className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium">
                    {testingGupshup ? <><svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Testing...</> : 'Test Connection'}
                  </button>
                </div>

                {/* Message Templates */}
                <div className="p-5 border border-gray-200 rounded-xl dark:border-gray-600 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center dark:bg-indigo-900/30">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">Message Templates</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Gupshup approved template IDs for automated messages</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Welcome Template ID</label>
                      <input type="text" value={welcomeTemplateId} onChange={(e) => setWelcomeTemplateId(e.target.value)} className={inputCls} placeholder="c6aecef6-bcb0-4fb1-8100-28c094e3bc6b" />
                      <p className={hintCls}>Sent when a new lead is created</p>
                    </div>
                    <div>
                      <label className={labelCls}>Follow-up Template ID</label>
                      <input type="text" value={followupTemplateId} onChange={(e) => setFollowupTemplateId(e.target.value)} className={inputCls} placeholder="c6aecef6-bcb0-4fb1-8100-28c094e3bc6b" />
                      <p className={hintCls}>Sent during follow-up reminders</p>
                    </div>
                  </div>
                </div>

                {/* Auto-Reply */}
                <div className="p-5 border border-gray-200 rounded-xl dark:border-gray-600 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center dark:bg-amber-900/30">
                        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Auto-Reply</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Automatically reply to incoming WhatsApp messages</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setAutoReplyEnabled(!autoReplyEnabled)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoReplyEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoReplyEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  {autoReplyEnabled && (
                    <div>
                      <label className={labelCls}>Auto-Reply Message</label>
                      <textarea value={autoReplyMessage} onChange={(e) => setAutoReplyMessage(e.target.value)} rows={3} className={inputCls + ' resize-none'} placeholder="Thank you for reaching out..." />
                    </div>
                  )}
                </div>

                {/* Form Submission Greeting */}
                <div className="p-5 border border-gray-200 rounded-xl dark:border-gray-600 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-cyan-50 rounded-lg flex items-center justify-center dark:bg-cyan-900/30">
                        <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Form Submission Greeting</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">WhatsApp message sent after a lead submits a form</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setFormGreetingEnabled(!formGreetingEnabled)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formGreetingEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formGreetingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  {formGreetingEnabled && (
                    <div>
                      <label className={labelCls}>Greeting Message</label>
                      <textarea value={formGreetingMessage} onChange={(e) => setFormGreetingMessage(e.target.value)} rows={3} className={inputCls + ' resize-none'} placeholder="Thank you for your inquiry..." />
                      <p className={hintCls}>This message is sent via WhatsApp when a public form is submitted</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end p-6 border-t dark:border-gray-700">
            <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
