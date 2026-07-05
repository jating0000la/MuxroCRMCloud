import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/layout/Layout';
import integrationService from '../../services/integrations';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user } = useAuth();

  // Indiamart settings
  const [indiamartApiKey, setIndiamartApiKey] = useState('');
  const [webappUrl, setWebappUrl] = useState('https://your-webapp.com');

  // Company settings
  const [companyName, setCompanyName] = useState('Muxro CRM Cloud');
  const [websiteLink, setWebsiteLink] = useState('https://your-company.com');

  // Process Sutra settings
  const [processSutraApiKey, setProcessSutraApiKey] = useState('');
  const [processSutraSystemName, setProcessSutraSystemName] = useState('');

  const [saving, setSaving] = useState(false);
  const [testingIndiamart, setTestingIndiamart] = useState(false);
  const [testingProcessSutra, setTestingProcessSutra] = useState(false);

  // Load saved settings from localStorage
  useEffect(() => {
    try {
      const psSettings = localStorage.getItem('processSutraSettings');
      if (psSettings) {
        const parsed = JSON.parse(psSettings);
        setProcessSutraApiKey(parsed.apiKey || '');
        setProcessSutraSystemName(parsed.systemName || '');
      }

      const imSettings = localStorage.getItem('indiamartSettings');
      if (imSettings) {
        const parsed = JSON.parse(imSettings);
        setIndiamartApiKey(parsed.apiKey || '');
        setWebappUrl(parsed.webappUrl || 'https://your-webapp.com');
      }

      const coSettings = localStorage.getItem('companySettings');
      if (coSettings) {
        const parsed = JSON.parse(coSettings);
        setCompanyName(parsed.companyName || 'Muxro CRM Cloud');
        setWebsiteLink(parsed.websiteLink || 'https://your-company.com');
      }
    } catch {
      // Ignore corrupted localStorage data
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);

    // Save Process Sutra settings to localStorage for Follow-up page access
    localStorage.setItem('processSutraSettings', JSON.stringify({
      apiKey: processSutraApiKey,
      systemName: processSutraSystemName,
    }));

    // Save Indiamart settings
    localStorage.setItem('indiamartSettings', JSON.stringify({
      apiKey: indiamartApiKey,
      webappUrl,
    }));

    // Save company settings
    localStorage.setItem('companySettings', JSON.stringify({
      companyName,
      websiteLink,
    }));

    await new Promise((r) => setTimeout(r, 800));
    toast.success('Settings saved successfully');
    setSaving(false);
  };

  const handleTestIndiamart = async () => {
    if (!indiamartApiKey) {
      toast.error('Enter Indiamart API key first');
      return;
    }
    setTestingIndiamart(true);
    try {
      const result = await integrationService.testIndiamart({
        apiKey: indiamartApiKey,
        webappUrl,
      });
      if (result.success) {
        toast.success(result.message);
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
      const result = await integrationService.testProcessSutra({
        apiKey: processSutraApiKey,
        systemName: processSutraSystemName,
      });
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message || 'Connection failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Test failed');
    } finally {
      setTestingProcessSutra(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-1">Manage integrations and company details</p>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter company name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website Link</label>
              <input
                type="url"
                value={websiteLink}
                onChange={(e) => setWebsiteLink(e.target.value)}
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
              <input
                type="password"
                value={indiamartApiKey}
                onChange={(e) => setIndiamartApiKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter your Indiamart API key"
              />
              <p className="text-xs text-gray-400 mt-1">Found in your Indiamart seller dashboard</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Webapp URL</label>
              <input
                type="url"
                value={webappUrl}
                onChange={(e) => setWebappUrl(e.target.value)}
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
              <input
                type="password"
                value={processSutraApiKey}
                onChange={(e) => setProcessSutraApiKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter your Process Sutra API key"
              />
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
