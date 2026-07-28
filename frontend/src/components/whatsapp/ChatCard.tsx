import React, { memo } from 'react';
import { ChatConversation } from '../../services/whatsapp';
import { format, isToday, isYesterday } from 'date-fns';

interface ChatCardProps {
  chat: ChatConversation;
  isActive: boolean;
  onClick: () => void;
}

function formatChatTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'dd/MM/yy');
}

function getLastMessagePreview(msg: string | null, type: string): string {
  if (!msg) return `📎 ${type}`;
  if (type === 'image') return `🖼️ Image${msg ? ': ' + msg : ''}`;
  if (type === 'video') return `🎬 Video${msg ? ': ' + msg : ''}`;
  if (type === 'audio') return '🎵 Audio';
  if (type === 'file') return `📄 File${msg ? ': ' + msg : ''}`;
  if (type === 'location') return '📍 Location';
  if (type === 'contact') return '👤 Contact';
  if (type === 'template') return '📋 Template';
  return msg.length > 50 ? msg.substring(0, 50) + '...' : msg;
}

function getAvatarColor(name: string | null): string {
  if (!name) return 'bg-gradient-to-br from-gray-400 to-gray-500';
  const colors = [
    'from-emerald-400 to-green-500',
    'from-blue-400 to-indigo-500',
    'from-violet-400 to-purple-500',
    'from-amber-400 to-orange-500',
    'from-rose-400 to-pink-500',
    'from-cyan-400 to-teal-500',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return `bg-gradient-to-br ${colors[idx]}`;
}

const ChatCard = memo(function ChatCard({ chat, isActive, onClick }: ChatCardProps) {
  const displayName = chat.name || chat.phone;
  const initials = chat.name ? chat.name.charAt(0).toUpperCase() : '👤';
  const hasUnread = chat.unreadCount > 0;

  return (
    <button
      onClick={onClick}
      aria-current={isActive ? 'true' : undefined}
      className={`group flex w-full items-center gap-3 border-b border-slate-100/80 px-3 py-3 text-left transition-all duration-150 hover:bg-primary-50/60 dark:border-gray-800/60 dark:hover:bg-gray-800/40 ${
        isActive
          ? 'bg-primary-50 dark:bg-gray-800/50'
          : ''
      }`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-sm ${getAvatarColor(chat.name)}`}>
          {chat.name ? initials : '👤'}
        </div>
        {/* Online indicator placeholder */}
        {hasUnread && (
          <div className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white dark:border-gray-900">
            <div className="h-full w-full rounded-full bg-green-500" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate text-sm ${hasUnread ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-200'}`}>
            {displayName}
          </span>
          <span className={`flex-shrink-0 text-[10px] ${hasUnread ? 'font-semibold text-primary-500' : 'text-slate-400 dark:text-gray-500'}`}>
            {chat.lastMessageAt ? formatChatTime(chat.lastMessageAt) : ''}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-gray-400">
              {chat.lastDirection === 'out' && (
                <svg className="h-3 w-3 flex-shrink-0 text-blue-500" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 12l-4-4h3V4h2v4h3l-4 4z" transform="rotate(-90 8 8)" />
                </svg>
              )}
              {chat.lastDirection === 'in' && (
                <svg className="h-3 w-3 flex-shrink-0 text-green-500" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 4l4 4h-3v4H7V8H4l4-4z" transform="rotate(-90 8 8)" />
                </svg>
              )}
              <span className="truncate">{getLastMessagePreview(chat.lastMessage, chat.lastMessageType)}</span>
            </span>
          </div>
          {hasUnread && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white shadow-sm">
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </span>
          )}
        </div>
        {/* Phone number small */}
        <div className="mt-0.5">
          <span className="text-[10px] text-slate-400 dark:text-gray-600">{chat.phone}</span>
        </div>
      </div>
    </button>
  );
});

export default ChatCard;
