import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../../services/whatsapp';
import { format } from 'date-fns';
import { Copy, Clock, Check, CheckCheck, XCircle, MoreVertical } from 'lucide-react';
import toast from 'react-hot-toast';

interface MessageBubbleProps {
  msg: ChatMessage;
}

function MessageStatusIcon({ status }: { status: string | null }) {
  const normalizedStatus = status?.trim().toLowerCase();

  if (!normalizedStatus || normalizedStatus === 'sending') {
    return <Clock className="h-3 w-3 text-slate-400 animate-pulse" />;
  }

  if (['sent', 'submitted', 'queued', 'accepted'].includes(normalizedStatus)) {
    return <Check className="h-3 w-3 text-slate-400" />;
  }

  if (['delivered', 'received'].includes(normalizedStatus)) {
    return <CheckCheck className="h-3 w-3 text-slate-400" />;
  }

  if (['read', 'seen'].includes(normalizedStatus)) {
    return <CheckCheck className="h-3 w-3 text-blue-500" />;
  }

  if (['failed', 'undelivered', 'error'].includes(normalizedStatus)) {
    return <XCircle className="h-3 w-3 text-red-500" />;
  }

  return null;
}

export default function MessageBubble({ msg }: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOut = msg.direction === 'out';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.message || '');
    toast.success('Copied to clipboard');
    setShowMenu(false);
  };

  return (
    <div className={`group mb-1.5 flex ${isOut ? 'justify-end' : 'justify-start'}`}>
      <div className="relative max-w-[65%]">
        <div
          className={`rounded-2xl px-3.5 py-2.5 shadow-sm ${
            isOut
              ? 'rounded-br-md bg-[#dcf8c6] text-slate-800 dark:bg-green-900/40 dark:text-slate-100'
              : 'rounded-bl-md bg-white text-slate-800 dark:bg-gray-800 dark:text-slate-100'
          }`}
        >
          {/* Sender name for incoming group messages */}
          {msg.name && !isOut && (
            <div className="mb-0.5 text-xs font-bold text-blue-600 dark:text-blue-400">
              {msg.name}
            </div>
          )}

          {/* Media content */}
          <div className="text-sm">
            {msg.type === 'image' && msg.mediaUrl && (
              <div className="mb-2 overflow-hidden rounded-xl">
                <img
                  src={msg.mediaUrl}
                  alt="Image"
                  className="max-h-64 w-full object-cover transition-transform hover:scale-[1.02]"
                  loading="lazy"
                />
              </div>
            )}
            {msg.type === 'video' && msg.mediaUrl && (
              <div className="mb-2 overflow-hidden rounded-xl">
                <video
                  src={msg.mediaUrl}
                  controls
                  className="max-h-64 w-full rounded-xl"
                  preload="metadata"
                />
              </div>
            )}
            {msg.type === 'audio' && msg.mediaUrl && (
              <div className="mb-1">
                <audio src={msg.mediaUrl} controls className="h-9 w-full" preload="metadata" />
              </div>
            )}
            {msg.type === 'file' && msg.mediaUrl && (
              <a
                href={msg.mediaUrl}
                target="_blank"
                rel="noreferrer"
                className="mb-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm text-blue-600 transition-colors hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-700 dark:text-blue-400 dark:hover:bg-gray-600"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                  📄
                </div>
                <span className="truncate font-medium">{msg.message || 'Download'}</span>
              </a>
            )}
            {msg.type === 'location' && (
              <div className="flex items-center gap-2">
                <span className="text-lg">📍</span>
                <span>{msg.message}</span>
              </div>
            )}
            {msg.type === 'template' && (
              <div className="flex items-center gap-2 rounded-lg bg-purple-50 px-2 py-1 dark:bg-purple-900/20">
                <span className="text-sm">📋</span>
                <span className="italic text-purple-600 dark:text-purple-400">{msg.message}</span>
              </div>
            )}
            {msg.type === 'text' && (
              <span className="whitespace-pre-wrap break-words">{msg.message}</span>
            )}
          </div>

          {/* Time + Status */}
          <div className="mt-1 flex items-center justify-end gap-1">
            <span className="text-[10px] text-slate-500/80 dark:text-gray-400/80">
              {format(new Date(msg.createdAt), 'h:mm a')}
            </span>
            {isOut && <MessageStatusIcon status={msg.status} />}
          </div>
        </div>

        {/* Hover action menu — right for received, left for sent */}
        <div ref={menuRef} className={`absolute top-0 z-10 ${isOut ? 'left-0' : 'right-0'}`}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            aria-label="Message options"
            className="hidden rounded-full p-1 text-slate-400 opacity-0 shadow-sm transition-all group-hover:inline-flex group-hover:opacity-100 hover:bg-white/90 hover:text-slate-600 dark:hover:bg-gray-800 dark:hover:text-slate-300"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {showMenu && (
            <div className={`absolute top-full z-50 mt-1 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-gray-600 dark:bg-gray-800 ${isOut ? 'left-0' : 'right-0'}`}>
              <MenuButton icon={<Copy className="h-3.5 w-3.5" />} label="Copy" onClick={handleCopy} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuButton({ icon, label, onClick, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs transition-colors ${
        danger
          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-slate-600 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
