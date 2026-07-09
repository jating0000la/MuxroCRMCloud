import { Injectable, BadRequestException } from '@nestjs/common';
import { eq, and, ne, desc, asc, sql, inArray } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { leads, followups, campaignStatuses, campaignUsers, users } from '../db/schema';
import { parse } from 'csv-parse/sync';
import { BulkLeadRowSchema, sanitizeJson } from '../common/validation';

@Injectable()
export class BulkImportService {
  constructor(private database: DatabaseService) {}

  async importFromCSV(campaignId: string, fileBuffer: Buffer, allocateRoundRobin: boolean = true) {
    let records: any[];
    try {
      records = parse(fileBuffer.toString(), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (error) {
      throw new BadRequestException(`Invalid CSV format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (records.length === 0) {
      throw new BadRequestException('CSV file is empty');
    }

    const validatedRecords: any[] = [];
    for (let i = 0; i < records.length; i++) {
      try {
        const validated = BulkLeadRowSchema.parse({
          name: records[i].name || records[i].Name || records[i].contact_name || '',
          email: records[i].email || records[i].Email || '',
          phone: records[i].phone || records[i].Phone || records[i].contact_phone || '',
          source: 'bulk',
        });
        validatedRecords.push({
          ...validated,
          customData: sanitizeJson(records[i]),
        });
      } catch (error) {
        throw new BadRequestException(
          `Invalid data in row ${i + 1}: ${error instanceof Error ? error.message : 'Validation failed'}`
        );
      }
    }

    const [firstStatus] = await this.database.db
      .select()
      .from(campaignStatuses)
      .where(eq(campaignStatuses.campaignId, campaignId))
      .orderBy(asc(campaignStatuses.order))
      .limit(1);

    // Batch insert — use .returning() to get only the newly inserted lead IDs
    const newLeads = await this.database.db.insert(leads).values(
      validatedRecords.map((record) => ({
        campaignId,
        name: record.name,
        email: record.email || null,
        phone: record.phone || null,
        source: 'bulk',
        customData: record.customData,
        statusId: firstStatus?.id || null,
      })),
    ).returning();

    if (allocateRoundRobin && newLeads.length > 0) {
      await this.allocateRoundRobin(campaignId, newLeads.map((l) => l.id));
    }

    // Re-fetch new leads to get updated doerId after allocation
    const newLeadIds = newLeads.map((l) => l.id);
    const updatedLeads = await this.database.db
      .select()
      .from(leads)
      .where(inArray(leads.id, newLeadIds));

    // Batch create followups for newly imported leads only
    const statusLabel = firstStatus?.label || 'New';
    const followupData = updatedLeads
      .filter((lead) => lead.doerId)
      .map((lead) => ({
        leadId: lead.id,
        userId: lead.doerId!,
        status: statusLabel,
        remarks: 'Imported via bulk upload',
      }));

    if (followupData.length > 0) {
      await this.database.db.insert(followups).values(followupData);
    }

    return {
      imported: newLeads.length,
      total: validatedRecords.length,
      leads: updatedLeads,
    };
  }

  async importFromJSON(campaignId: string, data: any[], allocateRoundRobin: boolean = true) {
    const validatedRecords: any[] = [];
    for (let i = 0; i < data.length; i++) {
      try {
        const validated = BulkLeadRowSchema.parse({
          name: data[i].name || data[i].Name || '',
          email: data[i].email || data[i].Email || '',
          phone: data[i].phone || data[i].Phone || '',
          source: 'bulk',
        });
        validatedRecords.push({
          ...validated,
          customData: sanitizeJson(data[i]),
        });
      } catch (error) {
        throw new BadRequestException(
          `Invalid data in record ${i + 1}: ${error instanceof Error ? error.message : 'Validation failed'}`
        );
      }
    }

    const [firstStatus] = await this.database.db
      .select()
      .from(campaignStatuses)
      .where(eq(campaignStatuses.campaignId, campaignId))
      .orderBy(asc(campaignStatuses.order))
      .limit(1);

    // Batch insert — use .returning() to get only the newly inserted lead IDs
    const newLeads = await this.database.db.insert(leads).values(
      validatedRecords.map((record) => ({
        campaignId,
        name: record.name,
        email: record.email || null,
        phone: record.phone || null,
        source: 'bulk',
        customData: record.customData,
        statusId: firstStatus?.id || null,
      })),
    ).returning();

    if (allocateRoundRobin && newLeads.length > 0) {
      await this.allocateRoundRobin(campaignId, newLeads.map((l) => l.id));
    }

    const newLeadIds = newLeads.map((l) => l.id);
    const updatedLeads = await this.database.db
      .select()
      .from(leads)
      .where(inArray(leads.id, newLeadIds));

    const statusLabel = firstStatus?.label || 'New';
    const followupData = updatedLeads
      .filter((lead) => lead.doerId)
      .map((lead) => ({
        leadId: lead.id,
        userId: lead.doerId!,
        status: statusLabel,
        remarks: 'Imported via bulk upload',
      }));

    if (followupData.length > 0) {
      await this.database.db.insert(followups).values(followupData);
    }

    return {
      imported: newLeads.length,
      total: data.length,
      leads: updatedLeads,
    };
  }

  private async allocateRoundRobin(campaignId: string, leadIds: string[]) {
    const activeUsers = await this.database.db
      .select({
        userId: campaignUsers.userId,
        role: users.role,
      })
      .from(campaignUsers)
      .innerJoin(users, eq(campaignUsers.userId, users.id))
      .where(and(eq(campaignUsers.campaignId, campaignId), eq(campaignUsers.isActive, true)))
      .orderBy(asc(campaignUsers.assignedAt));

    const eligibleUsers = activeUsers.filter((au) => au.role === 'USER');

    if (eligibleUsers.length === 0) {
      throw new BadRequestException('No telecaller users assigned to this campaign. Please assign USER role users before importing leads.');
    }

    const [lastAssignedLead] = await this.database.db
      .select({ doerId: leads.doerId })
      .from(leads)
      .where(and(eq(leads.campaignId, campaignId), sql`${leads.doerId} IS NOT NULL`))
      .orderBy(desc(leads.createdAt))
      .limit(1);

    let startIndex = 0;
    if (lastAssignedLead?.doerId) {
      const lastIndex = eligibleUsers.findIndex((u) => u.userId === lastAssignedLead.doerId);
      if (lastIndex !== -1) {
        startIndex = (lastIndex + 1) % eligibleUsers.length;
      }
    }

    // Batch update doerId
    for (let i = 0; i < leadIds.length; i++) {
      const userIndex = (startIndex + i) % eligibleUsers.length;
      await this.database.db
        .update(leads)
        .set({ doerId: eligibleUsers[userIndex].userId })
        .where(eq(leads.id, leadIds[i]));
    }
  }
}
