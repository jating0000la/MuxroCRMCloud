import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { eq, asc } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { leads, followups, campaignStatuses } from '../db/schema';
import { parse } from 'csv-parse/sync';
import { BulkLeadRowSchema, sanitizeJson } from '../common/validation';
import { MAX_IMPORT_ROWS } from './dto/import-leads.dto';
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

    if (records.length > MAX_IMPORT_ROWS) throw new BadRequestException(`Maximum ${MAX_IMPORT_ROWS} rows allowed per import`);
    if (records.length === 0) {
      throw new BadRequestException('CSV file is empty');
    }

    this.logger.log(`CSV parsed: ${records.length} rows found`);

    const validatedRecords: any[] = [];
    for (let i = 0; i < records.length; i++) {
      try {
            // Normalize row to ensure name column exists with proper key for validation
            const normalizedRow = { ...records[i] };
            const nameKeys = ['name', 'Name', 'contact_name', 'full_name', 'customer_name', 'first_name', 'last_name'];
            const nameValue = nameKeys.find(key => normalizedRow[key] !== undefined);
        
            if (!nameValue) {
              throw new Error('No valid name column found. Expected one of: ' + nameKeys.join(', '));
            }
        
            const normalizedName = normalizedRow[nameValue];
        
            // Use exact field name (name) for validation to match BulkLeadRowSchema expectations
            const rowForValidation = {
              name: normalizedName,
              email: records[i].email || records[i].Email || '',
              phone: records[i].phone || records[i].Phone || records[i].contact_phone || '',
              source: 'bulk',
            };
        
            const validated = BulkLeadRowSchema.parse(rowForValidation);
        
            // Add original row data for customData preservation (before sanitization)
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

    return this.importValidatedRecords(campaignId, validatedRecords, allocateRoundRobin);
  }

  async importFromJSON(campaignId: string, data: any[], allocateRoundRobin: boolean = true) {
    if (!Array.isArray(data) || !data.length || data.length > MAX_IMPORT_ROWS) throw new BadRequestException(`Import between 1 and ${MAX_IMPORT_ROWS} rows`);
    const validatedRecords: any[] = [];
    for (let i = 0; i < data.length; i++) {
      try {
          const row = data[i];
          // Handle name column variations similar to CSV import
          const nameKeys = ['name', 'Name', 'contact_name', 'full_name', 'customer_name', 'first_name', 'last_name'];
          const nameValue = nameKeys.find(key => row[key] !== undefined);
        
          if (!nameValue) {
            throw new Error('No valid name column found. Expected one of: ' + nameKeys.join(', '));
          }
        
          const validated = BulkLeadRowSchema.parse({
            name: row[nameValue] || '',
            email: row.email || row.Email || '',
            phone: row.phone || row.Phone || '',
            source: 'bulk',
          });
          validatedRecords.push({
            ...validated,
            customData: sanitizeJson(row),
          });
        } catch (error) {
          throw new BadRequestException(
            `Invalid data in record ${i + 1}: ${error instanceof Error ? error.message : 'Validation failed'}`
          );
        }
      }

    return this.importValidatedRecords(campaignId, validatedRecords, allocateRoundRobin);
  }

  private async importValidatedRecords(campaignId: string, records: any[], allocate: boolean) {
    return this.database.db.transaction(async tx => {
      const [firstStatus] = await tx.select().from(campaignStatuses)
        .where(eq(campaignStatuses.campaignId, campaignId)).orderBy(asc(campaignStatuses.order)).limit(1);
      const imported: (typeof leads.$inferSelect)[] = [];
      for (let start = 0; start < records.length; start += BATCH_SIZE) {
        const created = await tx.insert(leads).values(records.slice(start, start + BATCH_SIZE).map(record => ({
          campaignId, name: record.name, email: record.email || null, phone: record.phone || null,
          source: 'bulk', customData: record.customData, statusId: firstStatus?.id || null,
        }))).returning();
        const assigned = allocate
          ? await this.roundRobinService.allocateRoundRobin(campaignId, created.map(lead => lead.id), tx)
          : created;
        imported.push(...assigned);
        const followupData = assigned.filter(lead => lead.doerId).map(lead => ({
          leadId: lead.id, userId: lead.doerId!, status: firstStatus?.label || 'New', remarks: 'Imported via bulk upload',
        }));
        if (followupData.length) await tx.insert(followups).values(followupData);
      }
      return { imported: imported.length, total: records.length, leads: imported };
    });
  }
}
