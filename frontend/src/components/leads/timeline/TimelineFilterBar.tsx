import React from 'react';
import { Search, Filter } from 'lucide-react';
import { TimelineFilters, EventTypeFilter, CampaignOption } from './types';

interface TimelineFilterBarProps {
  filters: TimelineFilters;
  onChange: (filters: TimelineFilters) => void;
  campaigns: CampaignOption[];
  totalEvents: number;
}

const eventTypeOptions: { value: EventTypeFilter; label: string }[] = [
  { value: 'all', label: 'All Events' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'status', label: 'Status' },
  { value: 'notes', label: 'Notes' },
  { value: 'attachments', label: 'Attachments' },
];

export default function TimelineFilterBar({
  filters,
  onChange,
  campaigns,
  totalEvents,
}: TimelineFilterBarProps) {
  const update = (partial: Partial<TimelineFilters>) => {
    onChange({ ...filters, ...partial });
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search history by message, remarks, user or campaign..."
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Event Type Filter */}
        <div className="relative">
          <select
            value={filters.eventType}
            onChange={(e) => update({ eventType: e.target.value as EventTypeFilter })}
            className="appearance-none px-3 py-1.5 pr-8 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer hover:border-gray-300 dark:hover:border-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {eventTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Filter className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        {/* Campaign Filter */}
        <select
          value={filters.campaignId}
          onChange={(e) => update({ campaignId: e.target.value })}
          className="px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer hover:border-gray-300 dark:hover:border-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">All Campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Date Range */}
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => update({ dateFrom: e.target.value })}
          className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="From"
          title="From date"
        />
        <span className="text-xs text-gray-400">—</span>
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => update({ dateTo: e.target.value })}
          className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="To"
          title="To date"
        />

        {/* Event count */}
        <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
          {totalEvents} event{totalEvents !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
