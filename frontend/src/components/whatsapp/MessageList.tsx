import React, { useRef, useEffect, useMemo } from 'react';
import { ChatMessage } from '../../services/whatsapp';
import MessageBubble from './MessageBubble';
import DateSeparator from './DateSeparator';
import { format, isToday, isYesterday, isThisWeek, isSameDay } from 'date-fns';
import { ArrowDown, MessageCircle } from 'lucide-react';

interface MessageListProps {
  messages: ChatMessage[];
  loading: boolean;
}

export default function MessageList({ messages, loading }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = React.useState(false);

  // Auto-scroll on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Detect scroll position for "scroll to bottom" button
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 200);
  };

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    let currentDate = '';
    messages.forEach((msg) => {
      const msgDate = new Date(msg.createdAt).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msg.createdAt, messages: [] });
      }
      groups[groups.length - 1].messages.push(msg);
    });
    return groups;
  }, [messages]);

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto bg-[#efeae2] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9InAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgwLDAsMCwwLjAzKSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNwKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] px-4 py-3 dark:bg-gray-900"
        style={{ backgroundImage: 'none' }}
      >
        {/* WhatsApp dot pattern for light mode */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }} />

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary-500 border-t-transparent" />
              <span className="text-xs text-slate-500 dark:text-gray-400">Loading messages...</span>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/80 shadow-sm dark:bg-gray-800/80">
              <MessageCircle className="h-8 w-8 text-slate-300 dark:text-gray-600" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-500 dark:text-gray-400">No messages yet</p>
            <p className="text-xs text-slate-400 dark:text-gray-500">Send a message to start the conversation</p>
          </div>
        ) : (
          <div className="relative z-10">
            {groupedMessages.map((group, gi) => (
              <React.Fragment key={gi}>
                <DateSeparator date={group.date} />
                {group.messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
              </React.Fragment>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Scroll to bottom FAB */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg transition-all hover:scale-110 hover:shadow-xl dark:bg-gray-800"
        >
          <ArrowDown className="h-5 w-5 text-slate-600 dark:text-gray-300" />
        </button>
      )}
    </div>
  );
}
