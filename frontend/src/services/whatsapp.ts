import api from './api';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ChatConversation {
  phone: string;
  name: string | null;
  lastMessage: string | null;
  lastMessageType: string;
  lastDirection: 'in' | 'out';
  lastMessageAt: string;
  unreadCount: number;
  totalMessages: number;
}

export interface ChatMessage {
  id: string;
  phone: string;
  name: string | null;
  direction: 'in' | 'out';
  message: string | null;
  type: string;
  mediaUrl: string | null;
  messageId: string | null;
  status: string | null;
  leadId: string | null;
  campaignId: string | null;
  userId: string | null;
  createdAt: string;
}

export interface WhatsAppStats {
  totalMessages: number;
  incomingMessages: number;
  outgoingMessages: number;
  uniqueChats: number;
}

export interface SendTextPayload {
  phone: string;
  text: string;
  previewUrl?: boolean;
  leadId?: string;
  campaignId?: string;
}

export interface SendImagePayload {
  phone: string;
  url: string;
  caption?: string;
  leadId?: string;
  campaignId?: string;
}

export interface SendVideoPayload {
  phone: string;
  url: string;
  caption?: string;
  leadId?: string;
  campaignId?: string;
}

export interface SendAudioPayload {
  phone: string;
  url: string;
  leadId?: string;
  campaignId?: string;
}

export interface SendFilePayload {
  phone: string;
  url: string;
  filename: string;
  caption?: string;
  leadId?: string;
  campaignId?: string;
}

export interface SendLocationPayload {
  phone: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  leadId?: string;
  campaignId?: string;
}

export interface SendContactPayload {
  phone: string;
  firstName: string;
  lastName?: string;
  contactPhone?: string;
  email?: string;
  company?: string;
  leadId?: string;
  campaignId?: string;
}

export interface QuickReplyButton {
  id: string;
  title: string;
}

export interface SendQuickReplyPayload {
  phone: string;
  text: string;
  buttons: QuickReplyButton[];
  header?: string;
  footer?: string;
  leadId?: string;
  campaignId?: string;
}

export interface ListItem {
  id: string;
  title: string;
  description?: string;
}

export interface SendListPayload {
  phone: string;
  header?: string;
  text: string;
  items: ListItem[];
  footer?: string;
  buttonLabel?: string;
  leadId?: string;
  campaignId?: string;
}

export interface SendTemplatePayload {
  phone: string;
  templateId: string;
  templateParams?: string[];
  mediaType?: string;
  mediaUrl?: string;
  leadId?: string;
  campaignId?: string;
}

export interface BroadcastItem {
  phone: string;
  message?: string;
  templateId?: string;
  templateParams?: string[];
}

export interface SendBroadcastPayload {
  items: BroadcastItem[];
}

export interface WhatsAppContact {
  id: string;
  phone: string;
  name: string | null;
  leadId: string | null;
  tags: string | null;
  optIn: boolean;
  lastSeen: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppTemplate {
  id: string;
  templateId: string;
  name: string;
  category: string;
  language: string;
  status: string;
  components: any;
}

// ─── API Service ────────────────────────────────────────────────────────────

const whatsappService = {
  // Chat Inbox
  async getChats(limit = 50, offset = 0): Promise<ChatConversation[]> {
    const res = await api.get('/whatsapp/chats', { params: { limit, offset } });
    return res.data;
  },

  async getChatMessages(phone: string, limit = 50, offset = 0): Promise<ChatMessage[]> {
    const res = await api.get(`/whatsapp/chats/${encodeURIComponent(phone)}/messages`, {
      params: { limit, offset },
    });
    return res.data;
  },

  async getStats(): Promise<WhatsAppStats> {
    const res = await api.get('/whatsapp/stats');
    return res.data;
  },

  // Send Messages
  async sendText(payload: SendTextPayload): Promise<any> {
    const res = await api.post('/whatsapp/send/text', payload);
    return res.data;
  },

  async sendImage(payload: SendImagePayload): Promise<any> {
    const res = await api.post('/whatsapp/send/image', payload);
    return res.data;
  },

  async sendVideo(payload: SendVideoPayload): Promise<any> {
    const res = await api.post('/whatsapp/send/video', payload);
    return res.data;
  },

  async sendAudio(payload: SendAudioPayload): Promise<any> {
    const res = await api.post('/whatsapp/send/audio', payload);
    return res.data;
  },

  async sendFile(payload: SendFilePayload): Promise<any> {
    const res = await api.post('/whatsapp/send/file', payload);
    return res.data;
  },

  async sendLocation(payload: SendLocationPayload): Promise<any> {
    const res = await api.post('/whatsapp/send/location', payload);
    return res.data;
  },

  async sendContact(payload: SendContactPayload): Promise<any> {
    const res = await api.post('/whatsapp/send/contact', payload);
    return res.data;
  },

  async sendQuickReply(payload: SendQuickReplyPayload): Promise<any> {
    const res = await api.post('/whatsapp/send/quick-reply', payload);
    return res.data;
  },

  async sendList(payload: SendListPayload): Promise<any> {
    const res = await api.post('/whatsapp/send/list', payload);
    return res.data;
  },

  async sendTemplate(payload: SendTemplatePayload): Promise<any> {
    const res = await api.post('/whatsapp/send/template', payload);
    return res.data;
  },

  async sendBroadcast(payload: SendBroadcastPayload): Promise<any> {
    const res = await api.post('/whatsapp/send/broadcast', payload);
    return res.data;
  },

  // Contacts
  async getContacts(limit = 100, offset = 0): Promise<WhatsAppContact[]> {
    const res = await api.get('/whatsapp/contacts', { params: { limit, offset } });
    return res.data;
  },

  // Templates
  async syncTemplates(): Promise<any> {
    const res = await api.post('/whatsapp/sync-templates');
    return res.data;
  },
};

export default whatsappService;
