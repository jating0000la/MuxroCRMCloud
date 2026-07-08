import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

export interface IndiamartLead {
  UNIQUE_QUERY_ID: string;
  QUERY_TYPE: string;
  QUERY_TIME: string;
  SENDER_NAME: string;
  SENDER_MOBILE: string;
  SENDER_EMAIL: string;
  SENDER_COUNTRY_ISO: string;
  QUERY_MESSAGE: string;
  SENDER_COMPANY: string;
  SENDER_ADDRESS: string;
  PRODUCT_NAME: string;
  BUYER_PAGE_URL: string;
}

export interface IndiamartFetchResponse {
  success: boolean;
  count: number;
  leads: IndiamartLead[];
  message?: string;
}

export interface IndiamartAutoImportResult {
  success: boolean;
  fetched: number;
  imported: number;
  duplicates: number;
  errors: number;
  leads: any[];
  message?: string;
}

@Injectable()
export class IndiamartService {
  private readonly logger = new Logger(IndiamartService.name);
  private readonly API_BASE_URL = 'https://mapi.indiamart.com/wservce/crm/crmListing/v2/';

  constructor(
    private http: HttpService,
    private prisma: PrismaService,
  ) {}

  /**
   * Fetch leads from IndiaMART Pull API v2
   * Docs: https://help.indiamart.com/knowledge-base/lms-crm-integration-v2/
   *
   * @param crmKey - The Pull API Key (glusr_crm_key)
   * @param startTime - Start date/time (DD-MON-YYYY or DD-MM-YYYYHH:MM:SS)
   * @param endTime - End date/time (same formats)
   */
  async fetchLeads(
    crmKey: string,
    startTime?: string,
    endTime?: string,
  ): Promise<IndiamartFetchResponse> {
    if (!crmKey) throw new BadRequestException('IndiaMART CRM Key not configured');

    this.logger.log('Fetching leads from IndiaMART Pull API v2...');

    const params: Record<string, string> = { glusr_crm_key: crmKey };
    if (startTime) params.start_time = startTime;
    if (endTime) params.end_time = endTime;

    try {
      const response: AxiosResponse = await firstValueFrom(
        this.http.get(this.API_BASE_URL, {
          params,
          timeout: 30000,
        }),
      );

      const body = response.data as any;

      // Check for API errors
      if (body.CODE && body.CODE !== 200) {
        throw new BadRequestException(
          `IndiaMART API error (${body.CODE}): ${body.MESSAGE || 'Unknown error'}`,
        );
      }

      const leads: IndiamartLead[] = body.RESPONSE || [];
      this.logger.log(`Fetched ${leads.length} leads from IndiaMART`);

      return {
        success: true,
        count: leads.length,
        leads,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      const status = error.response?.status || 'Unknown';
      const message = error.response?.data?.MESSAGE || error.response?.data?.message || error.message;
      this.logger.error(`IndiaMART API error: ${status} - ${message}`);
      throw new BadRequestException(`IndiaMART API error: ${status} - ${message}`);
    }
  }

  /**
   * Auto-import leads from IndiaMART into a CRM campaign
   * Fetches leads and creates Lead records with deduplication via UNIQUE_QUERY_ID
   */
  async autoImportLeads(
    campaignId: string,
    crmKey: string,
    startTime?: string,
    endTime?: string,
  ): Promise<IndiamartAutoImportResult> {
    // Verify campaign exists
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new BadRequestException('Campaign not found');
    }

    // Fetch leads from IndiaMART
    const fetchResult = await this.fetchLeads(crmKey, startTime, endTime);

    if (fetchResult.leads.length === 0) {
      return {
        success: true,
        fetched: 0,
        imported: 0,
        duplicates: 0,
        errors: 0,
        leads: [],
        message: 'No leads found in the specified time range',
      };
    }

    // Get the first status for the campaign (New)
    const firstStatus = await this.prisma.campaignStatus.findFirst({
      where: { campaignId },
      orderBy: { order: 'asc' },
    });

    let imported = 0;
    let duplicates = 0;
    let errors = 0;
    const importedLeads: any[] = [];

    for (const imLead of fetchResult.leads) {
      try {
        // Skip leads without any contact info
        if (!imLead.SENDER_MOBILE && !imLead.SENDER_EMAIL) {
          this.logger.warn(`Skipping lead ${imLead.UNIQUE_QUERY_ID}: no contact info`);
          errors++;
          continue;
        }

        // Check for duplicate by UNIQUE_QUERY_ID
        const existingLead = await this.prisma.lead.findUnique({
          where: { indiamartQueryId: imLead.UNIQUE_QUERY_ID },
        });

        if (existingLead) {
          duplicates++;
          continue;
        }

        // Create the lead
        const lead = await this.prisma.lead.create({
          data: {
            campaignId,
            name: imLead.SENDER_NAME || 'IndiaMART Buyer',
            email: imLead.SENDER_EMAIL || null,
            phone: imLead.SENDER_MOBILE || null,
            source: 'indiamart',
            indiamartQueryId: imLead.UNIQUE_QUERY_ID,
            statusId: firstStatus?.id,
            customData: {
              queryType: imLead.QUERY_TYPE,
              queryTime: imLead.QUERY_TIME,
              countryIso: imLead.SENDER_COUNTRY_ISO,
              companyName: imLead.SENDER_COMPANY,
              address: imLead.SENDER_ADDRESS,
              productName: imLead.PRODUCT_NAME,
              buyerPageUrl: imLead.BUYER_PAGE_URL,
              queryMessage: imLead.QUERY_MESSAGE,
            },
          },
        });

        // Create initial followup
        await this.prisma.followup.create({
          data: {
            leadId: lead.id,
            userId: campaign.managerId || (await this.getAdminUserId()),
            status: firstStatus?.label || 'New',
            remarks: `Imported from IndiaMART (${imLead.QUERY_TYPE || 'lead'})`,
          },
        });

        imported++;
        importedLeads.push(lead);
      } catch (error: any) {
        this.logger.error(`Failed to import lead ${imLead.UNIQUE_QUERY_ID}: ${error.message}`);
        errors++;
      }
    }

    this.logger.log(
      `IndiaMART import complete: ${imported} imported, ${duplicates} duplicates, ${errors} errors`,
    );

    return {
      success: true,
      fetched: fetchResult.leads.length,
      imported,
      duplicates,
      errors,
      leads: importedLeads,
      message: `Imported ${imported} leads (${duplicates} duplicates skipped, ${errors} errors)`,
    };
  }

