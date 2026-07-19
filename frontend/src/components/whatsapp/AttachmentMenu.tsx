import React from 'react';
import { Image, FileText, Music, X } from 'lucide-react';

export type AttachmentType = 'image' | 'document' | 'audio';

interface AttachmentMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: AttachmentType) => void;
}

const items: { type: AttachmentType; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { type: 'image', label: 'Image', icon: Image, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30' },
  { type: 'document', label: 'Document', icon: FileText, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  { type: 'audio', label: 'Audio', icon: Music, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
];

export default function AttachmentMenu({ isOpen, onClose, onSelect }: AttachmentMenuProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-gray-600 dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Attachments</h4>
        <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-gray-700">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              onClick={() => { onSelect(item.type); onClose(); }}
              className="flex flex-col items-center gap-1.5 rounded-xl p-2.5 transition-all hover:bg-slate-50 dark:hover:bg-gray-700/50"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${item.bg} transition-transform hover:scale-110`}>
                <Icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <span className="text-[10px] font-medium text-slate-600 dark:text-gray-300">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
