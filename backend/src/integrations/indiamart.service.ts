import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';

export interface IndiamartLead {
  sender_name: string;
  sender_email: string;
  sender_mobile: string;
  subject: string;
  query_message: string;
  company_name: string;
  sender_address: string;
  received_at: string;
}

export interface IndiamartFetchResponse {
  success: boolean;
  count: number;
  leads: IndiamartLead[];
  message?: string;
}

@Injectable()
export class IndiamartService {
  private readonly logger = new Logger(IndiamartService.name);
  private readonly apiUrl = 'https://api.indiamart.com/leads/v2/leads';

  constructor(private http: HttpService) {}

  /**
   * Fetch recent leads from Indiamart API
   * Docs: https://developer.indiamart.com
   */
  async fetchLeads(apiKey: string, webappUrl: string): Promise<IndiamartFetchResponse> {
    if (!apiKey) throw new Error('Indiamart API Key not configured');

    this.logger.log('Fetching leads from Indiamart...');

    try {
      const response: AxiosResponse = await firstValueFrom(
        this.http.get(this.apiUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          params: {
            glusr_mobile: '',
            last_msg_timestamp: Math.floor(Date.now() / 1000) - 900, // Last 15 minutes
          },
          timeout: 30000,
        }),
      );

      const body = response.data as any;
      const leads: IndiamartLead[] = (body.LEADS || []).map((lead: any) => ({
        sender_name: lead.SENDER_NAME || '',
        sender_email: lead.SENDER_EMAIL || '',
        sender_mobile: lead.SENDER_MOBILE || '',
        subject: lead.SUBJECT || '',
        query_message: lead.QUERY_MESSAGE || '',
        company_name: lead.SENDER_COMPANY || '',
        sender_address: lead.SENDER_ADDRESS || '',
        received_at: lead.RECEIVED_DATE || new Date().toISOString(),
      }));

      this.logger.log(`Fetched ${leads.length} leads from Indiamart`);
      return {
        success: true,
        count: leads.length,
        leads,
      };
    } catch (error: any) {
      const status = error.response?.status || 'Unknown';
      const message = error.response?.data?.message || error.message;
      this.logger.error(`Indiamart API error: ${status} - ${message}`);
      throw new Error(`Indiamart API error: ${status} - ${message}`);
    }
  }

  /**
   * Parse Indiamart email notification for lead details
   * Used when API is not available - extracts from email body HTML
   */
  parseEmailBody(htmlBody: string): Partial<IndiamartLead> {
    const extract = (pattern: RegExp): string => {
      const match = htmlBody.match(pattern);
      return match ? match[1].trim() : '';
    };

    return {
      sender_name: extract(/(?:Buyer Name|Name)[:\s]*<[^>]*>([^<]+)/i) ||
                   extract(/(?:Buyer Name|Name):\s*([^\n<]+)/i),
      sender_email: extract(/(?:Email|Buyer Email)[:\s]*<[^>]*>([^<]+)/i) ||
                    extract(/[\w.-]+@[\w.-]+\.\w+/),
      sender_mobile: extract(/(?:Mobile|Phone|Contact)[:\s]*<[^>]*>([^<]+)/i) ||
                     extract(/(?:Mobile|Phone|Contact):\s*([\d\s+-]+)/i),
      subject: extract(/(?:Product|Subject|Requirement)[:\s]*<[^>]*>([^<]+)/i) ||
               extract(/(?:Product|Subject|Requirement):\s*([^\n<]+)/i),
      query_message: extract(/(?:Message|Query|Details)[:\s]*<[^>]*>([^<]+)/i) ||
                     extract(/(?:Message|Query|Details):\s*([^\n<]+)/i),
      company_name: extract(/(?:Company|Organization)[:\s]*<[^>]*>([^<]+)/i) ||
                    extract(/(?:Company|Organization):\s*([^\n<]+)/i),
    };
  }
}
