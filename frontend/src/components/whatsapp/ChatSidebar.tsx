import React, { useState, useMemo } from 'react';
import { ChatConversation, WhatsAppStats } from '../../services/whatsapp';
import ChatCard from './ChatCard';
import { Search, RefreshCw, MessageCircle, Users } from 'lucide-react';

interface ChatSidebarProps {
  chats: ChatConversation[];
  stats: WhatsAppStats | null;
  loading: boolean;
  activePhone: string | null;
  onSelectChat: (chat: ChatConversation) => void;
  onRefresh: () => void;
}

export default function ChatSidebar({
  chats,
  stats,
  loading,
  activePhone,
  onSelectChat,
  onRefresh,
}: ChatSidebarProps) {
  const [search, setSearch] = useState('');
 

  // Filter and search chats
  const filteredChats = useMemo(() => {
    let result = chats;

    // Apply search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (chat) =>
          chat.phone.includes(q) ||
          (chat.name && chat.name.toLowerCase().includes(q))
      );
    }

    // Apply filter
    

    return result;
  }, [chats, search]);

  return (
    <div className="flex h-full w-full flex-col border-r border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-slate-100 px-4 py-3 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 shadow-sm shadow-green-500/20">
              <MessageCircle className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">WhatsApp</h2>
              <p className="text-[10px] text-slate-500 dark:text-gray-400">
                {stats ? `${stats.uniqueChats} active conversations` : 'Loading...'}
              </p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-gray-500 dark:hover:bg-gray-800"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>


      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-700 placeholder-slate-400 transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-slate-200 dark:placeholder-gray-500 dark:focus:border-primary-500 dark:focus:bg-gray-800"
          />
        </div>
      </div>

    

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-3 p-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-gray-800">
                <div className="h-11 w-11 rounded-full bg-slate-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-gray-700" />
                  <div className="h-2.5 w-3/4 rounded bg-slate-200 dark:bg-gray-700" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-gray-800">
              <Users className="h-6 w-6 text-slate-300 dark:text-gray-600" />
            </div>
            <p className="mt-3 text-xs font-medium text-slate-500 dark:text-gray-400">
              {search ? 'No matching conversations' : 'No conversations yet'}
            </p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-gray-500">
              {search ? 'Try a different search term' : 'Conversations will appear here'}
            </p>
          </div>
        ) : (
          <div>
            {filteredChats.map((chat) => (
              <ChatCard
                key={chat.phone}
                chat={chat}
                isActive={activePhone === chat.phone}
                onClick={() => onSelectChat(chat)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
