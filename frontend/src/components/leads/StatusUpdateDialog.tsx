import React, { useState, useEffect } from 'react';
import { Lead, CampaignStatus, Followup } from '../../types';
import { leadService } from '../../services/leads';
import { followupService } from '../../services/followups';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Props {
  lead: Lead;
  statuses: CampaignStatus[];
  onClose: () => void;
  onUpdate: () => void;
}

const quickRemarks = [
  'Called, no answer',
  'Left voicemail',
  'Interested, will call back',
  'Meeting scheduled',
  'Not interested',
  'Request sent via email',
];

export default function StatusUpdateDialog({ lead, statuses, onClose, onUpdate }: Props) {
  const [statusId, setStatusId] = useState(lead.statusId || '');
  const [remarks, setRemarks] = useState('');
  const [nextCallDate, setNextCallDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Followup[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeTab, setActiveTab] = useState<'update' | 'history'>('update');

  useEffect(() => {
    loadHistory();
  }, [lead.id]);

  const loadHistory = async () => {
    try {
      const data = await followupService.getByLead(lead.id);
      setHistory(data);
    } catch (error) {
      console.error('Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const selectedStatus = statuses.find((s) => s.id === statusId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await leadService.updateStatus(lead.id, {
        status: selectedStatus?.label || 'Updated',
        statusId: statusId || undefined,
        remarks: remarks || undefined,
        nextCallDate: nextCallDate || undefined,
      });
      toast.success('Status updated successfully');
      onUpdate();
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Lead Info Header */}
        <div className="p-5 border-b dark:border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                <span className="text-lg font-semibold text-primary-700 dark:text-primary-300">{lead.name.charAt(0)}</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{lead.name}</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  {lead.email && <span>{lead.email}</span>}
                  {lead.email && lead.phone && <span>-</span>}
                  {lead.phone && <span>{lead.phone}</span>}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg" aria-label="Close">
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b dark:border-b dark:border-gray-700">
          <button
            onClick={() => setActiveTab('update')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'update'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Update Status
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            History ({history.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'update' ? (
            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {/* Status Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {statuses.map((status) => (
                    <button
                      key={status.id}
                      type="button"
                      onClick={() => setStatusId(status.id)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        statusId === status.id
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{status.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Remarks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Notes</label>
                <div className="flex flex-wrap gap-2">
                  {quickRemarks.map((remark) => (
                    <button
                      key={remark}
                      type="button"
                      onClick={() => setRemarks(remark)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                        remarks === remark
                          ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                          : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {remark}
                    </button>
                  ))}
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={3}
                  placeholder="Add notes about this interaction..."
                />
              </div>

              {/* Next Call Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Schedule Next Call</label>
                <input
                  type="datetime-local"
                  value={nextCallDate}
                  onChange={(e) => setNextCallDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </form>
          ) : (
            <div className="p-5">
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400">No history yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((item, index) => (
                    <div key={item.id} className="relative pl-6 pb-4">
                      {index < history.length - 1 && (
                        <div className="absolute left-2 top-3 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                      )}
                      <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-primary-100 dark:bg-primary-900/30 border-2 border-primary-500 dark:border-primary-400" />
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.status}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {format(new Date(item.createdAt), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        {item.remarks && (
                          <p className="text-sm text-gray-600 dark:text-gray-300">{item.remarks}</p>
                        )}
                        {item.nextCallDate && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                            Next call: {format(new Date(item.nextCallDate), 'MMM d, h:mm a')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'update' && (
          <div className="p-5 border-t dark:border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !statusId}
                className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Update'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
