import React from 'react';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';

interface DateSeparatorProps {
  date: string;
}

export default function DateSeparator({ date }: DateSeparatorProps) {
  const d = new Date(date);
  let label: string;
  if (isToday(d)) label = 'Today';
  else if (isYesterday(d)) label = 'Yesterday';
  else if (isThisWeek(d)) label = format(d, 'EEEE');
  else label = format(d, 'dd MMM yyyy');

  return (
    <div className="my-3 flex items-center justify-center">
      <div className="rounded-full bg-white/90 px-4 py-1 text-xs font-medium text-slate-500 shadow-sm backdrop-blur-sm dark:bg-gray-800/90 dark:text-gray-400">
        {label}
      </div>
    </div>
  );
}
