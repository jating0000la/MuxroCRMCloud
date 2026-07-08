import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/layout/Layout';
import integrationService from '../../services/integrations';
import settingsService from '../../services/settings';
import { campaignService } from '../../services/campaigns';
import { readBranding, saveBranding } from '../../utils/branding';
import toast from 'react-hot-toast';

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

  // Indiamart settings
  const [indiamartApiKey, setIndiamartApiKey] = useState('');
  const [indiamartCampaignId, setIndiamartCampaignId] = useState('');
  const [indiamartAutoFetch, setIndiamartAutoFetch] = useState(false);
  const [indiamartLastFetch, setIndiamartLastFetch] = useState<string | null>(null);

  // Company settings
  const initialBranding = readBranding();
  const [companyName, setCompanyName] = useState(initialBranding.appName || 'Muxro CRM');
  const [appLogoUrl, setAppLogoUrl] = useState(initialBranding.appLogoUrl || '');
  const [websiteLink, setWebsiteLink] = useState('https://your-company.com');

  // Process Sutra settings
  const [processSutraApiKey, setProcessSutraApiKey] = useState('');
  const [processSutraSystemName, setProcessSutraSystemName] = useState('');

  // Gupshup WhatsApp settings
  const [gupshupApiKey, setGupshupApiKey] = useState('');
  const [gupshupSource, setGupshupSource] = useState('');
  const [gupshupAppName, setGupshupAppName] = useState('');
  const [testingGupshup, setTestingGupshup] = useState(false);
  const [showGupshupApiKey, setShowGupshupApiKey] = useState(false);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testingIndiamart, setTestingIndiamart] = useState(false);
  const [testingProcessSutra, setTestingProcessSutra] = useState(false);
  const [fetchingNow, setFetchingNow] = useState(false);
  const [showIndiamartApiKey, setShowIndiamartApiKey] = useState(false);
  const [showProcessSutraApiKey, setShowProcessSutraApiKey] = useState(false);
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
    try {
      const candidate = normalizeUrl(value);
      new URL(candidate);
      return true;
    } catch {
      return false;
    }
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
          case 'indiamartApiKey':
            setIndiamartApiKey(setting.value);
            break;
          case 'indiamartCampaignId':
            setIndiamartCampaignId(setting.value);
            break;
          case 'indiamartAutoFetch':
            setIndiamartAutoFetch(setting.value === 'true');
            break;
          case 'indiamartWebappUrl':
            break;
          case 'companyName':
            setCompanyName(setting.value);
            break;
          case 'websiteLink':
            setWebsiteLink(setting.value);
            break;
          case 'appLogoUrl':
            setAppLogoUrl(setting.value);
            break;
          case 'processSutraApiKey':
            setProcessSutraApiKey(setting.value);
            break;
          case 'processSutraSystemName':
            setProcessSutraSystemName(setting.value);
            break;
          case 'gupshupApiKey':
            setGupshupApiKey(setting.value);
            break;
          case 'gupshupSource':
            setGupshupSource(setting.value);
            break;
          case 'gupshupAppName':
            setGupshupAppName(setting.value);
            break;
        }
      });

      // Load last fetch time
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

  const handleSave = async () => {
    const normalizedWebappUrl = normalizeUrl('');
    const normalizedAppLogoUrl = normalizeUrl(appLogoUrl);
    const normalizedWebsiteLink = normalizeUrl(websiteLink);
    const isMaskedPlaceholder = (value: string) => value.includes('•');

    if (!isValidUrl(appLogoUrl) || !isValidUrl(websiteLink)) {
      toast.error('Please enter valid URL values');
      return;
    }

    setSaving(true);
    const settingsToUpdate = [
      {
        key: 'indiamartApiKey',
        value: isMaskedPlaceholder(indiamartApiKey) ? '' : indiamartApiKey,
        reason: 'Updated via Settings page',
      },
      { key: 'indiamartCampaignId', value: indiamartCampaignId, reason: 'Updated via Settings page' },
      { key: 'indiamartAutoFetch', value: String(indiamartAutoFetch), reason: 'Updated via Settings page' },
      { key: 'companyName', value: companyName, reason: 'Updated via Settings page' },
      { key: 'appLogoUrl', value: normalizedAppLogoUrl, reason: 'Updated via Settings page' },
      { key: 'websiteLink', value: normalizedWebsiteLink, reason: 'Updated via Settings page' },
      {
        key: 'processSutraApiKey',
        value: isMaskedPlaceholder(processSutraApiKey) ? '' : processSutraApiKey,
        reason: 'Updated via Settings page',
      },
      { key: 'processSutraSystemName', value: processSutraSystemName, reason: 'Updated via Settings page' },
      {
        key: 'gupshupApiKey',
        value: isMaskedPlaceholder(gupshupApiKey) ? '' : gupshupApiKey,
        reason: 'Updated via Settings page',
      },
      { key: 'gupshupSource', value: gupshupSource, reason: 'Updated via Settings page' },
      { key: 'gupshupAppName', value: gupshupAppName, reason: 'Updated via Settings page' },
    ];

    try {
      for (const setting of settingsToUpdate) {
        if (setting.value || setting.key === 'indiamartAutoFetch') {
          try {
            await settingsService.updateSetting(setting.key, {
              value: setting.value,
              reason: setting.reason,
            });
          } catch (error: any) {
            if (error.response?.status === 404) {
              await settingsService.createSetting({
                key: setting.key,
                value: setting.value,
                reason: setting.reason,
              });
            } else {
              throw error;
            }
          }
        }
      }

      toast.success('Settings saved successfully');
      saveBranding({ appName: companyName || 'Muxro CRM', appLogoUrl: normalizedAppLogoUrl || '' });
      await loadSettings();
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      toast.error(error.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestIndiamart = async () => {
    if (!indiamartApiKey) {
      toast.error('Enter IndiaMART API key first');
      return;
    }

    setTestingIndiamart(true);
    try {
      const unmaskedKey = indiamartApiKey.includes('•')
        ? await settingsService.getSettingUnmasked('indiamartApiKey')
        : indiamartApiKey;

      const result = await integrationService.testIndiamart({
        apiKey: unmaskedKey,
      });

      if (result.success) {
        toast.success(result.message);
        try {
          await settingsService.updateSetting('indiamartApiKey', {
            value: unmaskedKey,
            lastTestedAt: new Date().toISOString(),
            reason: 'Connection test successful',
          });
        } catch (e) {}
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
    if (!indiamartApiKey) {
      toast.error('Enter IndiaMART API key first');
      return;
    }
    if (!indiamartCampaignId) {
      toast.error('Select a campaign for IndiaMART leads first');
      return;
    }

    setFetchingNow(true);
    setImportResult(null);
    try {
      const unmaskedKey = indiamartApiKey.includes('•')
        ? await settingsService.getSettingUnmasked('indiamartApiKey')
        : indiamartApiKey;

      const result = await integrationService.autoImportLeads({
        campaignId: indiamartCampaignId,
        apiKey: unmaskedKey,
      });

      setImportResult({
        fetched: result.fetched,
        imported: result.imported,
        duplicates: result.duplicates,
        errors: result.errors,
        message: result.message || '',
      });

      if (result.imported > 0) {
        toast.success(`Imported ${result.imported} new leads from IndiaMART`);
      } else if (result.fetched === 0) {
        toast('No new leads found from IndiaMART');
      } else {
        toast(`All ${result.fetched} leads were duplicates`);
      }

      // Refresh last fetch time
      try {
        const { lastFetchTime } = await integrationService.getLastFetchTime();
        setIndiamartLastFetch(lastFetchTime);
      } catch {}
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Fetch failed');
    } finally {
      setFetchingNow(false);
    }
  };

  const handleTestProcessSutra = async () => {
    if (!processSutraApiKey || !processSutraSystemName) {
      toast.error('Enter Process Sutra API key and system name first');
      return;
    }

    setTestingProcessSutra(true);
    try {
      const unmaskedKey = processSutraApiKey.includes('•')
        ? await settingsService.getSettingUnmasked('processSutraApiKey')
        : processSutraApiKey;

      const result = await integrationService.testProcessSutra({
        apiKey: unmaskedKey,
        systemName: processSutraSystemName,
      });

      if (result.success) {
        toast.success(result.message);
        try {
          await settingsService.updateSetting('processSutraApiKey', {
            value: unmaskedKey,
            lastTestedAt: new Date().toISOString(),
            reason: 'Connection test successful',
          });
        } catch (e) {}
      } else {
        toast.error(result.message || 'Connection failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Test failed');
    } finally {
      setTestingProcessSutra(false);
    }
  };

  const handleTestGupshup = async () => {
    if (!gupshupApiKey || !gupshupSource || !gupshupAppName) {
      toast.error('Enter Gupshup API key, source number, and app name first');
      return;
    }

    setTestingGupshup(true);
    try {
      const unmaskedKey = gupshupApiKey.includes('•')
        ? await settingsService.getSettingUnmasked('gupshupApiKey')
        : gupshupApiKey;

      const result = await integrationService.testGupshup({
        apiKey: unmaskedKey,
        source: gupshupSource,
        appName: gupshupAppName,
        testPhone: gupshupSource, // Test with own number
      });

      if (result.success) {
        toast.success(result.message);
        try {
          await settingsService.updateSetting('gupshupApiKey', {
            value: unmaskedKey,
            lastTestedAt: new Date().toISOString(),
            reason: 'Connection test successful',
          });
        } catch (e) {}
      } else {
        toast.error(result.message || 'Connection failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Test failed');
    } finally {
      setTestingGupshup(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6 max-w-4xl mx-auto">
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
      <div className="sleek-page p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <p className="text-gray-500 dark:text-gray-400">Manage integrations and company details</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
          Integration keys are encrypted and stored securely on the server.
        </div>

        {/* Company Details */}
        <div className="bg-white rounded-xl shadow-sm border p-6 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center dark:bg-blue-900/30">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Company Details</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Your company information</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tool Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="Enter tool name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tool Logo URL</label>
              <input
                type="text"
                inputMode="url"
                value={appLogoUrl}
                onChange={(e) => setAppLogoUrl(e.target.value)}
                onBlur={() => setAppLogoUrl((value) => normalizeUrl(value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="https://your-domain.com/logo.png"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Website Link</label>
              <input
                type="text"
                inputMode="url"
                value={websiteLink}
                onChange={(e) => setWebsiteLink(e.target.value)}
                onBlur={() => setWebsiteLink((value) => normalizeUrl(value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="https://your-company.com"
              />
            </div>
          </div>
        </div>

        {/* IndiaMART Integration */}
        <div className="bg-white rounded-xl shadow-sm border p-6 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center dark:bg-orange-900/30">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">IndiaMART Integration</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Auto-fetch leads from IndiaMART into your campaign</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pull API Key</label>
                <div className="relative">
                  <input
                    type={showIndiamartApiKey ? 'text' : 'password'}
                    value={indiamartApiKey}
                    onChange={(e) => setIndiamartApiKey(e.target.value)}
                    className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    placeholder="Enter your IndiaMART Pull API key"
                  />
                  <button
                    type="button"
                    onClick={() => setShowIndiamartApiKey((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    {showIndiamartApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">
                  Generate at seller.indiamart.com &gt; Lead Manager &gt; Pull API
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Campaign</label>
                <select
                  value={indiamartCampaignId}
                  onChange={(e) => setIndiamartCampaignId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                >
                  <option value="">Select a campaign</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">Leads will be imported into this campaign</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg dark:bg-gray-900/50">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-Fetch Leads</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Automatically fetch new leads every 10 minutes</p>
              </div>
              <button
                type="button"
                onClick={() => setIndiamartAutoFetch(!indiamartAutoFetch)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  indiamartAutoFetch ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    indiamartAutoFetch ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {indiamartLastFetch && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Last fetched: {new Date(indiamartLastFetch).toLocaleString()}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleTestIndiamart}
                disabled={testingIndiamart || !indiamartApiKey}
                className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium"
              >
                {testingIndiamart ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Testing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Test Connection
                  </>
                )}
              </button>
              <button
                onClick={handleFetchNow}
                disabled={fetchingNow || !indiamartApiKey || !indiamartCampaignId}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
              >
                {fetchingNow ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Fetching...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Fetch Now
                  </>
                )}
              </button>
            </div>

            {importResult && (
              <div className={`p-4 rounded-lg border ${
                importResult.imported > 0
                  ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                  : 'bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700'
              }`}>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Fetch Result</p>
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <p>Fetched: {importResult.fetched} leads from IndiaMART</p>
                  <p className="text-green-600 dark:text-green-400">Imported: {importResult.imported} new leads</p>
                  <p>Duplicates skipped: {importResult.duplicates}</p>
                  {importResult.errors > 0 && (
                    <p className="text-red-600 dark:text-red-400">Errors: {importResult.errors}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Process Sutra Integration */}
        <div className="bg-white rounded-xl shadow-sm border p-6 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center dark:bg-purple-900/30">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Process Sutra Integration</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Connect your Process Sutra account</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Process Sutra API Key</label>
              <div className="relative">
                <input
                  type={showProcessSutraApiKey ? 'text' : 'password'}
                  value={processSutraApiKey}
                  onChange={(e) => setProcessSutraApiKey(e.target.value)}
                  className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  placeholder="Enter your Process Sutra API key"
                />
                <button
                  type="button"
                  onClick={() => setShowProcessSutraApiKey((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  {showProcessSutraApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">Found in your Process Sutra admin panel</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Process Sutra System Name</label>
              <input
                type="text"
                value={processSutraSystemName}
                onChange={(e) => setProcessSutraSystemName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="Enter system name"
              />
              <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">Unique identifier for this CRM instance</p>
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={handleTestProcessSutra}
              disabled={testingProcessSutra || !processSutraApiKey || !processSutraSystemName}
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
            >
              {testingProcessSutra ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Testing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Test Connection
                </>
              )}
            </button>
          </div>
        </div>

        {/* Gupshup WhatsApp Integration */}
        <div className="bg-white rounded-xl shadow-sm border p-6 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center dark:bg-green-900/30">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">WhatsApp (Gupshup)</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Send WhatsApp messages to leads via Gupshup Business API</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gupshup API Key</label>
              <div className="relative">
                <input
                  type={showGupshupApiKey ? 'text' : 'password'}
                  value={gupshupApiKey}
                  onChange={(e) => setGupshupApiKey(e.target.value)}
                  className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  placeholder="Enter your Gupshup API key"
                />
                <button
                  type="button"
                  onClick={() => setShowGupshupApiKey((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  {showGupshupApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">Found in Gupshup Console &gt; Settings &gt; API Keys</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source Phone Number</label>
              <input
                type="text"
                value={gupshupSource}
                onChange={(e) => setGupshupSource(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="917834811114"
              />
              <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">Your WhatsApp Business number in E.164 format</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gupshup App Name</label>
              <input
                type="text"
                value={gupshupAppName}
                onChange={(e) => setGupshupAppName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="MyBusinessApp"
              />
              <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">Your Gupshup app name registered against the phone number</p>
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={handleTestGupshup}
              disabled={testingGupshup || !gupshupApiKey || !gupshupSource || !gupshupAppName}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
            >
              {testingGupshup ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Testing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Test Connection
                </>
              )}
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
