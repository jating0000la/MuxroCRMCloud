import { ChatMessage } from '../../../services/whatsapp';
import { Followup } from '../../../types';

// ─── Timeline Event Types ───────────────────────────────────────────────────

export type TimelineEventType = 'whatsapp' | 'status' | 'other_campaign';

export interface MediaPreview {
  type: 'image' | 'video' | 'audio' | 'file' | 'unknown';
  url: string | null;
  name: string | null;
}

export interface TimelineWhatsAppEvent {
  kind: 'whatsapp';
  id: string;
  direction: 'in' | 'out';
  message: string | null;
  type: string;
  mediaUrl: string | null;
  mediaPreview?: MediaPreview | null;
  senderName: string | null;
  campaignName: string;
  campaignId: string;
  createdAt: string;
}

export interface TimelineStatusEvent {
  kind: 'status';
  id: string;
  oldStatus: string | null;
  newStatus: string;
  remarks: string | null;
  updatedBy: string | null;
  userId: string;
  leadId: string;
  campaignName: string;
  campaignId: string;
  nextCallDate?: string | null;
  createdAt: string;
}

export interface TimelineOtherCampaignEvent {
  kind: 'other_campaign';
  id: string;
  status: string;
  oldStatus?: string | null;
  remarks: string | null;
  updatedBy: string | null;
  campaignName: string;
  campaignId: string;
  leadName: string;
  createdAt: string;
}

export type TimelineEvent = TimelineWhatsAppEvent | TimelineStatusEvent | TimelineOtherCampaignEvent;

// ─── Date Group ─────────────────────────────────────────────────────────────

export interface DateGroup {
  label: string;
  date: string;
  events: TimelineEvent[];
}

// ─── Filter Types ───────────────────────────────────────────────────────────

export type EventTypeFilter = 'all' | 'whatsapp' | 'status' | 'notes' | 'attachments';

export interface TimelineFilters {
  eventType: EventTypeFilter;
  campaignId: string;
  dateFrom: string;
  dateTo: string;
  search: string;
}

// ─── Campaign Option ────────────────────────────────────────────────────────

export interface CampaignOption {
  id: string;
  name: string;
}

// ─── Media Helpers ──────────────────────────────────────────────────────────

export function getMediaPreview(mediaUrl: string | null, type: string | null): MediaPreview | null {
  if (!mediaUrl) return null;

  const mediaType = type || 'file';
  const urlLower = mediaUrl.toLowerCase();

  if (mediaType === 'image' || urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i)) {
    return { type: 'image', url: mediaUrl, name: extractFileName(mediaUrl) };
  }
  if (mediaType === 'video' || urlLower.match(/\.(mp4|webm|avi|mov|mkv)$/i)) {
    return { type: 'video', url: mediaUrl, name: extractFileName(mediaUrl) };
  }
  if (mediaType === 'audio' || urlLower.match(/\.(mp3|wav|ogg|aac|m4a)$/i)) {
    return { type: 'audio', url: mediaUrl, name: extractFileName(mediaUrl) };
  }
  if (mediaType === 'file' || urlLower.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar)$/i)) {
    return { type: 'file', url: mediaUrl, name: extractFileName(mediaUrl) };
  }

  return { type: 'file', url: mediaUrl, name: extractFileName(mediaUrl) };
}

function extractFileName(url: string): string {
  try {
    const segments = url.split('/');
    const last = segments[segments.length - 1] || 'file';
    return decodeURIComponent(last.split('?')[0]);
  } catch {
    return 'file';
  }
}

// ─── Convert ChatMessage to TimelineEvent ──────────────────────────────────

export function whatsappMessageToEvent(
  msg: ChatMessage,
  campaignName: string,
): TimelineWhatsAppEvent {
  return {
    kind: 'whatsapp',
    id: `wa-${msg.id}`,
    direction: msg.direction,
    message: msg.message,
    type: msg.type,
    mediaUrl: msg.mediaUrl,
    mediaPreview: getMediaPreview(msg.mediaUrl, msg.type),
    senderName: msg.name || (msg.direction === 'in' ? 'Customer' : 'You'),
    campaignName,
    campaignId: msg.campaignId || '',
    createdAt: msg.createdAt,
  };
}

// ─── Convert Followup to TimelineEvent (current campaign) ──────────────────

export function followupToStatusEvent(
  followup: Followup,
  campaignName: string,
  campaignId: string,
  previousStatus?: string | null,
): TimelineStatusEvent {
  return {
    kind: 'status',
    id: `fu-${followup.id}`,
    oldStatus: previousStatus || null,
    newStatus: followup.status,
    remarks: followup.remarks || null,
    updatedBy: followup.user?.name || followup.user?.username || 'System',
    userId: followup.userId,
    leadId: followup.leadId,
    campaignName,
    campaignId,
    nextCallDate: followup.nextCallDate || null,
    createdAt: followup.createdAt,
  };
}

// ─── Convert Cross-Campaign Followup to TimelineEvent ──────────────────────

export function crossCampaignToEvent(
  followup: any,
): TimelineOtherCampaignEvent {
  return {
    kind: 'other_campaign',
    id: `cc-${followup.id}`,
    status: followup.status,
    oldStatus: null,
    remarks: followup.remarks || null,
    updatedBy: followup.user?.name || followup.user?.username || 'System',
    campaignName: followup.lead?.campaign?.name || 'Other Campaign',
    campaignId: followup.lead?.campaignId || '',
    leadName: followup.lead?.name || '',
    createdAt: followup.createdAt,
  };
}

// ─── Group events by date ──────────────────────────────────────────────────

export function groupEventsByDate(events: TimelineEvent[]): DateGroup[] {
  const groups = new Map<string, TimelineEvent[]>();

  for (const event of events) {
    const dateKey = new Date(event.createdAt).toISOString().split('T')[0];
    const existing = groups.get(dateKey) || [];
    existing.push(event);
    groups.set(dateKey, existing);
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

  const sorted = Array.from(groups.entries())
    .map(([dateKey, evts]) => {
      let label: string;
      if (dateKey === todayStr) {
        label = 'Today';
      } else if (dateKey === yesterdayStr) {
        label = 'Yesterday';
      } else {
        const d = new Date(dateKey + 'T00:00:00');
        label = d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
      }

      evts.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      return { label, date: dateKey, events: evts };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return sorted;
}

// ─── Get icon color for event kind ─────────────────────────────────────────

export function getEventColor(kind: TimelineEvent['kind']): string {
  switch (kind) {
    case 'whatsapp':
      return 'emerald';
    case 'status':
      return 'blue';
    case 'other_campaign':
      return 'violet';
    default:
      return 'gray';
  }
}
