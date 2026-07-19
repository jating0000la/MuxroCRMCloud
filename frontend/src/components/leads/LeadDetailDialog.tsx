import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Lead, CampaignStatus, Followup } from '../../types';
import { leadService } from '../../services/leads';
import { followupService } from '../../services/followups';
import integrationService from '../../services/integrations';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Props {
  leadId: string;
  statuses: CampaignStatus[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function LeadDetailDialog({ leadId, statuses, onClose, onUpdate }: Props) {
  const { user } = useAuth();
  const canSendWhatsapp = user?.role === 'ADMIN';
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
  const [sendWhatsapp, setSendWhatsapp] = useState(false);

  // Cross-campaign history
  const [crossCampaignFollowups, setCrossCampaignFollowups] = useState<any[]>([]);
  const [loadingCross, setLoadingCross] = useState(false);

  const loadLead = useCallback(async () => {
    try {
      const [leadData, followupsData] = await Promise.all([
        leadService.getOne(leadId),
        followupService.getByLead(leadId),
      ]);
      setLead(leadData);
      setFollowups(followupsData);
      if (leadData.statusId) setStatusId(leadData.statusId);
      setDnd(leadData.dnd || false);

      // Load cross-campaign history
      if (leadData.phone || leadData.email) {
        setLoadingCross(true);
        try {
          const cross = await followupService.getCrossCampaign({
            phone: leadData.phone || undefined,
            email: leadData.email || undefined,
            excludeLeadId: leadId,
          });
          setCrossCampaignFollowups(cross || []);
        } catch {
          // Cross-campaign history is optional
        }
        setLoadingCross(false);
      }
    } catch (error) {
      toast.error('Failed to load lead details');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    let cancelled = false;
    loadLead();
    return () => { cancelled = true; };
  }, [loadLead]);

  useEffect(() => {
    setSendWhatsapp(canSendWhatsapp);
  }, [canSendWhatsapp]);

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
        nextCallDate: nextCallDate ? new Date(nextCallDate).toISOString() : undefined,
        dnd,
      });

      // Send WhatsApp if status has a message and lead has a phone
      if (canSendWhatsapp && sendWhatsapp && selectedStatus?.whatsappMessage && lead?.phone) {
        const message = selectedStatus.whatsappMessage
          .replace(/\{\{name\}\}/g, lead.name || '')
          .replace(/\{\{phone\}\}/g, lead.phone || '')
          .replace(/\{\{email\}\}/g, lead.email || '');
        try {
          await integrationService.sendGupshupMessage({
            destination: lead.phone,
            message,
          });
          toast.success('Status updated & WhatsApp sent');
        } catch {
          toast.success('Status updated (WhatsApp failed)');
        }
      } else {
        toast.success('Status updated successfully');
      }

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

  const handleDeleteFollowup = async (followupId: string) => {
    if (!confirm('Delete this followup record?')) return;
    try {
      await followupService.remove(followupId);
      toast.success('Followup deleted');
      setFollowups((prev) => prev.filter((f) => f.id !== followupId));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete followup');
    }
  };

  // Escape key and focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-xl p-8">
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-xl p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">Lead not found</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg">Close</button>
        </div>
      </div>
    );
  }

  const enquiryData = lead.customData || (lead as any).enquiry?.data || {};

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="Lead details">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
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
            <div className="flex items-center space-x-2">
              {lead.email && (
                <a
                   href={`https://mail.google.com/mail/u/0/?to=${encodeURIComponent(lead.email)}&body=${encodeURIComponent(`Dear ${lead.name}`)}&fs=1&tf=cm`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors"
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email
                </a>
              )}
              <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg" aria-label="Close">
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                DND
              </span>
            )}
            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
              lead.source === 'form' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
              lead.source === 'bulk' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
              'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}>
              {lead.source}
            </span>
            {lead.doer && (
              <span className="text-xs text-gray-500 dark:text-gray-400">Assigned to: {lead.doer.name}</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b dark:border-b dark:border-gray-700">
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
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
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
                    <div key={key} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{key}</label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                        {value === null || value === undefined || value === '' ? (
                          <span className="text-gray-400 dark:text-gray-500 italic">Not provided</span>
                        ) : typeof value === 'object' ? (
                          <span className="text-gray-700 dark:text-gray-300">{JSON.stringify(value, null, 2)}</span>
                        ) : (
                          String(value)
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400">No form data available</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">This lead was created manually</p>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="p-5">
              {followups.length === 0 && crossCampaignFollowups.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400">No history yet</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Current campaign history */}
                  {followups.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">This Campaign</h4>
                      <div className="space-y-4">
                        {followups.map((item, index) => (
                          <div key={item.id} className="relative pl-6 pb-4">
                            {index < followups.length - 1 && (
                              <div className="absolute left-2 top-3 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                            )}
                            <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-primary-100 dark:bg-primary-900/30 border-2 border-primary-500 dark:border-primary-400" />
                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.status}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {format(new Date(item.createdAt), 'MMM d, h:mm a')}
                                  </span>
                                  {canSendWhatsapp && (
                                    <button
                                      onClick={() => handleDeleteFollowup(item.id)}
                                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                      title="Delete followup"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
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
                    </div>
                  )}

                  {/* Cross-campaign history */}
                  {crossCampaignFollowups.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                        Other Campaigns ({crossCampaignFollowups.length})
                      </h4>
                      {loadingCross ? (
                        <p className="text-sm text-gray-400">Loading...</p>
                      ) : (
                        <div className="space-y-4">
                          {crossCampaignFollowups.map((item, index) => (
                            <div key={item.id} className="relative pl-6 pb-4">
                              {index < crossCampaignFollowups.length - 1 && (
                                <div className="absolute left-2 top-3 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                              )}
                              <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500 dark:border-orange-400" />
                              <div className="bg-orange-50 dark:bg-orange-900/10 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.status}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-medium">
                                      {item.lead?.campaign?.name || 'Other Campaign'}
                                    </span>
                                  </div>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {format(new Date(item.createdAt), 'MMM d, h:mm a')}
                                  </span>
                                </div>
                                {item.remarks && (
                                  <p className="text-sm text-gray-600 dark:text-gray-300">{item.remarks}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Update Status Tab */}
          {activeTab === 'update' && (
            <div className="p-5 space-y-5">
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
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: status.color || '#6B7280' }}
                        />
                        <span className="font-medium text-gray-900 dark:text-gray-100">{status.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 resize-none"
                  placeholder="Add remarks..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Remarks</label>
                <div className="flex flex-wrap gap-2">
                  {quickRemarks.map((quickRemark) => (
                    <button
                      key={quickRemark}
                      type="button"
                      onClick={() => setRemarks(quickRemark)}
                      className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      {quickRemark}
                    </button>
                  ))}
                </div>
              </div>

              {/* WhatsApp preview when status has message */}
              {canSendWhatsapp && statusId && (() => {
                const sel = statuses.find((s) => s.id === statusId);
                if (!sel?.whatsappMessage) return null;
                const preview = sel.whatsappMessage
                  .replace(/\{\{name\}\}/g, lead?.name || 'John')
                  .replace(/\{\{phone\}\}/g, lead?.phone || '+91 XXXXX XXXXX')
                  .replace(/\{\{email\}\}/g, lead?.email || 'email@example.com');
                return (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        <span className="text-sm font-medium text-green-800 dark:text-green-300">WhatsApp will be sent</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSendWhatsapp(!sendWhatsapp)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${sendWhatsapp ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform`} style={{ transform: sendWhatsapp ? 'translateX(18px)' : 'translateX(2px)' }} />
                      </button>
                    </div>
                    <p className="text-xs text-green-700 dark:text-green-400 bg-white dark:bg-gray-800 rounded p-2 border border-green-100 dark:border-green-900">{preview}</p>
                  </div>
                );
              })()}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Next Call Date</label>
                <input
                  type="datetime-local"
                  value={nextCallDate}
                  onChange={(e) => setNextCallDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border dark:border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${dnd ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-200 dark:bg-gray-600'}`}>
                    <svg className={`w-5 h-5 ${dnd ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Do Not Disturb (DND)</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Mark this lead as DND to stop all contact attempts</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDnd(!dnd)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    dnd ? 'bg-red-600' : 'bg-gray-300 dark:bg-gray-600'
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
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  This lead will be marked as DND and appear in the DND list.
                </p>
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
