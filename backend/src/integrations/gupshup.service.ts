import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';

export interface GupshupSessionMessage {
  channel: string;
  source: string;
  'src.name': string;
  destination: string;
  message: {
    type: 'text';
    text: string;
    previewUrl?: boolean;
  };
  disablePreview?: boolean;
  encode?: boolean;
}

export interface GupshupTemplateMessage {
  source: string;
  destination: string;
  template: {
    id: string;
    params?: string[];
  };
  message?: {
    type: 'image' | 'video' | 'document' | 'location';
    [key: string]: any;
  };
}

export interface GupshupSendResponse {
  status: string;
  messageId: string;
}

export interface GupshupInboundMessage {
  type: string;
  source: string;
  destination: string;
  message: any;
  timestamp: string;
  messageId: string;
}

@Injectable()
export class GupshupService {
  private readonly logger = new Logger(GupshupService.name);
  private readonly SESSION_MSG_URL = 'https://api.gupshup.io/wa/api/v1/msg';
  private readonly TEMPLATE_MSG_URL = 'https://api.gupshup.io/wa/api/v1/template/msg';

  constructor(private http: HttpService) {}

  /**
   * Send a session message (free-form, within 24h window)
   * Docs: https://console-docs.gupshup.io/docs/whatsapp-business-api
   */
  async sendSessionMessage(
    apiKey: string,
    source: string,
    appName: string,
    destination: string,
    message: string,
    disablePreview?: boolean,
  ): Promise<GupshupSendResponse> {
    if (!apiKey) throw new BadRequestException('Gupshup API key not configured');
    const normalizedSource = this.normalizePhone(source);
    const normalizedDestination = this.normalizePhone(destination);
    if (!normalizedSource) throw new BadRequestException('Source phone number not configured');
    if (!normalizedDestination) throw new BadRequestException('Destination phone number required');

    this.logger.log(`Sending session message to ${normalizedDestination}`);

    try {
      const params = new URLSearchParams();
      params.append('channel', 'whatsapp');
      params.append('source', normalizedSource);
      params.append('src.name', appName);
      params.append('destination', normalizedDestination);
      const messagePayload: GupshupSessionMessage['message'] = {
        type: 'text',
        text: message,
      };
      if (disablePreview !== undefined) {
        messagePayload.previewUrl = !disablePreview;
      }
      params.append('message', JSON.stringify(messagePayload));

      const response: AxiosResponse = await firstValueFrom(
        this.http.post(this.SESSION_MSG_URL, params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            apikey: apiKey,
          },
          timeout: 30000,
        }),
      );

