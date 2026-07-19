import { Injectable, Logger, BadRequestException, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom, retry, timer, catchError } from 'rxjs';
import { OperatorFunction } from 'rxjs';

// ─── Gupshup error code documentation ──────────────────────────────────────
// https://console-docs.gupshup.io/docs/whatsapp-business-api
const GUPSHUP_ERROR_CODES: Record<number, string> = {
  1001: 'Access API app is not Live — sandbox mode mismatch',
  1002: 'Number does not exist on WhatsApp',
  1003: 'Unable to send message — check wallet balance (insufficient funds)',
  1004: 'User inactive for session and template messaging is disabled',
  1005: 'User inactive for session and template did not match',
  1006: 'User inactive for session and not opted in for template message',
  1007: 'User inactive, not opted-in, and template did not match',
  1008: 'User is not opted in and inactive',
  1009: 'Template message rejected by user',
  1010: 'Invalid Media URL (sandbox mode limitation)',
  1011: 'Invalid Media Size',
};

// Gupshup session message types supported in the message object
export type GupshupMediaType = 'image' | 'video' | 'document' | 'audio' | 'location';

export interface GupshupSendResponse {
  status: string;
  messageId: string;
}

export interface GupshupInboundMessage {
  type: string;
  source: string;
  destination: string;
  message: any;
  sender: { phone: string; name: string; countryCode: string; dialCode: string };
  context: { id: string; gsId: string } | null;
  timestamp: string;
  messageId: string;
  messageType: string; // text, image, file, audio, video, contact, location, button_reply, list_reply
}

@Injectable()
export class GupshupService {
  private readonly logger = new Logger(GupshupService.name);
  private readonly SESSION_MSG_URL = 'https://api.gupshup.io/wa/api/v1/msg';
  private readonly TEMPLATE_MSG_URL = 'https://api.gupshup.io/wa/api/v1/template/msg';
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY_MS = 1000;

  constructor(private http: HttpService) {}

  // ─── Session Messages ──────────────────────────────────────────────────────

  /**
   * Send a session text message (free-form, within 24h window).
   * Docs: https://console-docs.gupshup.io/docs/whatsapp-business-api
   */
  async sendSessionMessage(
    apiKey: string,
    source: string,
    appName: string,
    destination: string,
    message: string,
    disablePreview?: boolean,
    encode?: boolean,
  ): Promise<GupshupSendResponse> {
    this.validateApiKey(apiKey);
    const normalizedSource = this.validatePhone(source, 'Source');
    const normalizedDestination = this.validatePhone(destination, 'Destination');

    this.logger.log(`Sending session text to ${normalizedDestination}`);

    const messagePayload: any = {
      type: 'text',
      text: message,
    };

    const formParams: Record<string, string> = {
      channel: 'whatsapp',
      source: normalizedSource,
      'src.name': appName,
      destination: normalizedDestination,
      message: JSON.stringify(messagePayload),
    };

    // disablePreview is a top-level form param per docs
    if (disablePreview !== undefined) {
      formParams.disablePreview = String(disablePreview);
    }

    // encode flag for emoji in interactive messages
    if (encode !== undefined) {
      formParams.encode = String(encode);
    }

    return this.postWithRetry(apiKey, this.SESSION_MSG_URL, formParams);
  }

  /**
   * Send a media session message (image/video/document/audio/location, within 24h window).
   * Docs: https://console-docs.gupshup.io/docs/whatsapp-business-api
   */
  async sendMediaSessionMessage(
    apiKey: string,
    source: string,
    appName: string,
    destination: string,
    mediaType: GupshupMediaType,
    mediaUrl: string,
    caption?: string,
  ): Promise<GupshupSendResponse> {
    this.validateApiKey(apiKey);
    const normalizedSource = this.validatePhone(source, 'Source');
    const normalizedDestination = this.validatePhone(destination, 'Destination');

    if (!mediaUrl) throw new BadRequestException('Media URL is required');

    this.logger.log(`Sending session ${mediaType} to ${normalizedDestination}`);

    const messagePayload: any = { type: mediaType };
    messagePayload[mediaType] = { link: mediaUrl };

    if (caption && (mediaType === 'image' || mediaType === 'video' || mediaType === 'document')) {
      messagePayload[mediaType].caption = caption;
    }

    if (mediaType === 'document') {
      messagePayload[mediaType].filename = caption || 'document';
    }

    const formParams: Record<string, string> = {
      channel: 'whatsapp',
      source: normalizedSource,
      'src.name': appName,
      destination: normalizedDestination,
      message: JSON.stringify(messagePayload),
    };

    return this.postWithRetry(apiKey, this.SESSION_MSG_URL, formParams);
  }

