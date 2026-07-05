import React, { useState, useEffect } from 'react';
import { Lead, CampaignStatus, Followup } from '../../types';
import { leadService } from '../../services/leads';
import { followupService } from '../../services/followups';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Props {
  leadId: string;
  statuses: CampaignStatus[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function LeadDetailDialog({ leadId, statuses, onClose, onUpdate }: Props) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'update'>('details');

  // Status update form
  const [statusId, setStatusId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [nextCallDate, setNextCallDate] = useState('');
  const [dnd, setDnd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadLead();
  }, [leadId]);

  const loadLead = async () => {
    try {
      const [leadData, followupsData] = await Promise.all([
        leadService.getOne(leadId),
        followupService.getByLead(leadId),
      ]);
      setLead(leadData);
      setFollowups(followupsData);
      if (leadData.statusId) setStatusId(leadData.statusId);
      setDnd(leadData.dnd || false);
    } catch (error) {
      toast.error('Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!statusId) {
      toast.error('Please select a status');
      return;
    }
    setSubmitting(true);
    try {
      const selectedStatus = statuses.find((s) => s.id === statusId);
      await leadService.updateStatus(leadId, {
        status: selectedStatus?.label || 'Updated',
        statusId,
        remarks: remarks || undefined,
        nextCallDate: nextCallDate || undefined,
        dnd,
      });
      toast.success('Status updated successfully');
      onUpdate();
      loadLead();
      setActiveTab('history');
      setRemarks('');
      setNextCallDate('');
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  const quickRemarks = [
    'Called, no answer',
    'Left voicemail',
    'Interested, will call back',
    'Meeting scheduled',
    'Not interested',
    'Request sent via email',
  ];

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl p-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl p-8 text-center">
          <p className="text-gray-500">Lead not found</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg">Close</button>
        </div>
      </div>
    );
  }

  const enquiryData = lead.customData || (lead as any).enquiry?.data || {};

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-lg font-semibold text-primary-700">{lead.name.charAt(0)}</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{lead.name}</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  {lead.email && <span>{lead.email}</span>}
                  {lead.email && lead.phone && <span>-</span>}
                  {lead.phone && <span>{lead.phone}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {lead.phone && (
                <a
                  href={`https://api.whatsapp.com/send/?phone=91${lead.phone.replace(/[^0-9]/g, '')}&text=Dear ${lead.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
                >
                  <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </a>
              )}
              {lead.email && (
                <a
                  href={`https://mail.google.com/mail/u/0/?to=${lead.email}&body=Dear ${lead.name}&fs=1&tf=cm`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email
                </a>
              )}
              <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            {lead.status && (
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: lead.status.color + '20', color: lead.status.color }}
              >
                {lead.status.label}
              </span>
            )}
            {lead.dnd && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                DND
              </span>
            )}
            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
              lead.source === 'form' ? 'bg-blue-100 text-blue-700' :
              lead.source === 'bulk' ? 'bg-purple-100 text-purple-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {lead.source}
            </span>
            {lead.doer && (
              <span className="text-xs text-gray-500">Assigned to: {lead.doer.name}</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {[
            { key: 'details' as const, label: 'Form Data' },
            { key: 'history' as const, label: `History (${followups.length})` },
            { key: 'update' as const, label: 'Update Status' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Form Data Tab */}
          {activeTab === 'details' && (
            <div className="p-5">
              {Object.keys(enquiryData).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(enquiryData).map(([key, value]) => (
                    <div key={key} className="bg-gray-50 rounded-lg p-3">
                      <label className="text-xs font-medium text-gray-500 uppercase">{key}</label>
                      <p className="text-sm text-gray-900 mt-1">
                        {value === null || value === undefined || value === '' ? (
                          <span className="text-gray-400 italic">Not provided</span>
                        ) : typeof value === 'object' ? (
                          <span className="text-gray-700">{JSON.stringify(value, null, 2)}</span>
                        ) : (
                          String(value)
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500">No form data available</p>
                  <p className="text-sm text-gray-400 mt-1">This lead was created manually</p>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="p-5">
              {followups.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-500">No history yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {followups.map((item, index) => (
                    <div key={item.id} className="relative pl-6 pb-4">
                      {index < followups.length - 1 && (
                        <div className="absolute left-2 top-3 bottom-0 w-0.5 bg-gray-200" />
                      )}
                      <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-primary-100 border-2 border-primary-500" />
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900">{item.status}</span>
                          <span className="text-xs text-gray-500">
                            {format(new Date(item.createdAt), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        {item.remarks && (
                          <p className="text-sm text-gray-600">{item.remarks}</p>
                        )}
                        {item.nextCallDate && (
                          <p className="text-xs text-yellow-600 mt-1">
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

          {/* Update Status Tab */}
          {activeTab === 'update' && (
            <div className="p-5 space-y-5">
              {/* Status Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {statuses.map((status) => (
                    <button
                      key={status.id}
                      type="button"
                      onClick={() => setStatusId(status.id)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        statusId === status.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                        <span className="text-sm font-medium text-gray-900">{status.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Remarks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quick Notes</label>
                <div className="flex flex-wrap gap-2">
                  {quickRemarks.map((remark) => (
                    <button
                      key={remark}
                      type="button"
                      onClick={() => setRemarks(remark)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                        remarks === remark
                          ? 'bg-primary-100 border-primary-300 text-primary-700'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {remark}
                    </button>
                  ))}
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={3}
                  placeholder="Add notes about this interaction..."
                />
              </div>

              {/* Next Call Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Next Call</label>
                <input
                  type="datetime-local"
                  value={nextCallDate}
                  onChange={(e) => setNextCallDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* DND Toggle */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${dnd ? 'bg-red-100' : 'bg-gray-200'}`}>
                      <svg className={`w-5 h-5 ${dnd ? 'text-red-600' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Do Not Disturb (DND)</p>
                      <p className="text-sm text-gray-500">Mark this lead as DND to stop all contact attempts</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDnd(!dnd)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      dnd ? 'bg-red-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        dnd ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {dnd && (
                  <p className="mt-2 text-sm text-red-600">
                    This lead will be marked as DND and appear in the DND list.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'update' && (
          <div className="p-5 border-t bg-gray-50">
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusUpdate}
                disabled={submitting || !statusId}
                className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save Update'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
