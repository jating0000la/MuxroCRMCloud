import React from 'react';
import { motion } from 'framer-motion';

interface TimelineCardProps {
  children: React.ReactNode;
  borderColor?: 'default' | 'violet';
  className?: string;
}

const borderStyles = {
  default: 'border-gray-200 dark:border-gray-700',
  violet: 'border-violet-200 dark:border-violet-800/60',
};

export default function TimelineCard({
  children,
  borderColor = 'default',
  className = '',
}: TimelineCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={{
        y: -2,
        boxShadow: '0 8px 25px rgba(0,0,0,0.06)',
        transition: { duration: 0.2 },
      }}
      className={`
        bg-white dark:bg-gray-800/80
        rounded-xl
        border
        ${borderStyles[borderColor]}
        p-4
        shadow-sm
        hover:shadow-md
        transition-shadow
        dark:shadow-gray-900/30
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
