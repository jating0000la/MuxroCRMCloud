import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  ArrowRight,
  ChevronDown,
  Image,
  Video,
  Music,
  FileText,
  Phone,
  Mail,
  Clock,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import EventIcon, { SmallEventIcon } from './EventIcon';
import CampaignBadge from './CampaignBadge';
import TimelineCard from './TimelineCard';
import TimelineFilterBar from './TimelineFilterBar';
import {
  TimelineEvent,
  TimelineWhatsAppEvent,
  TimelineStatusEvent,
  TimelineOtherCampaignEvent,
  DateGroup,
  TimelineFilters,
  CampaignOption,
  groupEventsByDate,
  getEventColor,
} from './types';

// ─── Props ──────────────────────────────────────────────────────────────────

interface LeadHistoryTimelineProps {
  events: TimelineEvent[];
  loading?: boolean;
  campaigns?: CampaignOption[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const EVENTS_PER_PAGE = 20;

// ─── Skeleton Loader ────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Date label */}
      <div className="flex items-center gap-3">
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="relative pl-14">
          {/* Timeline dot skeleton */}
          <div className="absolute left-[18px] top-1 w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="bg-white dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div className="mt-3 h-2 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Date Separator ─────────────────────────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-6 first:mt-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
        {label}
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-gray-200/60 via-gray-200/30 to-transparent dark:from-gray-700/60 dark:via-gray-700/30" />
    </div>
  );
}

// ─── Media Preview ──────────────────────────────────────────────────────────

function MediaPreview({ event }: { event: TimelineWhatsAppEvent }) {
  const preview = event.mediaPreview;
  if (!preview) return null;

  switch (preview.type) {
    case 'image':
      return (
        <div className="mt-2.5 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <img
            src={preview.url || ''}
            alt={preview.name || 'Image'}
            className="max-h-48 w-full object-cover cursor-pointer hover:scale-[1.02] transition-transform duration-200"
            loading="lazy"
          />
          <div className="px-2.5 py-1.5 text-[11px] text-gray-500 dark:text-gray-400 truncate border-t border-gray-100 dark:border-gray-700/50">
            🖼 {preview.name || 'image'}
          </div>
        </div>
      );
    case 'video':
      return (
        <div className="mt-2.5 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <video
            src={preview.url || ''}
            controls
            className="max-h-48 w-full object-cover"
            preload="metadata"
          >
            <source src={preview.url || ''} />
          </video>
          <div className="px-2.5 py-1.5 text-[11px] text-gray-500 dark:text-gray-400 truncate border-t border-gray-100 dark:border-gray-700/50">
            ▶ {preview.name || 'video'}
          </div>
        </div>
      );
    case 'audio':
      return (
        <div className="mt-2.5 flex items-center gap-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-3 py-2.5">
          <Music className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <audio
            src={preview.url || ''}
            controls
            className="flex-1 h-8"
            preload="none"
          >
            <source src={preview.url || ''} />
          </audio>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[100px]">
            {preview.name || 'audio'}
          </span>
        </div>
      );
    case 'file':
    default:
      return (
        <a
          href={preview.url || ''}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2.5 flex items-center gap-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
              {preview.name || 'file'}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">Click to download</p>
          </div>
          <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </a>
      );
  }
}

// ─── Status Chips ───────────────────────────────────────────────────────────

function StatusChip({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm"
      style={{
        backgroundColor: color ? `${color}18` : undefined,
        color: color || undefined,
        borderColor: color ? `${color}40` : undefined,
      }}
    >
      {label}
    </span>
  );
}

// ─── WhatsApp Event Card ────────────────────────────────────────────────────

const WhatsAppEventCard = React.memo(function WhatsAppEventCard({
  event,
}: {
  event: TimelineWhatsAppEvent;
}) {
  const isReceived = event.direction === 'in';

  return (
    <TimelineCard>
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              isReceived
                ? 'bg-emerald-50 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {isReceived ? 'WhatsApp Received' : 'WhatsApp Sent'}
          </div>
        </div>
        <CampaignBadge name={event.campaignName} />
      </div>

      {/* Sender name */}
      {event.senderName && (
        <div className="flex items-center gap-1.5 mb-2">
          <Phone className="w-3 h-3 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {event.senderName}
          </span>
        </div>
      )}

      {/* Message */}
      {event.message && (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3.5 py-2.5 mb-2 border border-gray-100 dark:border-gray-700/50">
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
            {event.message}
          </p>
        </div>
      )}

      {/* Media preview */}
      {event.mediaUrl && <MediaPreview event={event} />}

      {/* Timestamp */}
      <div className="flex items-center gap-1.5 mt-3 text-[11px] text-gray-400 dark:text-gray-500">
        <Clock className="w-3 h-3" />
        <span>{formatTimestamp(event.createdAt)}</span>
        <span className="text-gray-300 dark:text-gray-600">•</span>
        <span className={isReceived ? 'text-emerald-500' : 'text-blue-500'}>
          {isReceived ? 'Incoming' : 'Outgoing'}
        </span>
      </div>
    </TimelineCard>
  );
});

