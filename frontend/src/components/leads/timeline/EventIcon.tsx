import React from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  ArrowRightCircle,
  Database,
} from 'lucide-react';
import { TimelineEvent } from './types';

const iconMap = {
  whatsapp: MessageSquare,
  status: ArrowRightCircle,
  other_campaign: Database,
};

const colorMap = {
  whatsapp: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    ring: 'ring-emerald-500 dark:ring-emerald-400',
    icon: 'text-emerald-600 dark:text-emerald-300',
  },
  status: {
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    ring: 'ring-blue-500 dark:ring-blue-400',
    icon: 'text-blue-600 dark:text-blue-300',
  },
  other_campaign: {
    bg: 'bg-violet-100 dark:bg-violet-900/40',
    ring: 'ring-violet-500 dark:ring-violet-400',
    icon: 'text-violet-600 dark:text-violet-300',
  },
};

interface EventIconProps {
  event: TimelineEvent;
  isFirst?: boolean;
}

export default function EventIcon({ event, isFirst }: EventIconProps) {
  const Icon = iconMap[event.kind];
  const colors = colorMap[event.kind];

  return (
    <motion.div
      initial={false}
      animate={{ scale: isFirst ? [1, 1.2, 1] : 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`
        relative z-10 flex items-center justify-center
        w-10 h-10 rounded-full
        ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800
        ${colors.bg} ${colors.ring}
        flex-shrink-0
        shadow-sm
      `}
    >
      <Icon className={`w-4 h-4 ${colors.icon}`} strokeWidth={2} />
    </motion.div>
  );
}

// ─── Small variant for inline / compact use ─────────────────────────────────

export function SmallEventIcon({ kind }: { kind: TimelineEvent['kind'] }) {
  const Icon = iconMap[kind];
  const colors = colorMap[kind];

  return (
    <div
      className={`
        inline-flex items-center justify-center
        w-5 h-5 rounded-full
        ${colors.bg} ${colors.icon}
      `}
    >
      <Icon className="w-3 h-3" strokeWidth={2.5} />
    </div>
  );
}
