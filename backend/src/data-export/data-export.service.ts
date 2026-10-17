import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
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
  whatsappMessages,
  whatsappContacts,
  ivrCalls,
  ivrWebhookEvents,
} from '../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { ZipArchive } from 'archiver';
import { PassThrough } from 'stream';

/**
 * Escape a value for CSV output. Wraps in double-quotes if the value contains
 * a comma, double-quote, or newline — otherwise returns as-is.
 */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  const str = /^[=+\-@\t\r\n]/.test(raw) ? `'${raw}` : raw;
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

  async generateExportZip(): Promise<{ stream: PassThrough }> {
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
    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on('error', error => passthrough.destroy(error));
    passthrough.on('close', () => { if (!archive.destroyed) archive.abort(); });

    archive.pipe(passthrough);

    for (const file of csvFiles) {
      archive.append(file.content, { name: file.name });
    }

    // Return before finalization so the HTTP consumer can drain the stream.
    // Awaiting finalize here deadlocks when an archive fills the stream buffer.
    void archive.finalize().catch(error => passthrough.destroy(error));
    this.logger.log(`Export started. Total files: ${csvFiles.length}`);
    return { stream: passthrough };
  }

  async deleteAllCampaignData(confirmation: string) {
    if (confirmation !== 'DELETE ALL') throw new BadRequestException('Confirm deletion with DELETE ALL');
    return this.database.db.transaction(async tx => {
      // Same advisory key as BackupService: excludes backup, restore and deletion.
      const result = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(1465078355) AS acquired`);
      if (!(result.rows[0] as { acquired: boolean }).acquired) {
        throw new ConflictException('Another backup, restore, or deletion is already running');
      }
      // Remove durable callbacks before their leads so no queued intake remains
      // to recreate data after this deletion commits.
      const deletedIvrEvents = (await tx.delete(ivrWebhookEvents)).rowCount || 0;
      const deletedIvrCalls = (await tx.delete(ivrCalls)).rowCount || 0;
      const deletedMessages = (await tx.delete(whatsappMessages)).rowCount || 0;
      const deletedContacts = (await tx.delete(whatsappContacts)).rowCount || 0;
      const deletedFollowups = (await tx.delete(followups)).rowCount || 0;
      const deletedLeads = (await tx.delete(leads)).rowCount || 0;
      const deletedEnquiries = (await tx.delete(enquiries)).rowCount || 0;
      const deletedForms = (await tx.delete(forms)).rowCount || 0;
      const deletedStatuses = (await tx.delete(campaignStatuses)).rowCount || 0;
      const deletedCampaignUsers = (await tx.delete(campaignUsers)).rowCount || 0;
      const deletedCampaigns = (await tx.delete(campaigns)).rowCount || 0;
      return { deletedIvrEvents, deletedIvrCalls, deletedMessages, deletedContacts, deletedFollowups, deletedLeads, deletedEnquiries,
        deletedForms, deletedStatuses, deletedCampaignUsers, deletedCampaigns };
    });
  }
}
