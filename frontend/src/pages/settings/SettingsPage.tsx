import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/layout/Layout';
import integrationService from '../../services/integrations';
import settingsService from '../../services/settings';
import { readBranding, saveBranding } from '../../utils/branding';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user } = useAuth();

  // Indiamart settings
  const [indiamartApiKey, setIndiamartApiKey] = useState('');
  const [webappUrl, setWebappUrl] = useState('https://your-webapp.com');

  // Company settings
  const initialBranding = readBranding();
  const [companyName, setCompanyName] = useState(initialBranding.appName || 'Muxro CRM');
  const [appLogoUrl, setAppLogoUrl] = useState(initialBranding.appLogoUrl || '');
  const [websiteLink, setWebsiteLink] = useState('https://your-company.com');

  // Process Sutra settings
  const [processSutraApiKey, setProcessSutraApiKey] = useState('');
  const [processSutraSystemName, setProcessSutraSystemName] = useState('');

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testingIndiamart, setTestingIndiamart] = useState(false);
  const [testingProcessSutra, setTestingProcessSutra] = useState(false);
  const [showIndiamartApiKey, setShowIndiamartApiKey] = useState(false);
  const [showProcessSutraApiKey, setShowProcessSutraApiKey] = useState(false);

  useEffect(() => {
    loadSettings();
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
      // URL constructor provides robust validation for common website inputs.
      new URL(candidate);
      return true;
    } catch {
      return false;
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
          case 'indiamartWebappUrl':
            setWebappUrl(setting.value);
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
        }
      });
    } catch (error: any) {
      console.log('Settings not yet configured:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!indiamartApiKey && !processSutraApiKey && !companyName) {
      toast.error('Enter at least one setting');
      return;
    }

    const normalizedWebappUrl = normalizeUrl(webappUrl);
    const normalizedAppLogoUrl = normalizeUrl(appLogoUrl);
    const normalizedWebsiteLink = normalizeUrl(websiteLink);
    const isMaskedPlaceholder = (value: string) => value.includes('•');

    if (!isValidUrl(webappUrl) || !isValidUrl(appLogoUrl) || !isValidUrl(websiteLink)) {
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
      { key: 'indiamartWebappUrl', value: normalizedWebappUrl, reason: 'Updated via Settings page' },
      { key: 'companyName', value: companyName, reason: 'Updated via Settings page' },
      { key: 'appLogoUrl', value: normalizedAppLogoUrl, reason: 'Updated via Settings page' },
      { key: 'websiteLink', value: normalizedWebsiteLink, reason: 'Updated via Settings page' },
      {
        key: 'processSutraApiKey',
        value: isMaskedPlaceholder(processSutraApiKey) ? '' : processSutraApiKey,
        reason: 'Updated via Settings page',
      },
      { key: 'processSutraSystemName', value: processSutraSystemName, reason: 'Updated via Settings page' },
    ];

    try {
      for (const setting of settingsToUpdate) {
        if (setting.value) {
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

        setWebappUrl(normalizedWebappUrl);
        setAppLogoUrl(normalizedAppLogoUrl);
        setWebsiteLink(normalizedWebsiteLink);

        toast.success('Settings saved successfully to secure storage');
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
      toast.error('Enter Indiamart API key first');
      return;
    }

    setTestingIndiamart(true);
    try {
      const unmaskedKey = indiamartApiKey.includes('•')
        ? await settingsService.getSettingUnmasked('indiamartApiKey')
        : indiamartApiKey;

      const result = await integrationService.testIndiamart({
        apiKey: unmaskedKey,
        webappUrl,
      });

      if (result.success) {
        toast.success(result.message);
        try {
          await settingsService.updateSetting('indiamartApiKey', {
            value: unmaskedKey,
            lastTestedAt: new Date().toISOString(),
            reason: 'Connection test successful',
          });
        } catch (e) {
          // Ignore timestamp update failures
        }
      } else {
        toast.error(result.message || 'Connection failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Test failed');
    } finally {
      setTestingIndiamart(false);
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
        } catch (e) {
          // Ignore timestamp update failures
        }
      } else {
        toast.error(result.message || 'Connection failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Test failed');
    } finally {
      setTestingProcessSutra(false);
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
              <p className="text-gray-600">Loading settings...</p>
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
          <p className="text-gray-500">Manage integrations and company details</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
          ✓ Integration keys are now encrypted and stored securely on the server. Your browser no longer stores sensitive credentials.
        </div>

        {/* Company Details */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Company Details</h2>
              <p className="text-sm text-gray-500">Your company information</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tool Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter tool name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tool Logo URL</label>
              <input
                type="text"
                inputMode="url"
                value={appLogoUrl}
                onChange={(e) => setAppLogoUrl(e.target.value)}
                onBlur={() => setAppLogoUrl((value) => normalizeUrl(value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="https://your-domain.com/logo.png"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website Link</label>
              <input
                type="text"
                inputMode="url"
                value={websiteLink}
                onChange={(e) => setWebsiteLink(e.target.value)}
                onBlur={() => setWebsiteLink((value) => normalizeUrl(value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="https://your-company.com"
              />
            </div>
          </div>
        </div>

        {/* Indiamart Integration */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Indiamart Integration</h2>
              <p className="text-sm text-gray-500">Connect your Indiamart account to fetch leads</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Indiamart API Key</label>
              <div className="relative">
                <input
                  type={showIndiamartApiKey ? 'text' : 'password'}
                  value={indiamartApiKey}
                  onChange={(e) => setIndiamartApiKey(e.target.value)}
                  className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter your Indiamart API key"
                />
                <button
                  type="button"
                  onClick={() => setShowIndiamartApiKey((value) => !value)}
                  className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                  {showIndiamartApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Found in your Indiamart seller dashboard</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Webapp URL</label>
              <input
                type="text"
                inputMode="url"
                value={webappUrl}
                onChange={(e) => setWebappUrl(e.target.value)}
                onBlur={() => setWebappUrl((value) => normalizeUrl(value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="https://your-webapp.com"
              />
              <p className="text-xs text-gray-400 mt-1">Callback URL for Indiamart leads</p>
            </div>
          </div>

          <div className="mt-4">
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
          </div>
        </div>

        {/* Process Sutra Integration */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Process Sutra Integration</h2>
              <p className="text-sm text-gray-500">Connect your Process Sutra account</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Process Sutra API Key</label>
              <div className="relative">
                <input
                  type={showProcessSutraApiKey ? 'text' : 'password'}
                  value={processSutraApiKey}
                  onChange={(e) => setProcessSutraApiKey(e.target.value)}
                  className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter your Process Sutra API key"
                />
                <button
                  type="button"
                  onClick={() => setShowProcessSutraApiKey((value) => !value)}
                  className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                  {showProcessSutraApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Found in your Process Sutra admin panel</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Process Sutra System Name</label>
              <input
                type="text"
                value={processSutraSystemName}
                onChange={(e) => setProcessSutraSystemName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter system name"
              />
              <p className="text-xs text-gray-400 mt-1">Unique identifier for this CRM instance</p>
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