  // ─── Template Messages ─────────────────────────────────────────────────────

  /**
   * Send a template message (HSM/notification, outside 24h window).
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
    this.validateApiKey(apiKey);
    const normalizedSource = this.validatePhone(source, 'Source');
    const normalizedDestination = this.validatePhone(destination, 'Destination');
    if (!templateId) throw new BadRequestException('Template ID required');

    this.logger.log(`Sending template to ${normalizedDestination}`);

    const templateObj: any = { id: templateId };
    if (templateParams && templateParams.length > 0) {
      templateObj.params = templateParams;
    }

    const formParams: Record<string, string> = {
      source: normalizedSource,
      destination: normalizedDestination,
      'src.name': appName,
      template: JSON.stringify(templateObj),
    };

    if (mediaMessage?.type && mediaMessage?.link) {
      const messageObj: any = { type: mediaMessage.type };
      messageObj[mediaMessage.type] = { link: mediaMessage.link };
      formParams.message = JSON.stringify(messageObj);
    }

    return this.postWithRetry(apiKey, this.TEMPLATE_MSG_URL, formParams);
  }

  // ─── Connection Test ───────────────────────────────────────────────────────

  /**
   * Test the Gupshup connection by sending a test message.
   */
  async testConnection(
    apiKey: string,
    source: string,
    appName: string,
    testPhone: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.sendSessionMessage(
        apiKey, source, appName, testPhone,
        'Test message from Muxro CRM - Gupshup connection successful!',
      );
      return {
        success: true,
        message: `Request submitted to Gupshup. Message ID: ${result.messageId}. Delivery depends on session window, opt-in, and webhook status events.`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // ─── Inbound Webhook Parsing ───────────────────────────────────────────────

  /**
   * Parse inbound webhook payload from Gupshup.
   * Docs: https://console-docs.gupshup.io/docs/inbound-messages-and-events
   */
  parseInboundWebhook(payload: any): GupshupInboundMessage | null {
    try {
      if (!payload) return null;

      const eventType = payload.type || 'message';
      const eventPayload = payload.payload || {};

      if (eventType === 'message') {
        const inboundPayload = eventPayload.payload || {};

        // Extract sender metadata per docs
        const sender = eventPayload.sender || {};
        const context = eventPayload.context || null;

        return {
          type: eventType,
          source: eventPayload.source || sender.phone || '',
          destination: payload.app || eventPayload.destination || '',
          message: this.normalizeInboundMessage(eventPayload.type, inboundPayload),
          sender: {
            phone: sender.phone || eventPayload.source || '',
            name: sender.name || '',
            countryCode: sender.country_code || '',
            dialCode: sender.dial_code || '',
          },
          context: context ? { id: context.id || '', gsId: context.gsId || '' } : null,
          timestamp: this.normalizeTimestamp(payload.timestamp),
          messageId: eventPayload.id || context?.gsId || '',
          messageType: eventPayload.type || 'text',
        };
      }

      // message-event, account-event, user-event, billing-event, template-event
      return {
        type: eventType,
        source: eventPayload.source || eventPayload.phone || eventPayload.srcAddr || '',
        destination: eventPayload.destination || eventPayload.destAddr || payload.app || '',
        message: eventPayload,
        sender: { phone: eventPayload.source || eventPayload.phone || '', name: '', countryCode: '', dialCode: '' },
        context: null,
        timestamp: this.normalizeTimestamp(payload.timestamp),
        messageId: eventPayload.id || eventPayload.gsId || eventPayload.externalId || '',
        messageType: eventType,
      };
    } catch {
      return null;
    }
  }

  // ─── Template Sync ─────────────────────────────────────────────────────────

  /**
   * Fetch approved WhatsApp templates from Gupshup.
   * Note: Template sync endpoint may vary — verify against live API.
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
          headers: { 'Content-Type': 'application/json', apikey: apiKey },
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

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * POST with retry (exponential backoff) for transient failures.
   * Gupshup processes messages asynchronously — a transient 5xx should be retried.
   */
  private async postWithRetry(
    apiKey: string,
    url: string,
    formParams: Record<string, string>,
    attempt = 0,
  ): Promise<GupshupSendResponse> {
    try {
      const params = new URLSearchParams(formParams);
      const response: AxiosResponse = await firstValueFrom(
        this.http.post(url, params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            apikey: apiKey,
          },
          timeout: 30000,
        }),
      );

      const body = response.data as any;
      this.logger.log(`Gupshup message sent: ${body.messageId}`);
      return {
        status: body.status || 'submitted',
        messageId: body.messageId || '',
      };
    } catch (error: any) {
      const status = error.response?.status;
      const errBody = error.response?.data;

      // Retry on transient server errors (5xx) or network errors
      if ((!status || status >= 500) && attempt < this.MAX_RETRIES) {
        const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt);
        this.logger.warn(`Gupshup transient error, retrying in ${delay}ms (attempt ${attempt + 1}/${this.MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.postWithRetry(apiKey, url, formParams, attempt + 1);
      }

      // Build detailed error message from Gupshup error codes
      const gupshupErrorCode = errBody?.errorCode || errBody?.code;
      const gupshupErrorMsg = errBody?.message || errBody?.status || error.message;
      let detailMessage = `Gupshup error [${status || 'network'}]: ${gupshupErrorMsg}`;

      if (gupshupErrorCode && GUPSHUP_ERROR_CODES[gupshupErrorCode]) {
        detailMessage += ` — ${GUPSHUP_ERROR_CODES[gupshupErrorCode]}`;
      }

      this.logger.error(`Gupshup API error: ${detailMessage}`);
      throw new BadRequestException(detailMessage);
    }
  }

  /**
   * Validate phone number is in E.164-like format (digits only, 10-15 chars).
   */
  private validatePhone(phone: string, label: string): string {
    const normalized = String(phone || '').replace(/\D/g, '');
    if (!normalized) throw new BadRequestException(`${label} phone number not configured`);
    if (normalized.length < 10 || normalized.length > 15) {
      throw new BadRequestException(
        `${label} phone number must be in E.164 format (10-15 digits, e.g. 919876543210). Got: ${normalized} (${normalized.length} digits)`,
      );
    }
    return normalized;
  }

  private validateApiKey(apiKey: string): void {
    if (!apiKey) throw new BadRequestException('Gupshup API key not configured');
  }

  /**
   * Normalize inbound message content per type.
   * Docs: text, image, file, audio, video, contact, location, button_reply, list_reply
   */
  private normalizeInboundMessage(messageType: string | undefined, payload: any): any {
    if (!payload) return {};

    switch (messageType) {
      case 'text':
        return { text: payload.text || '' };

      case 'image':
        return {
          text: payload.caption || '',
          imageUrl: payload.url || payload.image?.url || '',
          mimeType: payload.mimeType || '',
        };

      case 'video':
        return {
          text: payload.caption || '',
          videoUrl: payload.url || payload.video?.url || '',
          mimeType: payload.mimeType || '',
        };

      case 'file':
      case 'document':
        return {
          text: payload.filename || payload.caption || '',
          fileUrl: payload.url || payload.document?.url || '',
          filename: payload.filename || '',
          mimeType: payload.mimeType || '',
        };

      case 'audio':
        return {
          text: '',
          audioUrl: payload.url || payload.audio?.url || '',
          mimeType: payload.mimeType || '',
        };

      case 'contact':
        return {
          text: payload.name?.formattedName || payload.name?.firstName || '[Contact]',
          contacts: payload.contacts || [payload],
        };

      case 'location':
        return {
          text: `[Location] ${payload.latitude || ''},${payload.longitude || ''}`,
          latitude: payload.latitude,
          longitude: payload.longitude,
          name: payload.name || '',
          address: payload.address || '',
        };

      case 'button_reply':
        return {
          text: payload.title || payload.text || payload.postbackText || '',
          buttonId: payload.button?.id || payload.id || '',
          ...payload,
        };

      case 'list_reply':
        return {
          text: payload.title || payload.text || payload.postbackText || '',
          listItemId: payload.id || '',
          ...payload,
        };

      default:
        return payload || {};
    }
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
}
