import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/layout/Layout';
import { useRef } from 'react';
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
  const activePhoneRef = useRef<string | null>(null);
  const chatsRequest = useRef(0);
  const messagesRequest = useRef(0);
  const [deleting, setDeleting] = useState(false);

  // UI state
  const [infoOpen, setInfoOpen] = useState(false);

  // ─── Load Chats ───────────────────────────────────────────────────────────

  const loadChats = useCallback(async () => {
    const request = ++chatsRequest.current;
    try {
      const [chatData, statsData] = await Promise.all([
        whatsappService.getChats(200, 0),
        whatsappService.getStats(),
      ]);
      if (request === chatsRequest.current) {
        setChats(chatData);
        setStats(statsData);
      }
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
    const request = ++messagesRequest.current;
    try {
      const data = await whatsappService.getChatMessages(phone, 100, 0);
      if (activePhoneRef.current !== phone || request !== messagesRequest.current) return;
      setMessages(data);
      const last = data[data.length - 1];
      if (last && !document.hidden) {
        await whatsappService.markRead(phone, last.id);
        if (activePhoneRef.current === phone && request === messagesRequest.current) {
          ++chatsRequest.current;
          setChats(current => current.map(chat => chat.phone === phone ? { ...chat, unreadCount: 0 } : chat));
        }
      }
    } catch {
      toast.error('Failed to load messages');
    }
  }, []);

  useEffect(() => {
    if (!activePhone) return;
    setLoadingMessages(true);
    loadMessages(activePhone).finally(() => {
      if (activePhoneRef.current === activePhone) setLoadingMessages(false);
    });

    // Poll for new messages every 10s while chat is active
    const interval = setInterval(() => {
      if (!document.hidden) loadMessages(activePhone);
    }, 10000);
    return () => {
      clearInterval(interval);
    };
  }, [activePhone, loadMessages]);

  // ─── Select Chat ──────────────────────────────────────────────────────────

  const selectChat = (chat: ChatConversation) => {
    activePhoneRef.current = chat.phone;
    setMessages([]);
    setActivePhone(chat.phone);
    setActiveName(chat.name || chat.phone);
  };

  // ─── Close Chat ───────────────────────────────────────────────────────────

  const closeChat = () => {
    activePhoneRef.current = null;
    ++messagesRequest.current;
    setActivePhone(null);
    setActiveName('');
    setMessages([]);
    setInfoOpen(false);
  };

  // ─── Send Text ────────────────────────────────────────────────────────────

  const handleDeleteChat = async () => {
    if (!activePhone || deleting || sending) return;
    if (!window.confirm('Delete this chat history from CRM? Customer WhatsApp messages and the linked lead are kept.')) return;
    const phone = activePhone;
    setDeleting(true);
    try {
      await whatsappService.deleteChat(phone);
      ++chatsRequest.current;
      if (activePhoneRef.current === phone) closeChat();
      setChats(current => current.filter(chat => chat.phone !== phone));
      await loadChats();
      toast.success('Chat deleted');
    } catch { toast.error('Could not delete chat. Please try again.'); }
    finally { setDeleting(false); }
  };

  const handleSendAttachment = async (file: File, caption: string) => {
    if (!activePhone || sending) return;
    const phone = activePhone;
    setSending(true);
    try {
      const uploaded = await whatsappService.uploadAttachment(file);
      await whatsappService.sendText({
        phone, text: [caption, uploaded.filename, uploaded.url, 'Download available for 24 hours.'].filter(Boolean).join('\n'),
      });
      await loadMessages(phone);
      await loadChats();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'File could not be sent.');
      throw error;
    } finally { setSending(false); }
  };

  const handleSendText = async (text: string) => {
    if (!activePhone) return;
    setSending(true);
    try {
      await whatsappService.sendText({ phone: activePhone, text });
      await loadMessages(activePhone);
      await loadChats();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Send failed');
      throw err;
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
      throw err;
    } finally {
      setSending(false);
    }
  };

  // ─── Get active chat data ─────────────────────────────────────────────────

  const activeChat = chats.find((c) => c.phone === activePhone);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Layout fullHeight>
      <div className="relative flex h-full min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
        {/* ─── Left Sidebar: Chat List ──────────────────────────────────── */}
        <div className={`${activePhone ? 'hidden md:block' : 'block'} w-full md:w-80 min-h-0 flex-shrink-0`}>
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
        <div className={`${activePhone ? 'flex' : 'hidden md:flex'} min-h-0 flex-1 flex-col overflow-hidden min-w-0`}>
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
                onDelete={handleDeleteChat}
              />

              {/* Messages */}
              <MessageList
                messages={messages}
                loading={loadingMessages}
              />

              {/* Compose Bar */}
              <ComposeBar
                key={activePhone}
                sending={sending || deleting}
                onSendText={handleSendText}
                onSendMedia={handleSendMedia}
                onSendAttachment={handleSendAttachment}
              />
            </>
          )}
        </div>

        {/* Contact information */}
        {infoOpen && activeChat && activePhone && (
          <div className="absolute inset-0 z-20 w-full lg:static lg:z-auto lg:w-80 flex-shrink-0">
            <CRMInfoPanel
              chat={activeChat}
              messages={messages}
              onClose={() => setInfoOpen(false)}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}
