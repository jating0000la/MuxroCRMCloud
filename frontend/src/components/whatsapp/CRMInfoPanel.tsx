import React, { useState } from 'react';
import { ChatConversation, ChatMessage } from '../../services/whatsapp';
import {
  X, User, Phone, Mail, Building2, Briefcase, Tag, Calendar,
  ExternalLink, Edit3, PhoneCall, MailIcon, Clock, MessageSquare,
  FileText, TrendingUp, ArrowRight, Plus, ChevronDown, ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface CRMInfoPanelProps {
  chat: ChatConversation;
  messages: ChatMessage[];
  onClose: () => void;
}

// Timeline event types
interface TimelineEvent {
  id: string;
  type: 'created' | 'message' | 'call' | 'note' | 'followup' | 'status';
  title: string;
  description?: string;
  time: string;
  icon: React.ElementType;
  color: string;
}

export default function CRMInfoPanel({ chat, messages, onClose }: CRMInfoPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    details: true,
    timeline: true,
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Build timeline from messages
  const timeline: TimelineEvent[] = [
    {
      id: 'created',
      type: 'created' as const,
      title: 'Lead Created',
      description: `First contact from ${chat.phone}`,
      time: messages.length > 0 ? messages[messages.length - 1].createdAt : new Date().toISOString(),
      icon: Plus,
      color: 'bg-green-500',
    },
    ...messages.slice(-10).map((msg) => ({
      id: msg.id,
      type: 'message' as const,
      title: msg.direction === 'out' ? 'Message Sent' : 'Message Received',
      description: msg.message || `[${msg.type}]`,
      time: msg.createdAt,
      icon: MessageSquare,
      color: msg.direction === 'out' ? 'bg-blue-500' : 'bg-green-400',
    })),
  ];

  return (
    <div className="flex h-full w-full flex-col border-l border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-gray-700">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Contact Info</h3>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-gray-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile card */}
        <div className="flex flex-col items-center border-b border-slate-100 px-4 py-6 dark:border-gray-800">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-xl font-bold text-white shadow-lg shadow-green-500/20">
            {chat.name ? chat.name.charAt(0).toUpperCase() : '👤'}
          </div>
          <h4 className="mt-3 text-base font-bold text-slate-800 dark:text-slate-100">
            {chat.name || 'Unknown Contact'}
          </h4>
          <p className="text-xs text-slate-500 dark:text-gray-400">{chat.phone}</p>

          {/* Quick actions */}
          <div className="mt-4 flex gap-2">
            <QuickAction icon={<PhoneCall className="h-3.5 w-3.5" />} label="Call" color="green" />
            <QuickAction icon={<MailIcon className="h-3.5 w-3.5" />} label="Email" color="blue" />
            <QuickAction icon={<Calendar className="h-3.5 w-3.5" />} label="Follow-up" color="orange" />
            <QuickAction icon={<ExternalLink className="h-3.5 w-3.5" />} label="Open Lead" color="purple" />
          </div>
        </div>

        {/* Customer Details */}
        <CollapsibleSection
          title="Customer Details"
          icon={<User className="h-4 w-4" />}
          expanded={expandedSections.details}
          onToggle={() => toggleSection('details')}
        >
          <div className="space-y-3">
            <DetailRow icon={<User className="h-3.5 w-3.5" />} label="Name" value={chat.name || '—'} />
            <DetailRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={chat.phone} />
            <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value="—" />
            <DetailRow icon={<Building2 className="h-3.5 w-3.5" />} label="Company" value="—" />
            <DetailRow icon={<Briefcase className="h-3.5 w-3.5" />} label="Designation" value="—" />
            <DetailRow
              icon={<Tag className="h-3.5 w-3.5" />}
              label="Lead Status"
              value="New"
              badge
              badgeColor="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            />
            <DetailRow icon={<TrendingUp className="h-3.5 w-3.5" />} label="Lead Source" value="WhatsApp" />
            <DetailRow icon={<Tag className="h-3.5 w-3.5" />} label="Priority" value="—" />
            <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Last Follow-up" value="—" />
            <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Next Follow-up" value="—" />
          </div>
        </CollapsibleSection>

        {/* Tags */}
        <div className="border-t border-slate-100 px-4 py-3 dark:border-gray-800">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-gray-300">
            <Tag className="h-3.5 w-3.5" />
            <span>Tags</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-primary-100 px-2.5 py-1 text-[10px] font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
              WhatsApp
            </span>
            <button
              onClick={() => toast('Tag management coming soon')}
              className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-primary-400 hover:text-primary-500 dark:border-gray-600 dark:hover:border-primary-500"
            >
              <Plus className="h-3 w-3" />
              Add Tag
            </button>
          </div>
        </div>

        {/* Conversation Stats */}
        <div className="border-t border-slate-100 px-4 py-3 dark:border-gray-800">
          <div className="grid grid-cols-3 gap-2">
            <StatMini label="Messages" value={chat.totalMessages} color="text-blue-600 dark:text-blue-400" />
            <StatMini label="Incoming" value={messages.filter(m => m.direction === 'in').length} color="text-green-600 dark:text-green-400" />
            <StatMini label="Outgoing" value={messages.filter(m => m.direction === 'out').length} color="text-violet-600 dark:text-violet-400" />
          </div>
        </div>

        {/* Timeline */}
        <CollapsibleSection
          title="Timeline"
          icon={<Clock className="h-4 w-4" />}
          expanded={expandedSections.timeline}
          onToggle={() => toggleSection('timeline')}
        >
          <div className="relative ml-2 border-l-2 border-slate-200 pl-4 dark:border-gray-700">
            {timeline.map((event, i) => {
              const Icon = event.icon;
              return (
                <div key={event.id} className="relative mb-4 last:mb-0">
                  {/* Dot */}
                  <div className={`absolute -left-[21px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full ${event.color} ring-2 ring-white dark:ring-gray-900`}>
                    <Icon className="h-2 w-2 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-gray-200">{event.title}</p>
                    {event.description && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 dark:text-gray-400">
                        {event.description}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-slate-400 dark:text-gray-500">
                      {format(new Date(event.time), 'dd MMM, h:mm a')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>

        {/* Notes section */}
        <div className="border-t border-slate-100 px-4 py-3 dark:border-gray-800">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-gray-300">
            <FileText className="h-3.5 w-3.5" />
            <span>Notes</span>
          </div>
          <textarea
            placeholder="Add a note about this customer..."
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-slate-200 dark:placeholder-gray-500"
            rows={3}
          />
          <button className="mt-2 w-full rounded-lg bg-primary-500 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-600">
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
}

// Sub-components

function QuickAction({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400',
    blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400',
    orange: 'bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400',
    purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400',
  };
  return (
    <button
      onClick={() => toast(`${label} — Coming soon`)}
      className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-medium transition-all ${colorMap[color] || colorMap.green}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function DetailRow({ icon, label, value, badge, badgeColor }: { icon: React.ReactNode; label: string; value: string; badge?: boolean; badgeColor?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
        {icon}
        <span>{label}</span>
      </div>
      {badge && badgeColor ? (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeColor}`}>{value}</span>
      ) : (
        <span className="text-xs font-medium text-slate-700 dark:text-gray-200">{value}</span>
      )}
    </div>
  );
}

function StatMini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2 text-center dark:bg-gray-800">
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

function CollapsibleSection({ title, icon, expanded, onToggle, children }: { title: string; icon: React.ReactNode; expanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 dark:border-gray-800">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-gray-300">
          {icon}
          <span>{title}</span>
        </div>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