// ─── Status Change Event Card ──────────────────────────────────────────────

const StatusEventCard = React.memo(function StatusEventCard({
  event,
}: {
  event: TimelineStatusEvent;
}) {
  return (
    <TimelineCard>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/25 text-blue-700 dark:text-blue-300">
          <ArrowRight className="w-3.5 h-3.5" />
          Status Updated
        </div>
        <CampaignBadge name={event.campaignName} />
      </div>

      {/* Status transition */}
      <div className="flex items-center gap-2.5 mb-3">
        {event.oldStatus ? (
          <>
            <StatusChip label={event.oldStatus} />
            <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </>
        ) : null}
        <StatusChip label={event.newStatus} color="#3B82F6" />
      </div>

      {/* Remarks */}
      {event.remarks && (
        <div className="mb-2.5">
          <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
            Remarks
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-2 border border-gray-100 dark:border-gray-700/50 leading-relaxed">
            {event.remarks}
          </p>
        </div>
      )}

      {/* Next call date */}
      {event.nextCallDate && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-amber-600 dark:text-amber-400">
          <Clock className="w-3 h-3" />
          <span>Next call: {format(new Date(event.nextCallDate), 'MMM d, h:mm a')}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          By <span className="font-medium text-gray-700 dark:text-gray-300">{event.updatedBy}</span>
        </span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">{formatTimestamp(event.createdAt)}</span>
      </div>
    </TimelineCard>
  );
});

// ─── Other Campaign Event Card ──────────────────────────────────────────────

const OtherCampaignEventCard = React.memo(function OtherCampaignEventCard({
  event,
}: {
  event: TimelineOtherCampaignEvent;
}) {
  return (
    <TimelineCard borderColor="violet">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 dark:bg-violet-900/25 text-violet-700 dark:text-violet-300">
          <DatabaseIcon className="w-3.5 h-3.5" />
          Status Updated
        </div>
        <CampaignBadge name={event.campaignName} isOtherCampaign />
      </div>

      {/* Status */}
      <div className="mb-3">
        <StatusChip label={event.status} color="#8B5CF6" />
      </div>

      {/* Remarks */}
      {event.remarks && (
        <div className="mb-2.5">
          <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
            Remarks
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 bg-violet-50/50 dark:bg-violet-900/10 rounded-lg px-3 py-2 border border-violet-100 dark:border-violet-800/30 leading-relaxed">
            {event.remarks}
          </p>
        </div>
      )}

      {/* Lead info */}
      {event.leadName && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-gray-500 dark:text-gray-400">
          <Mail className="w-3 h-3" />
          <span>Lead: <span className="font-medium text-gray-700 dark:text-gray-300">{event.leadName}</span></span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          By <span className="font-medium text-gray-700 dark:text-gray-300">{event.updatedBy || 'System'}</span>
        </span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">{formatTimestamp(event.createdAt)}</span>
      </div>
    </TimelineCard>
  );
});

// ─── Database Icon helper (not in lucide standard set) ─────────────────────

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

// ─── Timestamp formatter ───────────────────────────────────────────────────

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isTodayDate = isToday(date);
  const isYesterdayDate = isYesterday(date);

  const time = format(date, 'h:mm a');

  if (isTodayDate) {
    return `Today ${time}`;
  }
  if (isYesterdayDate) {
    return `Yesterday ${time}`;
  }
  return format(date, 'MMM d, h:mm a');
}

// ─── Event Renderer ─────────────────────────────────────────────────────────

function renderEvent(event: TimelineEvent, index: number) {
  switch (event.kind) {
    case 'whatsapp':
      return <WhatsAppEventCard key={event.id} event={event} />;
    case 'status':
      return <StatusEventCard key={event.id} event={event} />;
    case 'other_campaign':
      return <OtherCampaignEventCard key={event.id} event={event} />;
  }
}

// ─── Empty State ───────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-5">
        <Clock className="w-7 h-7 text-gray-300 dark:text-gray-600" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
        No history found.
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
        Customer interactions, status changes and messages will appear here.
      </p>
    </motion.div>
  );
}

// ─── Load More Button ──────────────────────────────────────────────────────

