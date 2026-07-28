import React from 'react';
import { Info, X } from 'lucide-react';

interface ChatHeaderProps {
  name: string;
  phone: string;
  leadStatus?: string;
  campaign?: string;
  onOpenInfo: () => void;
  infoOpen: boolean;
  onCall?: () => void;
  onSearch?: () => void;
  onClose: () => void;
}

export default function ChatHeader({
  name,
  phone,
  leadStatus,
  campaign,
  onOpenInfo,
  infoOpen,
  onCall,
  onSearch,
  onClose,
}: ChatHeaderProps) {
  const initials = name ? name.charAt(0).toUpperCase() : '👤';

  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 dark:border-gray-700 dark:bg-gray-900">
      {/* Left: Avatar + Info */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-sm font-bold text-white shadow-sm">
          {initials}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{name}</span>
            {leadStatus && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                {leadStatus}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-gray-400">{phone}</span>
            {campaign && (
              <>
                <span className="text-slate-300 dark:text-gray-600">·</span>
                <span className="text-xs text-primary-500 dark:text-primary-400">{campaign}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Action buttons */}
      <div className="flex items-center gap-1">
        <ActionButton
          icon={<Info className="h-4 w-4" />}
          onClick={onOpenInfo}
          active={infoOpen}
          tooltip="Contact Info"
        />
        <ActionButton icon={<X className="h-4 w-4" />} onClick={onClose} tooltip="Close" />
      </div>
    </div>
  );
}

function ActionButton({ icon, onClick, active, tooltip }: { icon: React.ReactNode; onClick?: () => void; active?: boolean; tooltip: string }) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      aria-label={tooltip}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
        active
          ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-gray-400 dark:hover:bg-gray-800'
      }`}
    >
      {icon}
    </button>
  );
}
