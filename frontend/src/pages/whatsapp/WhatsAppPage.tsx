import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/layout/Layout';
import whatsappService, {
  ChatConversation,
  ChatMessage,
  WhatsAppStats,
  SendTextPayload,
} from '../../services/whatsapp';
import { format, isToday, isYesterday } from 'date-fns';
import toast from 'react-hot-toast';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'dd/MM/yy');
}

function formatMessageTime(dateStr: string): string {
  return format(new Date(dateStr), 'h:mm a');
}

function getLastMessagePreview(msg: string | null, type: string): string {
  if (!msg) return `📎 ${type}`;
  if (type === 'image') return `🖼️ Image${msg ? ': ' + msg : ''}`;
  if (type === 'video') return `🎬 Video${msg ? ': ' + msg : ''}`;
  if (type === 'audio') return `🎵 Audio`;
  if (type === 'file') return `📄 File${msg ? ': ' + msg : ''}`;
  if (type === 'location') return `📍 Location`;
  if (type === 'contact') return `👤 Contact`;
  if (type === 'template') return `📋 Template`;
  return msg.length > 60 ? msg.substring(0, 60) + '...' : msg;
}

// ─── Status Badge ───────────────────────────────────────────────────────────

function MessageStatusIcon({ status }: { status: string | null }) {
  if (!status) return null;
  if (status === 'sent') return <span className="text-slate-400">✓</span>;
  if (status === 'delivered') return <span className="text-slate-400">✓✓</span>;
  if (status === 'read') return <span className="text-blue-500">✓✓</span>;
  if (status === 'failed') return <span className="text-red-500">✗</span>;
  return <span className="text-slate-400">○</span>;
}

// ─── Type Selector Dropdown ─────────────────────────────────────────────────

type MsgType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'template';

const MSG_TYPES: { value: MsgType; label: string; icon: string }[] = [
  { value: 'text', label: 'Text', icon: '💬' },
  { value: 'image', label: 'Image', icon: '🖼️' },
  { value: 'video', label: 'Video', icon: '🎬' },
  { value: 'audio', label: 'Audio', icon: '🎵' },
  { value: 'file', label: 'File', icon: '📄' },
  { value: 'location', label: 'Location', icon: '📍' },
  { value: 'template', label: 'Template', icon: '📋' },
];