function LoadMoreButton({ onClick, visible }: { onClick: () => void; visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="flex justify-center py-4">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all shadow-sm"
      >
        <ChevronDown className="w-4 h-4" />
        Load More
      </motion.button>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function LeadHistoryTimeline({
  events,
  loading = false,
  campaigns = [],
}: LeadHistoryTimelineProps) {
  // ── Filters ──────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<TimelineFilters>({
    eventType: 'all',
    campaignId: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  });

  // ── Pagination ───────────────────────────────────────────────────────────
  const [visibleCount, setVisibleCount] = useState(EVENTS_PER_PAGE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(EVENTS_PER_PAGE);
  }, [filters]);

  // ── Filtered Events ──────────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    let result = events;

    // Search filter
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      result = result.filter((ev) => {
        // Check common fields based on type
        if (ev.kind === 'whatsapp') {
          return (
            (ev.message?.toLowerCase().includes(q) ?? false) ||
            ev.campaignName.toLowerCase().includes(q) ||
            (ev.senderName?.toLowerCase().includes(q) ?? false)
          );
        }
        if (ev.kind === 'status') {
          return (
            (ev.remarks?.toLowerCase().includes(q) ?? false) ||
            ev.newStatus.toLowerCase().includes(q) ||
            ev.campaignName.toLowerCase().includes(q) ||
            (ev.updatedBy?.toLowerCase().includes(q) ?? false) ||
            (ev.oldStatus?.toLowerCase().includes(q) ?? false)
          );
        }
        if (ev.kind === 'other_campaign') {
          return (
            (ev.remarks?.toLowerCase().includes(q) ?? false) ||
            ev.status.toLowerCase().includes(q) ||
            ev.campaignName.toLowerCase().includes(q) ||
            (ev.updatedBy?.toLowerCase().includes(q) ?? false)
          );
        }
        return false;
      });
    }

    // Event type filter
    if (filters.eventType === 'whatsapp') {
      result = result.filter((ev) => ev.kind === 'whatsapp');
    } else if (filters.eventType === 'status') {
      result = result.filter((ev) => ev.kind === 'status' || ev.kind === 'other_campaign');
    } else if (filters.eventType === 'notes') {
      result = result.filter((ev) => {
        if (ev.kind === 'status') return !!ev.remarks;
        if (ev.kind === 'other_campaign') return !!ev.remarks;
        if (ev.kind === 'whatsapp') return !!ev.message;
        return false;
      });
    } else if (filters.eventType === 'attachments') {
      result = result.filter((ev) => {
        if (ev.kind === 'whatsapp') return !!ev.mediaUrl;
        return false;
      });
    }

    // Campaign filter
    if (filters.campaignId) {
      result = result.filter((ev) => ev.campaignId === filters.campaignId);
    }

    // Date range filter
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom + 'T00:00:00');
      result = result.filter((ev) => new Date(ev.createdAt) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo + 'T23:59:59');
      result = result.filter((ev) => new Date(ev.createdAt) <= to);
    }

    // Sort by timestamp descending (latest first)
    result = [...result].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return result;
  }, [events, filters]);

  // ── Date Groups ──────────────────────────────────────────────────────────
  const dateGroups = useMemo(
    () => groupEventsByDate(filteredEvents.slice(0, visibleCount)),
    [filteredEvents, visibleCount],
  );

  // ── Infinite Scroll (Intersection Observer) ──────────────────────────────
  const hasMore = visibleCount < filteredEvents.length;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount((prev) => Math.min(prev + EVENTS_PER_PAGE, filteredEvents.length));
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, filteredEvents.length]);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + EVENTS_PER_PAGE, filteredEvents.length));
  }, [filteredEvents.length]);

  // ── Unique campaigns from events for filter ──────────────────────────────
  const availableCampaigns = useMemo(() => {
    if (campaigns.length > 0) return campaigns;
    const map = new Map<string, string>();
    events.forEach((ev) => {
      if (ev.campaignId && !map.has(ev.campaignId)) {
        map.set(ev.campaignId, ev.campaignName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [events, campaigns]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <TimelineFilterBar
        filters={filters}
        onChange={setFilters}
        campaigns={availableCampaigns}
        totalEvents={filteredEvents.length}
      />

      {/* Timeline */}
      <div className="relative">
        {loading ? (
          <TimelineSkeleton />
        ) : filteredEvents.length === 0 && events.length === 0 ? (
          <EmptyState />
        ) : filteredEvents.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-1">
            {dateGroups.map((group) => (
              <div key={group.date}>
                <DateSeparator label={group.label} />
                <div className="relative">
                  {/* Vertical timeline line */}
                  <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-gray-200 via-gray-200/60 to-transparent dark:from-gray-700 dark:via-gray-700/60" />

                  <div className="space-y-4 pl-14">
                    {group.events.map((event, idx) => (
                      <div key={event.id} className="relative">
                        {/* Timeline dot */}
                        <div className="absolute -left-14 top-2">
                          <EventIcon event={event} isFirst={idx === 0} />
                        </div>
                        {renderEvent(event, idx)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className="h-4" />

            {/* Load More button (fallback) */}
            <LoadMoreButton onClick={handleLoadMore} visible={hasMore && dateGroups.length > 0} />
          </div>
        )}
      </div>
    </div>
  );
}
