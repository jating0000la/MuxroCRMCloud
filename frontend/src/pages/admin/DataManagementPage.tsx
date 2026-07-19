import React, { useState } from 'react';
import Layout from '../../components/layout/Layout';
import { dataExportService, DeleteAllDataResult } from '../../services/dataExport';
import toast from 'react-hot-toast';

export default function DataManagementPage() {
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [lastDeleteResult, setLastDeleteResult] = useState<DeleteAllDataResult | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await dataExportService.downloadAllData();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `campaign_data_export_${timestamp}.zip`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Campaign data downloaded successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await dataExportService.deleteAllData();
      setLastDeleteResult(result);
      toast.success('All campaign data has been deleted');
      setConfirmDelete(false);
      setDeleteConfirmText('');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Deletion failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="sleek-page p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Data Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Download all campaign data or permanently delete it from the system
          </p>
        </div>

        {/* Download Section */}
        <div className="bg-white rounded-xl shadow-sm border dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Download All Campaign Data
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Export all campaign data as a ZIP file containing CSV files. The export includes:
                </p>
                <ul className="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    <span><strong>campaigns.csv</strong> — All campaigns with manager info</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                    <span><strong>leads.csv</strong> — All leads with campaign, status, and assignee</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                    <span><strong>forms.csv</strong> — All form definitions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    <span><strong>form_responses.csv</strong> — All form submissions (flattened from JSON)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    <span><strong>campaign_statuses.csv</strong> — All pipeline statuses</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                    <span><strong>followups.csv</strong> — All follow-up records</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center justify-center px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {downloading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Preparing Export...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download CSV ZIP
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Delete Section */}
        <div className="bg-white rounded-xl shadow-sm border border-red-100 dark:bg-gray-800 dark:border-red-900/50 overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-red-700 dark:text-red-400">
                  Delete All Campaign Data
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Permanently delete <strong>all</strong> campaigns, leads, forms, form responses, statuses, and follow-ups. 
                  This action is <span className="font-semibold text-red-600 dark:text-red-400">irreversible</span> and 
                  will remove all CRM data from the system. User accounts and settings are preserved.
                </p>
              </div>
              <button
                onClick={() => { setConfirmDelete(true); setDeleteConfirmText(''); }}
                disabled={deleting}
                className="inline-flex items-center justify-center px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete All Data
              </button>
            </div>
          </div>
        </div>

        {/* Last Delete Result */}
        {lastDeleteResult && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-900/20">
            <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Last deletion result:</p>
            <div className="text-amber-700 dark:text-amber-400 grid grid-cols-2 sm:grid-cols-4 gap-1">
              <span>Campaigns: {lastDeleteResult.deletedCampaigns}</span>
              <span>Leads: {lastDeleteResult.deletedLeads}</span>
              <span>Forms: {lastDeleteResult.deletedForms}</span>
              <span>Follow-ups: {lastDeleteResult.deletedFollowups}</span>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Delete All Campaign Data?</h3>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This will <span className="font-semibold text-red-600 dark:text-red-400">permanently delete</span> all 
              campaigns, leads, forms, form responses, statuses, and follow-ups. This action cannot be undone.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              It is recommended to <strong>download a backup first</strong> before proceeding.
            </p>
            <label className="block mt-4">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                Type <span className="font-mono text-red-600">DELETE ALL</span> to confirm
              </span>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                placeholder="DELETE ALL"
                autoFocus
              />
            </label>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setConfirmDelete(false); setDeleteConfirmText(''); }}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmText !== 'DELETE ALL' || deleting}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