// ─── Main Component ─────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const { user } = useAuth();

  // Chat list state
  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [chatSearch, setChatSearch] = useState('');

  // Active chat state
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [activeName, setActiveName] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Stats
  const [stats, setStats] = useState<WhatsAppStats | null>(null);

  // Compose state
  const [msgType, setMsgType] = useState<MsgType>('text');
  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [templateParams, setTemplateParams] = useState('');
  const [sending, setSending] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);

  // ─── Load Chats ───────────────────────────────────────────────────────────

  const loadChats = useCallback(async () => {
    try {
      const [chatData, statsData] = await Promise.all([
        whatsappService.getChats(200, 0),
        whatsappService.getStats(),
      ]);
      setChats(chatData);
      setStats(statsData);
    } catch (err: any) {
      console.error('Failed to load chats', err);
      toast.error('Failed to load chats');
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
    // Auto-refresh chat list every 15s
    const interval = setInterval(loadChats, 15000);
    return () => clearInterval(interval);
  }, [loadChats]);

  // ─── Load Messages ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activePhone) return;
    setLoadingMessages(true);
    whatsappService
      .getChatMessages(activePhone, 100, 0)
      .then(setMessages)
      .catch(() => toast.error('Failed to load messages'))
      .finally(() => setLoadingMessages(false));
  }, [activePhone]);

  // ─── Auto-scroll messages ─────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Close type menu on outside click ─────────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node)) {
        setTypeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ─── Select Chat ──────────────────────────────────────────────────────────

  const selectChat = (chat: ChatConversation) => {
    setActivePhone(chat.phone);
    setActiveName(chat.name || chat.phone);
  };

  // ─── Send Message ─────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!activePhone) return;
    if (sending) return;

    setSending(true);
    try {
      switch (msgType) {
        case 'text': {
          if (!text.trim()) { toast.error('Enter a message'); return; }
          await whatsappService.sendText({ phone: activePhone, text: text.trim() });
          break;
        }
        case 'image': {
          if (!mediaUrl.trim()) { toast.error('Enter image URL'); return; }
          await whatsappService.sendImage({ phone: activePhone, url: mediaUrl.trim(), caption: caption.trim() || undefined });
          break;
        }
        case 'video': {
          if (!mediaUrl.trim()) { toast.error('Enter video URL'); return; }
          await whatsappService.sendVideo({ phone: activePhone, url: mediaUrl.trim(), caption: caption.trim() || undefined });
          break;
        }
        case 'audio': {
          if (!mediaUrl.trim()) { toast.error('Enter audio URL'); return; }
          await whatsappService.sendAudio({ phone: activePhone, url: mediaUrl.trim() });
          break;
        }
        case 'file': {
          if (!mediaUrl.trim()) { toast.error('Enter file URL'); return; }
          await whatsappService.sendFile({ phone: activePhone, url: mediaUrl.trim(), filename: caption.trim() || 'file' });
          break;
        }
        case 'location': {
          const lat = parseFloat(text.split(',')[0]);
          const lng = parseFloat(text.split(',')[1]);
          if (isNaN(lat) || isNaN(lng)) { toast.error('Enter lat,lng (e.g. 28.6139,77.2090)'); return; }
          await whatsappService.sendLocation({ phone: activePhone, latitude: lat, longitude: lng, name: locationName || undefined, address: locationAddress || undefined });
          break;
        }
        case 'template': {
          if (!templateId.trim()) { toast.error('Enter template ID'); return; }
          const params = templateParams.split(',').map((p) => p.trim()).filter(Boolean);
          await whatsappService.sendTemplate({ phone: activePhone, templateId: templateId.trim(), templateParams: params.length ? params : undefined });
          break;
        }
      }

      // Reset compose fields
      setText('');
      setMediaUrl('');
      setCaption('');
      setLocationName('');
      setLocationAddress('');
      setTemplateId('');
      setTemplateParams('');

      // Reload messages
      const updated = await whatsappService.getChatMessages(activePhone, 100, 0);
      setMessages(updated);
      await loadChats();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  // ─── Key handler ──────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Filter chats ─────────────────────────────────────────────────────────

  const filteredChats = chats.filter((chat) => {
    if (!chatSearch) return true;
    const q = chatSearch.toLowerCase();
    return (
      chat.phone.includes(q) ||
      (chat.name && chat.name.toLowerCase().includes(q))
    );
  });

  // ─── Compose Form ─────────────────────────────────────────────────────────

  const renderComposeForm = () => {
    switch (msgType) {
      case 'text':
        return (
          <textarea
            ref={textInputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-slate-200"
            rows={1}
          />
        );
      case 'image':
      case 'video':
      case 'audio':
      case 'file':
        return (
          <div className="flex flex-1 flex-col gap-1.5">
            <input
              type="text"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="Media URL..."
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-slate-200"
            />
            {(msgType === 'image' || msgType === 'video') && (
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Caption (optional)..."
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-slate-200"
              />
            )}
            {msgType === 'file' && (
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Filename..."
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-slate-200"
              />
            )}
          </div>
        );
      case 'location':
        return (
          <div className="flex flex-1 flex-col gap-1.5">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Latitude, Longitude (e.g. 28.6139,77.2090)"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-slate-200"
            />
            <div className="flex gap-1.5">
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Name (optional)"
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-slate-200"
              />
              <input
                type="text"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                placeholder="Address (optional)"
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-slate-200"
              />
            </div>
          </div>
        );
      case 'template':
        return (
          <div className="flex flex-1 flex-col gap-1.5">
            <input
              type="text"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              placeholder="Template ID / Name..."
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-slate-200"
            />
            <input
              type="text"
              value={templateParams}
              onChange={(e) => setTemplateParams(e.target.value)}
              placeholder="Params (comma-separated: param1,param2,...)"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-slate-200"
            />
          </div>
        );
      default:
        return null;
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {/* ─── Sidebar: Chat List ─────────────────────────────────────────── */}
        <div className="flex w-80 flex-col border-r border-slate-200 dark:border-gray-700">
          {/* Header + Stats */}
          <div className="border-b border-slate-200 px-4 py-3 dark:border-gray-700">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">💬 WhatsApp</h2>
              {user?.role === 'ADMIN' && (
                <button
                  onClick={async () => {
                    try {
                      await whatsappService.syncTemplates();
                      toast.success('Templates synced');
                    } catch {
                      toast.error('Sync failed');
                    }
                  }}
                  className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400"
                >
                  Sync Templates
                </button>
              )}
            </div>
            {stats && (
              <div className="flex gap-3 text-xs text-slate-500 dark:text-gray-400">
                <span>{stats.totalMessages} msgs</span>
                <span className="text-green-500">↑{stats.incomingMessages}</span>
                <span className="text-blue-500">↓{stats.outgoingMessages}</span>
                <span>{stats.uniqueChats} chats</span>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="px-3 py-2">
            <input
              type="text"
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              placeholder="Search chats..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-slate-200"
            />
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {loadingChats ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400 dark:text-gray-500">
                {chatSearch ? 'No matching chats' : 'No conversations yet'}
              </div>
            ) : (
              filteredChats.map((chat) => (
                <button
                  key={chat.phone}
                  onClick={() => selectChat(chat)}
                  className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-primary-50 dark:border-gray-800 dark:hover:bg-gray-800/50 ${
                    activePhone === chat.phone ? 'bg-primary-50 dark:bg-gray-800/50' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-lg dark:bg-green-900/30">
                    {chat.name ? chat.name.charAt(0).toUpperCase() : '👤'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {chat.name || chat.phone}
                      </span>
                      <span className="ml-2 flex-shrink-0 text-[10px] text-slate-400 dark:text-gray-500">
                        {chat.lastMessageAt ? formatTime(chat.lastMessageAt) : ''}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between">
                      <span className="truncate text-xs text-slate-500 dark:text-gray-400">
                        {chat.lastDirection === 'out' && <span className="mr-1 text-blue-500">↓</span>}
                        {chat.lastDirection === 'in' && <span className="mr-1 text-green-500">↑</span>}
                        {getLastMessagePreview(chat.lastMessage, chat.lastMessageType)}
                      </span>
                      {chat.unreadCount > 0 && (
                        <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white">
                          {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ─── Main: Chat View ────────────────────────────────────────────── */}
        {!activePhone ? (
          <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 dark:bg-gray-900">
            <div className="text-6xl">💬</div>
            <p className="mt-4 text-lg font-semibold text-slate-500 dark:text-gray-400">Select a chat</p>
            <p className="text-sm text-slate-400 dark:text-gray-500">Choose a conversation from the left panel</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  {activeName ? activeName.charAt(0).toUpperCase() : '👤'}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{activeName}</div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">{activePhone}</div>
                </div>
              </div>
              <button
                onClick={() => { setActivePhone(null); setActiveName(''); setMessages([]); }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                ✕ Close
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-[#e5ddd5] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9InAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgwLDAsMCwwLjAzKSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNwKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] px-4 py-3 dark:bg-gray-900">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                </div>
              ) : messages.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">No messages yet</div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`mb-1.5 flex ${msg.direction === 'out' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${
                        msg.direction === 'out'
                          ? 'bg-[#dcf8c6] text-slate-800 dark:bg-green-900/40 dark:text-slate-100'
                          : 'bg-white text-slate-800 dark:bg-gray-800 dark:text-slate-100'
                      }`}
                    >
                      {msg.name && msg.direction === 'in' && (
                        <div className="mb-0.5 text-xs font-bold text-blue-600 dark:text-blue-400">{msg.name}</div>
                      )}
                      <div className="text-sm">
                        {msg.type === 'image' && msg.mediaUrl && (
                          <img src={msg.mediaUrl} alt="img" className="mb-1 max-h-48 rounded" />
                        )}
                        {msg.type === 'video' && msg.mediaUrl && (
                          <video src={msg.mediaUrl} controls className="mb-1 max-h-48 rounded" />
                        )}
                        {msg.type === 'audio' && msg.mediaUrl && (
                          <audio src={msg.mediaUrl} controls className="mb-1" />
                        )}
                        {msg.type === 'file' && msg.mediaUrl && (
                          <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="mb-1 block text-blue-600 underline dark:text-blue-400">
                            📎 {msg.message || 'Download'}
                          </a>
                        )}
                        {msg.type === 'location' ? (
                          <span>📍 {msg.message}</span>
                        ) : msg.type === 'template' ? (
                          <span className="italic">📋 {msg.message}</span>
                        ) : (
                          <span className="whitespace-pre-wrap break-words">{msg.message}</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-slate-500 dark:text-gray-400">
                        <span>{formatMessageTime(msg.createdAt)}</span>
                        {msg.direction === 'out' && <MessageStatusIcon status={msg.status} />}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose Bar */}
            <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
              {/* Type selector row */}
              <div className="mb-2 flex items-center gap-2">
                <div className="relative" ref={typeMenuRef}>
                  <button
                    onClick={() => setTypeMenuOpen(!typeMenuOpen)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-gray-600 dark:bg-gray-800 dark:text-slate-300"
                  >
                    <span>{MSG_TYPES.find((t) => t.value === msgType)?.icon}</span>
                    <span>{MSG_TYPES.find((t) => t.value === msgType)?.label}</span>
                    <span className="text-[10px]">▼</span>
                  </button>
                  {typeMenuOpen && (
                    <div className="absolute bottom-full left-0 z-50 mb-1 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
                      {MSG_TYPES.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => { setMsgType(t.value); setTypeMenuOpen(false); }}
                          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-primary-50 dark:hover:bg-gray-700 ${
                            msgType === t.value ? 'bg-primary-50 font-semibold text-primary-700 dark:bg-gray-700 dark:text-primary-400' : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <span>{t.icon}</span>
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 dark:text-gray-500">
                  {msgType === 'text' && 'Enter to send, Shift+Enter for newline'}
                  {msgType === 'location' && 'Format: lat,lng'}
                  {msgType === 'template' && 'Template ID + comma-separated params'}
                </span>
              </div>

              {/* Input + Send */}
              <div className="flex items-end gap-2">
                {renderComposeForm()}
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white shadow-md transition-colors hover:bg-green-600 disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-700"
                >
                  {sending ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