  /**
   * Get the last fetch time for incremental fetching
   */
  async getLastFetchTime(): Promise<string | null> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key: 'indiamartLastFetchTime' },
      });
      if (!setting) return null;

      let value = setting.encryptedValue;
      if (setting.isEncrypted) {
        // For non-sensitive timestamps, we can try to parse directly
        // The encryption service might not be needed for timestamps
        try {
          const { EncryptionService } = await import('../settings/encryption.service');
          // Simple approach - just return the raw value if it looks like a date
          if (setting.encryptedValue.match(/^\d{4}-\d{2}-\d{2}/)) {
            return setting.encryptedValue;
          }
        } catch {}
      }
      return value;
    } catch {
      return null;
    }
  }

  /**
   * Update the last fetch time
   */
  async updateLastFetchTime(time: string): Promise<void> {
    const existing = await this.prisma.setting.findUnique({
      where: { key: 'indiamartLastFetchTime' },
    });

    if (existing) {
      await this.prisma.setting.update({
        where: { key: 'indiamartLastFetchTime' },
        data: { encryptedValue: time, isEncrypted: false },
      });
    } else {
      await this.prisma.setting.create({
        data: {
          key: 'indiamartLastFetchTime',
          encryptedValue: time,
          isEncrypted: false,
        },
      });
    }
  }

  /**
   * Parse IndiaMART email notification for lead details (fallback)
   */
  parseEmailBody(htmlBody: string): Partial<IndiamartLead> {
    const extract = (pattern: RegExp): string => {
      const match = htmlBody.match(pattern);
      return match ? match[1].trim() : '';
    };

    return {
      SENDER_NAME: extract(/(?:Buyer Name|Name)[:\s]*<[^>]*>([^<]+)/i) ||
                   extract(/(?:Buyer Name|Name):\s*([^\n<]+)/i),
      SENDER_EMAIL: extract(/(?:Email|Buyer Email)[:\s]*<[^>]*>([^<]+)/i) ||
                    extract(/[\w.-]+@[\w.-]+\.\w+/),
      SENDER_MOBILE: extract(/(?:Mobile|Phone|Contact)[:\s]*<[^>]*>([^<]+)/i) ||
                     extract(/(?:Mobile|Phone|Contact):\s*([\d\s+-]+)/i),
      QUERY_MESSAGE: extract(/(?:Message|Query|Details)[:\s]*<[^>]*>([^<]+)/i) ||
                     extract(/(?:Message|Query|Details):\s*([^\n<]+)/i),
      SENDER_COMPANY: extract(/(?:Company|Organization)[:\s]*<[^>]*>([^<]+)/i) ||
                      extract(/(?:Company|Organization):\s*([^\n<]+)/i),
      PRODUCT_NAME: extract(/(?:Product|Subject|Requirement)[:\s]*<[^>]*>([^<]+)/i) ||
                    extract(/(?:Product|Subject|Requirement):\s*([^\n<]+)/i),
    };
  }

  private async getAdminUserId(): Promise<string> {
    const admin = await this.prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });
    return admin?.id || '';
  }
}
