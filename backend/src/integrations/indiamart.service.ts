import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { eq, and, desc, asc } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { campaigns, campaignStatuses, leads, followups, settings, users } from '../db/schema';

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
    private database: DatabaseService,
  ) {}

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

      if (body.CODE && body.CODE !== 200) {
        throw new BadRequestException(
          `IndiaMART API error (${body.CODE}): ${body.MESSAGE || 'Unknown error'}`,
        );
      }

      const leadsList: IndiamartLead[] = body.RESPONSE || [];
      this.logger.log(`Fetched ${leadsList.length} leads from IndiaMART`);

      return {
        success: true,
        count: leadsList.length,
        leads: leadsList,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      const status = error.response?.status || 'Unknown';
      const message = error.response?.data?.MESSAGE || error.response?.data?.message || error.message;
      this.logger.error(`IndiaMART API error: ${status} - ${message}`);
      throw new BadRequestException(`IndiaMART API error: ${status} - ${message}`);
    }
  }

  async autoImportLeads(
    campaignId: string,
    crmKey: string,
    startTime?: string,
    endTime?: string,
  ): Promise<IndiamartAutoImportResult> {
    const [campaign] = await this.database.db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      throw new BadRequestException('Campaign not found');
    }

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

    const [firstStatus] = await this.database.db
      .select()
      .from(campaignStatuses)
      .where(eq(campaignStatuses.campaignId, campaignId))
      .orderBy(asc(campaignStatuses.order))
      .limit(1);

    let imported = 0;
    let duplicates = 0;
    let errors = 0;
    const importedLeads: any[] = [];

    for (const imLead of fetchResult.leads) {
      try {
        if (!imLead.SENDER_MOBILE && !imLead.SENDER_EMAIL) {
          this.logger.warn(`Skipping lead ${imLead.UNIQUE_QUERY_ID}: no contact info`);
          errors++;
          continue;
        }

        const [existingLead] = await this.database.db
          .select()
          .from(leads)
          .where(eq(leads.indiamartQueryId, imLead.UNIQUE_QUERY_ID))
          .limit(1);

        if (existingLead) {
          duplicates++;
          continue;
        }

        const [lead] = await this.database.db
          .insert(leads)
          .values({
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
          })
          .returning();

        const userId = campaign.managerId || (await this.getAdminUserId());
        await this.database.db.insert(followups).values({
          leadId: lead.id,
          userId,
          status: firstStatus?.label || 'New',
          remarks: `Imported from IndiaMART (${imLead.QUERY_TYPE || 'lead'})`,
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

  async getLastFetchTime(): Promise<string | null> {
    try {
      const [setting] = await this.database.db
        .select({ key: settings.key, encryptedValue: settings.encryptedValue, isEncrypted: settings.isEncrypted })
        .from(settings)
        .where(eq(settings.key, 'indiamartLastFetchTime'))
        .limit(1);
      if (!setting) return null;

      // If encrypted, try to decrypt; if already plaintext date, return as-is
      if (setting.isEncrypted) {
        try {
          if (setting.encryptedValue.match(/^\d{4}-\d{2}-\d{2}/)) {
            return setting.encryptedValue;
          }
        } catch {}
      }
      return setting.encryptedValue;
    } catch {
      return null;
    }
  }

  async updateLastFetchTime(time: string): Promise<void> {
    const [existing] = await this.database.db
      .select()
      .from(settings)
      .where(eq(settings.key, 'indiamartLastFetchTime'))
      .limit(1);

    if (existing) {
      await this.database.db
        .update(settings)
        .set({ encryptedValue: time, isEncrypted: false })
        .where(eq(settings.key, 'indiamartLastFetchTime'));
    } else {
      await this.database.db.insert(settings).values({
        key: 'indiamartLastFetchTime',
        encryptedValue: time,
        isEncrypted: false,
      });
    }
  }

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
    const [admin] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.role, 'ADMIN'))
      .limit(1);
    return admin?.id || '';
  }
}
