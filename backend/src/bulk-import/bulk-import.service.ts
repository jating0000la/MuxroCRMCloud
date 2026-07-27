import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { leads, followups, campaignStatuses } from '../db/schema';
import { parse } from 'csv-parse/sync';
import { BulkLeadRowSchema, sanitizeJson } from '../common/validation';
import { RoundRobinService } from '../common/services/round-robin.service';

const BATCH_SIZE = 200; // Rows per batch to avoid PostgreSQL 65,535 bind parameter limit

@Injectable()
export class BulkImportService {
  private readonly logger = new Logger(BulkImportService.name);

  constructor(
    private database: DatabaseService,
    private roundRobinService: RoundRobinService,
  ) {}

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

    this.logger.log(`CSV parsed: ${records.length} rows found`);

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

    // Insert in batches to avoid PostgreSQL 65,535 bind parameter limit
    const allNewLeads: any[] = [];
    const totalBatches = Math.ceil(validatedRecords.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, validatedRecords.length);
      const batch = validatedRecords.slice(start, end);

      this.logger.log(`Inserting batch ${batchIndex + 1}/${totalBatches} (${batch.length} rows)`);

      const newLeads = await this.database.db.insert(leads).values(
        batch.map((record) => ({
          campaignId,
          name: record.name,
          email: record.email || null,
          phone: record.phone || null,
          source: 'bulk',
          customData: record.customData,
          statusId: firstStatus?.id || null,
        })),
      ).returning();

      allNewLeads.push(...newLeads);
    }

    this.logger.log(`Total leads inserted: ${allNewLeads.length}`);

    if (allocateRoundRobin && allNewLeads.length > 0) {
      // Allocate round-robin in batches too
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, allNewLeads.length);
        const batchLeadIds = allNewLeads.slice(start, end).map((l) => l.id);
        await this.roundRobinService.allocateRoundRobin(campaignId, batchLeadIds);
      }
    }

    // Re-fetch new leads to get updated doerId after allocation
    const allNewLeadIds = allNewLeads.map((l) => l.id);
    const updatedLeads: any[] = [];
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, allNewLeadIds.length);
      const batchIds = allNewLeadIds.slice(start, end);
      const batch = await this.database.db
        .select()
        .from(leads)
        .where(inArray(leads.id, batchIds));
      updatedLeads.push(...batch);
    }

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

    // Insert followups in batches too
    for (let batchIndex = 0; batchIndex < Math.ceil(followupData.length / BATCH_SIZE); batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, followupData.length);
      const batch = followupData.slice(start, end);
      if (batch.length > 0) {
        await this.database.db.insert(followups).values(batch);
      }
    }

    return {
      imported: allNewLeads.length,
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

    // Insert in batches to avoid PostgreSQL 65,535 bind parameter limit
    const allNewLeads: any[] = [];
    const totalBatches = Math.ceil(validatedRecords.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, validatedRecords.length);
      const batch = validatedRecords.slice(start, end);

      const newLeads = await this.database.db.insert(leads).values(
        batch.map((record) => ({
          campaignId,
          name: record.name,
          email: record.email || null,
          phone: record.phone || null,
          source: 'bulk',
          customData: record.customData,
          statusId: firstStatus?.id || null,
        })),
      ).returning();

      allNewLeads.push(...newLeads);
    }

    if (allocateRoundRobin && allNewLeads.length > 0) {
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, allNewLeads.length);
        const batchLeadIds = allNewLeads.slice(start, end).map((l) => l.id);
        await this.roundRobinService.allocateRoundRobin(campaignId, batchLeadIds);
      }
    }

    const allNewLeadIds = allNewLeads.map((l) => l.id);
    const updatedLeads: any[] = [];
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, allNewLeadIds.length);
      const batchIds = allNewLeadIds.slice(start, end);
      const batch = await this.database.db
        .select()
        .from(leads)
        .where(inArray(leads.id, batchIds));
      updatedLeads.push(...batch);
    }

    const statusLabel = firstStatus?.label || 'New';
    const followupData = updatedLeads
      .filter((lead) => lead.doerId)
      .map((lead) => ({
        leadId: lead.id,
        userId: lead.doerId!,
        status: statusLabel,
        remarks: 'Imported via bulk upload',
      }));

    for (let batchIndex = 0; batchIndex < Math.ceil(followupData.length / BATCH_SIZE); batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, followupData.length);
      const batch = followupData.slice(start, end);
      if (batch.length > 0) {
        await this.database.db.insert(followups).values(batch);
      }
    }

    return {
      imported: allNewLeads.length,
      total: validatedRecords.length,
      leads: updatedLeads,
    };
  }
}
