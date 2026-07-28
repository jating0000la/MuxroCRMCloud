import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/layout/Layout';
import whatsappService, {
  ChatConversation,
  ChatMessage,
  WhatsAppStats,
} from '../../services/whatsapp';
import toast from 'react-hot-toast';

// New components
import ChatSidebar from '../../components/whatsapp/ChatSidebar';
import ChatHeader from '../../components/whatsapp/ChatHeader';
import MessageList from '../../components/whatsapp/MessageList';
import ComposeBar from '../../components/whatsapp/ComposeBar';
import CRMInfoPanel from '../../components/whatsapp/CRMInfoPanel';
import EmptyState from '../../components/whatsapp/EmptyState';
import { AttachmentType } from '../../components/whatsapp/AttachmentMenu';

// ─── Main Component ─────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  // Chat list state
  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [stats, setStats] = useState<WhatsAppStats | null>(null);

  // Active chat state
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [activeName, setActiveName] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  // UI state
  const [infoOpen, setInfoOpen] = useState(false);

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
    const interval = setInterval(loadChats, 15000);
    return () => clearInterval(interval);
  }, [loadChats]);

  // ─── Load Messages ────────────────────────────────────────────────────────

  const loadMessages = useCallback(async (phone: string) => {
    try {
      const data = await whatsappService.getChatMessages(phone, 100, 0);
      setMessages(data);
    } catch {
      toast.error('Failed to load messages');
    }
  }, []);

  useEffect(() => {
    if (!activePhone) return;
    setLoadingMessages(true);
    whatsappService
      .getChatMessages(activePhone, 100, 0)
      .then(setMessages)
      .catch(() => toast.error('Failed to load messages'))
      .finally(() => setLoadingMessages(false));

    // Poll for new messages every 10s while chat is active
    const interval = setInterval(() => {
      loadMessages(activePhone);
    }, 10000);
    return () => {
      clearInterval(interval);
    };
  }, [activePhone, loadMessages]);

  // ─── Select Chat ──────────────────────────────────────────────────────────

  const selectChat = (chat: ChatConversation) => {
    setActivePhone(chat.phone);
    setActiveName(chat.name || chat.phone);
  };

  // ─── Close Chat ───────────────────────────────────────────────────────────

  const closeChat = () => {
    setActivePhone(null);
    setActiveName('');
    setMessages([]);
    setInfoOpen(false);
  };

  // ─── Send Text ────────────────────────────────────────────────────────────

  const handleSendText = async (text: string) => {
    if (!activePhone) return;
    setSending(true);
    try {
      await whatsappService.sendText({ phone: activePhone, text });
      await loadMessages(activePhone);
      await loadChats();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  // ─── Send Media ───────────────────────────────────────────────────────────

  const handleSendMedia = async (type: AttachmentType, url: string, caption?: string) => {
    if (!activePhone) return;
    setSending(true);
    try {
      switch (type) {
        case 'image':
          await whatsappService.sendImage({ phone: activePhone, url, caption });
          break;
        case 'audio':
          await whatsappService.sendAudio({ phone: activePhone, url });
          break;
        case 'document':
          await whatsappService.sendFile({ phone: activePhone, url, filename: caption || 'file' });
          break;
        default:
          toast.error('Unsupported attachment type');
          return;
      }
      await loadMessages(activePhone);
      await loadChats();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  // ─── Get active chat data ─────────────────────────────────────────────────

  const activeChat = chats.find((c) => c.phone === activePhone);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Layout fullHeight>
      <div className="flex h-full min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
        {/* ─── Left Sidebar: Chat List ──────────────────────────────────── */}
        <div className="w-80 min-h-0 flex-shrink-0">
          <ChatSidebar
            chats={chats}
            stats={stats}
            loading={loadingChats}
            activePhone={activePhone}
            onSelectChat={selectChat}
            onRefresh={loadChats}
          />
        </div>

        {/* ─── Center: Chat View ────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden min-w-0">
          {!activePhone ? (
            <EmptyState />
          ) : (
            <>
              {/* Chat Header */}
              <ChatHeader
                name={activeName}
                phone={activePhone}
                onOpenInfo={() => setInfoOpen(!infoOpen)}
                infoOpen={infoOpen}
                onClose={closeChat}
              />

              {/* Messages */}
              <MessageList
                messages={messages}
                loading={loadingMessages}
              />

              {/* Compose Bar */}
              <ComposeBar
                sending={sending}
                onSendText={handleSendText}
                onSendMedia={handleSendMedia}
              />
            </>
          )}
        </div>

        {/* ─── Right Sidebar: CRM Info Panel ──────────────────────────────
        {infoOpen && activeChat && activePhone && (
          <div className="w-80 flex-shrink-0">
            <CRMInfoPanel
              chat={activeChat}
              messages={messages}
              onClose={() => setInfoOpen(false)}
            />
          </div>
        )} */}
      </div>
    </Layout>
  );
}