      const body = response.data as any;
      this.logger.log(`Session message sent: ${body.messageId}`);
      return {
        status: body.status || 'submitted',
        messageId: body.messageId || '',
      };
    } catch (error: any) {
      const status = error.response?.status || 'Unknown';
      this.logger.error(`Gupshup session message error: ${status}`);
      throw new BadRequestException('Failed to send WhatsApp message');
    }
  }

  /**
   * Send a template message (HSM/notification, outside 24h window)
   * Docs: https://console-docs.gupshup.io/docs/whatsapp-business-api
   */
  async sendTemplateMessage(
    apiKey: string,
    source: string,
    appName: string,
    destination: string,
    templateId: string,
    templateParams?: string[],
    mediaMessage?: { type: string; link: string },
  ): Promise<GupshupSendResponse> {
    if (!apiKey) throw new BadRequestException('Gupshup API key not configured');
    const normalizedSource = this.normalizePhone(source);
    const normalizedDestination = this.normalizePhone(destination);
    if (!normalizedSource) throw new BadRequestException('Source phone number not configured');
    if (!normalizedDestination) throw new BadRequestException('Destination phone number required');
    if (!templateId) throw new BadRequestException('Template ID required');

    this.logger.log(`Sending template message to ${normalizedDestination}`);

    try {
      const params = new URLSearchParams();
      params.append('source', normalizedSource);
      params.append('destination', normalizedDestination);
      params.append('src.name', appName);

      const templateObj: any = { id: templateId };
      if (templateParams && templateParams.length > 0) {
        templateObj.params = templateParams;
      }
      params.append('template', JSON.stringify(templateObj));

      if (mediaMessage) {
        const messageObj: any = { type: mediaMessage.type };
        messageObj[mediaMessage.type] = { link: mediaMessage.link };
        params.append('message', JSON.stringify(messageObj));
      }

      const response: AxiosResponse = await firstValueFrom(
        this.http.post(this.TEMPLATE_MSG_URL, params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            apikey: apiKey,
          },
          timeout: 30000,
        }),
      );

      const body = response.data as any;
      this.logger.log(`Template message sent: ${body.messageId}`);
      return {
        status: body.status || 'submitted',
        messageId: body.messageId || '',
      };
    } catch (error: any) {
      const status = error.response?.status || 'Unknown';
      this.logger.error(`Gupshup template message error: ${status}`);
      throw new BadRequestException('Failed to send WhatsApp template');
    }
  }

  /**
   * Test the Gupshup connection by sending a test message
   */
  async testConnection(
    apiKey: string,
    source: string,
    appName: string,
    testPhone: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.sendSessionMessage(
        apiKey,
        source,
        appName,
        testPhone,
        'Test message from Muxro CRM - Gupshup connection successful!',
      );
      return {
        success: true,
        message: `Request submitted to Gupshup. Message ID: ${result.messageId}. Delivery still depends on session window, opt-in, and webhook status events.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Parse inbound webhook payload from Gupshup
   */
  parseInboundWebhook(payload: any): GupshupInboundMessage | null {
    try {
      if (!payload) return null;

      const eventType = payload.type || 'message';
      const eventPayload = payload.payload || {};

      if (eventType === 'message') {
        const inboundPayload = eventPayload.payload || {};

        return {
          type: eventType,
          source: eventPayload.source || eventPayload.sender?.phone || '',
          destination: payload.app || eventPayload.destination || '',
          message: this.normalizeInboundMessage(eventPayload.type, inboundPayload),
          timestamp: this.normalizeTimestamp(payload.timestamp),
          messageId: eventPayload.id || eventPayload.context?.gsId || '',
        };
      }

      return {
        type: eventType,
        source: eventPayload.source || eventPayload.phone || eventPayload.srcAddr || '',
        destination: eventPayload.destination || eventPayload.destAddr || payload.app || '',
        message: eventPayload,
        timestamp: this.normalizeTimestamp(payload.timestamp),
        messageId: eventPayload.id || eventPayload.gsId || eventPayload.externalId || '',
      };
    } catch {
      return null;
    }
  }

  private normalizeInboundMessage(messageType: string | undefined, payload: any): any {
    if (messageType === 'text') {
      return { text: payload?.text || '' };
    }

    if (messageType === 'button_reply' || messageType === 'list_reply') {
      return {
        text: payload?.title || payload?.text || payload?.postbackText || '',
        ...payload,
      };
    }

    return payload || {};
  }

  private normalizeTimestamp(timestamp: string | number | undefined): string {
    if (typeof timestamp === 'number') {
      return new Date(timestamp).toISOString();
    }

    if (typeof timestamp === 'string') {
      const numericTimestamp = Number(timestamp);
      if (!Number.isNaN(numericTimestamp) && timestamp.trim() !== '') {
        return new Date(numericTimestamp).toISOString();
      }
      return timestamp;
    }

    return new Date().toISOString();
  }

  private normalizePhone(phone: string): string {
    return String(phone || '').replace(/\D/g, '');
  }

  /**
   * Fetch approved WhatsApp templates from Gupshup
   */
  async syncTemplates(
    apiKey: string,
    appId: string,
  ): Promise<{ success: boolean; templates: any[]; error?: string }> {
    if (!apiKey) throw new BadRequestException('Gupshup API key not configured');
    if (!appId) throw new BadRequestException('Gupshup App ID required for template sync');

    try {
      const url = `https://api.gupshup.io/wa/app/${encodeURIComponent(appId)}/template?pageNo=0&pageSize=100`;
      this.logger.log(`Syncing templates from: ${url}`);
      const response: AxiosResponse = await firstValueFrom(
        this.http.get(url, {
          headers: {
            'Content-Type': 'application/json',
            apikey: apiKey,
          },
          timeout: 30000,
        }),
      );

      const body = response.data as any;
      const list = body.templates || body.data || body.payload || body.templateList || [];
      const templates = Array.isArray(list)
        ? list.map((t: any) => ({
            id: t.id || t.templateId || '',
            name: t.elementName || t.name || t.templateName || t.id || '',
            language: t.languageCode || t.language || '',
            category: t.category || t.templateCategory || '',
            type: t.templateType || t.type || '',
            status: t.status || t.templateStatus || '',
            body: t.data || t.body || t.content || '',
          }))
        : [];

      this.logger.log(`Synced ${templates.length} Gupshup templates`);
      return { success: true, templates };
    } catch (error: any) {
      const status = error.response?.status;
      const body = error.response?.data;
      const msg = body?.message || body?.status || error.message;
      this.logger.error(`Template sync failed [${status}]: ${JSON.stringify(body || msg)}`);
      return { success: false, templates: [], error: `[${status}] ${msg}` };
    }
  }
}
