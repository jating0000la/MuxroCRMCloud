import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import {
  campaigns,
  campaignUsers,
  campaignStatuses,
  leads,
  forms,
  enquiries,
  followups,
  users,
} from '../db/schema';
import { eq, desc } from 'drizzle-orm';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require('archiver');
import { PassThrough } from 'stream';

/**
 * Escape a value for CSV output. Wraps in double-quotes if the value contains
 * a comma, double-quote, or newline — otherwise returns as-is.
 */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(fields: unknown[]): string {
  return fields.map(csvEscape).join(',');
}

@Injectable()
export class DataExportService {
  private logger = new Logger('DataExportService');

  constructor(private database: DatabaseService) {}

  /* ─── CSV Generation ──────────────────────────────────────────────── */

  private buildCampaignsCsv(rows: any[]): string {
    const header = csvRow(['ID', 'Name', 'Description', 'Is Active', 'Manager', 'Created At', 'Updated At']);
    const lines = rows.map((r) =>
      csvRow([
        r.id,
        r.name,
        r.description,
        r.isActive ? 'Yes' : 'No',
        r.managerName || '',
        r.createdAt?.toISOString?.() || r.createdAt,
        r.updatedAt?.toISOString?.() || r.updatedAt,
      ]),
    );
    return [header, ...lines].join('\n');
  }

  private buildLeadsCsv(rows: any[]): string {
    const header = csvRow([
      'ID',
      'Campaign',
      'Name',
      'Email',
      'Phone',
      'Source',
      'Status',
      'Assigned To',
      'DND',
      'Is Deleted',
      'Created At',
      'Updated At',
    ]);
    const lines = rows.map((r) =>
      csvRow([
        r.id,
        r.campaignName || '',
        r.name,
        r.email,
        r.phone,
        r.source,
        r.statusLabel || '',
        r.doerName || '',
        r.dnd ? 'Yes' : 'No',
        r.isDeleted ? 'Yes' : 'No',
        r.createdAt?.toISOString?.() || r.createdAt,
        r.updatedAt?.toISOString?.() || r.updatedAt,
      ]),
    );
    return [header, ...lines].join('\n');
  }

  private buildFormsCsv(rows: any[]): string {
    const header = csvRow(['ID', 'Campaign', 'Title', 'Is Published', 'Public Slug', 'Created At', 'Updated At']);
    const lines = rows.map((r) =>
      csvRow([
        r.id,
        r.campaignName || '',
        r.title,
        r.isPublished ? 'Yes' : 'No',
        r.publicSlug,
        r.createdAt?.toISOString?.() || r.createdAt,
        r.updatedAt?.toISOString?.() || r.updatedAt,
      ]),
    );
    return [header, ...lines].join('\n');
  }

  private buildFormResponsesCsv(rows: any[]): string {
    // Flatten each enquiry's JSON data into columns
    const header = csvRow([
      'ID',
      'Form',
      'Campaign',
      'Submitted At',
      'IP Address',
      'Name',
      'Email',
      'Phone',
      'Other Data',
    ]);
    const lines = rows.map((r) => {
      const data = r.data || {};
      const name = data.name || data.Name || '';
      const email = data.email || data.Email || '';
      const phone = data.phone || data.Phone || '';

      // Collect remaining keys as "Other Data"
      const otherKeys = Object.keys(data).filter(
        (k) => !['name', 'Name', 'email', 'Email', 'phone', 'Phone'].includes(k),
      );
      const otherData = otherKeys.length > 0
        ? JSON.stringify(Object.fromEntries(otherKeys.map((k) => [k, data[k]])))
        : '';

      return csvRow([
        r.id,
        r.formTitle || '',
        r.campaignName || '',
        r.submittedAt?.toISOString?.() || r.submittedAt,
        r.ipAddress,
        name,
        email,
        phone,
        otherData,
      ]);
    });
    return [header, ...lines].join('\n');
  }

  private buildCampaignStatusesCsv(rows: any[]): string {
    const header = csvRow(['ID', 'Campaign', 'Label', 'Color', 'Order', 'WhatsApp Message']);
    const lines = rows.map((r) =>
      csvRow([r.id, r.campaignName || '', r.label, r.color, r.order, r.whatsappMessage]),
    );
    return [header, ...lines].join('\n');
  }

  private buildFollowupsCsv(rows: any[]): string {
    const header = csvRow(['ID', 'Lead', 'Lead Name', 'Assigned To', 'Status', 'Remarks', 'Next Call Date', 'Created At']);
    const lines = rows.map((r) =>
      csvRow([
        r.id,
        r.leadId,
        r.leadName || '',
        r.userName || '',
        r.status,
        r.remarks,
        r.nextCallDate?.toISOString?.() || r.nextCallDate,
        r.createdAt?.toISOString?.() || r.createdAt,
      ]),
    );
    return [header, ...lines].join('\n');
  }

  /* ─── Data Fetching ──────────────────────────────────────────────── */

