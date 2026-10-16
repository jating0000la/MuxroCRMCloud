import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ChatConversation, ChatMessage } from '../../services/whatsapp';
import { leadService } from '../../services/leads';
import { statusService } from '../../services/statuses';
import { Lead, CampaignStatus } from '../../types';
import LeadDetailDialog from '../leads/LeadDetailDialog';

interface Props {
  chat: ChatConversation;
  messages: ChatMessage[];
  onClose: () => void;
}

export default function CRMInfoPanel({ chat, messages, onClose }: Props) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [statuses, setStatuses] = useState<CampaignStatus[]>([]);
  const [openLead, setOpenLead] = useState(false);
  const [loading, setLoading] = useState(false);
  const leadId = [...messages].reverse().find(message => message.leadId)?.leadId;

  useEffect(() => {
    let active = true;
    setLead(null);
    setOpenLead(false);
    setStatuses([]);
    if (!leadId) return;
    setLoading(true);
    leadService.getOne(leadId).then(async data => {
      if (!active) return;
      setLead(data);
      const next = await statusService.getByCampaign(data.campaignId).catch(() => []);
      if (active) setStatuses(next);
    }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [leadId, chat.phone]);

  return (
    <aside className="flex h-full min-w-0 flex-col border-l border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-900" aria-label="Contact information">
      <div className="flex items-center justify-between border-b p-4 dark:border-gray-700">
        <h3 className="font-semibold">Contact Info</h3>
        <button onClick={onClose} aria-label="Close contact info" className="p-2"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-4 overflow-y-auto p-4 text-sm">
        <p className="font-semibold">{chat.name || chat.phone}</p>
        <a className="block text-primary-600" href={`tel:${chat.phone.replace(/[^0-9+]/g, '')}`}>{chat.phone}</a>
        <p>{chat.totalMessages} messages in this conversation</p>
        {loading ? <p>Loading linked lead…</p> : lead ? (
          <>
            <dl className="space-y-2">
              <div><dt className="text-gray-500">Lead</dt><dd>{lead.name}</dd></div>
              <div><dt className="text-gray-500">Campaign</dt><dd>{lead.campaign?.name || '—'}</dd></div>
              <div><dt className="text-gray-500">Status</dt><dd>{lead.status?.label || 'No status'}</dd></div>
              <div><dt className="text-gray-500">Source</dt><dd>{lead.source}</dd></div>
            </dl>
            {lead.email && <a className="block text-primary-600" href={`mailto:${lead.email}`}>{lead.email}</a>}
            <button onClick={() => setOpenLead(true)} className="rounded-lg bg-primary-600 px-4 py-2 text-white">Open Lead</button>
          </>
        ) : <p className="text-gray-500">No linked lead available.</p>}
      </div>
      {openLead && lead && <LeadDetailDialog leadId={lead.id} statuses={statuses}
        onClose={() => setOpenLead(false)} onUpdate={() => {
          setOpenLead(false);
          leadService.getOne(lead.id).then(setLead).catch(() => setLead(null));
        }} />}
    </aside>
  );
}
