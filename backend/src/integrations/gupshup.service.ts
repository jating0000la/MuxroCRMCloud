import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';

export interface GupshupSessionMessage {
  channel: string;
  source: string;
  'src.name': string;
  destination: string;
  message: string;
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
  private readonly SESSION_MSG_URL = 'https://api.gupshup.io/sm/api/v1/msg';
  private readonly TEMPLATE_MSG_URL = 'https://api.gupshup.io/sm/api/v1/template/msg';

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
    if (!source) throw new BadRequestException('Source phone number not configured');
    if (!destination) throw new BadRequestException('Destination phone number required');

    this.logger.log(`Sending session message to ${destination}`);

    try {
      const params = new URLSearchParams();
      params.append('channel', 'whatsapp');
      params.append('source', source);
      params.append('src.name', appName);
      params.append('destination', destination);
      params.append('message', message);
      if (disablePreview !== undefined) {
        params.append('disablePreview', String(disablePreview));
      }

      const response: AxiosResponse = await firstValueFrom(
        this.http.post(this.SESSION_MSG_URL, params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'api_key': apiKey,
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
      const message = error.response?.data?.message || error.message;
      this.logger.error(`Gupshup session message error: ${status} - ${message}`);
      throw new BadRequestException(`Gupshup API error: ${status} - ${message}`);
    }
  }

  /**
   * Send a template message (HSM/notification, outside 24h window)
   * Docs: https://console-docs.gupshup.io/docs/whatsapp-business-api
   */
  async sendTemplateMessage(
    apiKey: string,
    source: string,
    destination: string,
    templateId: string,
    templateParams?: string[],
    mediaMessage?: { type: string; link: string },
  ): Promise<GupshupSendResponse> {
    if (!apiKey) throw new BadRequestException('Gupshup API key not configured');
    if (!source) throw new BadRequestException('Source phone number not configured');
    if (!destination) throw new BadRequestException('Destination phone number required');
    if (!templateId) throw new BadRequestException('Template ID required');

    this.logger.log(`Sending template message to ${destination}`);

    try {
      const params = new URLSearchParams();
      params.append('source', source);
      params.append('destination', destination);

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
            'Apikey': apiKey,
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
      const message = error.response?.data?.message || error.message;
      this.logger.error(`Gupshup template message error: ${status} - ${message}`);
      throw new BadRequestException(`Gupshup API error: ${status} - ${message}`);
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
        message: `Connection successful. Message ID: ${result.messageId}`,
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

      return {
        type: payload.type || 'message',
        source: payload.source || '',
        destination: payload.destination || '',
        message: payload.message || {},
        timestamp: payload.timestamp || new Date().toISOString(),
        messageId: payload.messageId || '',
      };
    } catch {
      return null;
    }
  }
}