  private async fetchCampaignsData() {
    return this.database.db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        description: campaigns.description,
        isActive: campaigns.isActive,
        createdAt: campaigns.createdAt,
        updatedAt: campaigns.updatedAt,
        managerName: users.name,
      })
      .from(campaigns)
      .leftJoin(users, eq(campaigns.managerId, users.id))
      .orderBy(desc(campaigns.createdAt));
  }

  private async fetchLeadsData() {
    return this.database.db
      .select({
        id: leads.id,
        name: leads.name,
        email: leads.email,
        phone: leads.phone,
        source: leads.source,
        dnd: leads.dnd,
        isDeleted: leads.isDeleted,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
        campaignName: campaigns.name,
        statusLabel: campaignStatuses.label,
        doerName: users.name,
      })
      .from(leads)
      .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
      .leftJoin(campaignStatuses, eq(leads.statusId, campaignStatuses.id))
      .leftJoin(users, eq(leads.doerId, users.id))
      .orderBy(desc(leads.createdAt));
  }

  /* ─── Public API ──────────────────────────────────────────────── */

  async generateExportZip(): Promise<{ stream: PassThrough; size: number }> {
    this.logger.log('Starting full campaign data export');

    // Fetch all data
    const [campaignsData, leadsData, formsData, formResponsesData, statusesData, followupsData] =
      await Promise.all([
        this.fetchCampaignsData(),
        this.fetchLeadsData(),
        // Forms
        this.database.db
          .select({
            id: forms.id,
            title: forms.title,
            isPublished: forms.isPublished,
            publicSlug: forms.publicSlug,
            createdAt: forms.createdAt,
            updatedAt: forms.updatedAt,
            campaignName: campaigns.name,
          })
          .from(forms)
          .innerJoin(campaigns, eq(forms.campaignId, campaigns.id))
          .orderBy(desc(forms.createdAt)),
        // Form responses (enquiries)
        this.database.db
          .select({
            id: enquiries.id,
            data: enquiries.data,
            submittedAt: enquiries.submittedAt,
            ipAddress: enquiries.ipAddress,
            formTitle: forms.title,
            campaignName: campaigns.name,
          })
          .from(enquiries)
          .innerJoin(forms, eq(enquiries.formId, forms.id))
          .innerJoin(campaigns, eq(forms.campaignId, campaigns.id))
          .orderBy(desc(enquiries.submittedAt)),
        // Campaign statuses
        this.database.db
          .select({
            id: campaignStatuses.id,
            label: campaignStatuses.label,
            color: campaignStatuses.color,
            order: campaignStatuses.order,
            whatsappMessage: campaignStatuses.whatsappMessage,
            campaignName: campaigns.name,
          })
          .from(campaignStatuses)
          .innerJoin(campaigns, eq(campaignStatuses.campaignId, campaigns.id))
          .orderBy(desc(campaignStatuses.order)),
        // Followups
        this.database.db
          .select({
            id: followups.id,
            leadId: followups.leadId,
            status: followups.status,
            remarks: followups.remarks,
            nextCallDate: followups.nextCallDate,
            createdAt: followups.createdAt,
            leadName: leads.name,
            userName: users.name,
          })
          .from(followups)
          .innerJoin(leads, eq(followups.leadId, leads.id))
          .innerJoin(users, eq(followups.userId, users.id))
          .orderBy(desc(followups.createdAt)),
      ]);

    // Generate CSV contents
    const csvFiles = [
      { name: 'campaigns.csv', content: this.buildCampaignsCsv(campaignsData) },
      { name: 'leads.csv', content: this.buildLeadsCsv(leadsData) },
      { name: 'forms.csv', content: this.buildFormsCsv(formsData) },
      { name: 'form_responses.csv', content: this.buildFormResponsesCsv(formResponsesData) },
      { name: 'campaign_statuses.csv', content: this.buildCampaignStatusesCsv(statusesData) },
      { name: 'followups.csv', content: this.buildFollowupsCsv(followupsData) },
    ];

    // Create ZIP stream
    const passthrough = new PassThrough();
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(passthrough);

    for (const file of csvFiles) {
      archive.append(file.content, { name: file.name });
    }

    // Track size
    let totalSize = 0;
    archive.on('data', (chunk: Buffer) => {
      totalSize += chunk.length;
    });

    await archive.finalize();

    this.logger.log(`Export complete. Total files: ${csvFiles.length}`);
    return { stream: passthrough, size: totalSize };
  }

  async deleteAllCampaignData(): Promise<{
    deletedFollowups: number;
    deletedLeads: number;
    deletedEnquiries: number;
    deletedForms: number;
    deletedStatuses: number;
    deletedCampaignUsers: number;
    deletedCampaigns: number;
  }> {
    this.logger.warn('Starting full campaign data deletion');

    const result = await this.database.db.transaction(async (tx) => {
      // Delete in reverse dependency order
      // 1. Followups (depend on Leads)
      const deletedFollowups = await tx
        .delete(followups)
        .returning();

      // 2. Leads (depend on Campaigns, Enquiries, CampaignStatuses)
      const deletedLeads = await tx
        .delete(leads)
        .returning();

      // 3. Enquiries (depend on Forms)
      const deletedEnquiries = await tx
        .delete(enquiries)
        .returning();

      // 4. Forms (depend on Campaigns)
      const deletedForms = await tx
        .delete(forms)
        .returning();

      // 5. CampaignStatuses (depend on Campaigns)
      const deletedStatuses = await tx
        .delete(campaignStatuses)
        .returning();

      // 6. CampaignUsers (depend on Campaigns)
      const deletedCampaignUsers = await tx
        .delete(campaignUsers)
        .returning();

      // 7. Campaigns
      const deletedCampaigns = await tx
        .delete(campaigns)
        .returning();

      return {
        deletedFollowups: deletedFollowups.length,
        deletedLeads: deletedLeads.length,
        deletedEnquiries: deletedEnquiries.length,
        deletedForms: deletedForms.length,
        deletedStatuses: deletedStatuses.length,
        deletedCampaignUsers: deletedCampaignUsers.length,
        deletedCampaigns: deletedCampaigns.length,
      };
    });

    this.logger.warn(
      `Campaign data deletion complete: ${JSON.stringify(result)}`,
    );

    return result;
  }
}
