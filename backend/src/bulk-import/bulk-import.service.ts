import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parse } from 'csv-parse/sync';
import { BulkLeadRowSchema, sanitizeJson } from '../common/validation';

@Injectable()
export class BulkImportService {
  constructor(private prisma: PrismaService) {}

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

    const firstStatus = await this.prisma.campaignStatus.findFirst({
      where: { campaignId },
      orderBy: { order: 'asc' },
    });

    // Batch insert with createMany (single query instead of N)
    await this.prisma.lead.createMany({
      data: validatedRecords.map((record) => ({
        campaignId,
        name: record.name,
        email: record.email || null,
        phone: record.phone || null,
        source: 'bulk',
        customData: record.customData,
        statusId: firstStatus?.id || null,
      })),
    });

    // Fetch all leads for this campaign (just created)
    const leads = await this.prisma.lead.findMany({
      where: { campaignId, source: 'bulk' },
      orderBy: { createdAt: 'asc' },
    });

    if (allocateRoundRobin && leads.length > 0) {
      await this.allocateRoundRobin(campaignId, leads.map((l) => l.id));
    }

    // Re-fetch leads to get updated doerId after allocation
    const leadIds = leads.map((l) => l.id);
    const updatedLeads = await this.prisma.lead.findMany({
      where: { id: { in: leadIds } },
    });

    // Batch create followups with createMany
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
      await this.prisma.followup.createMany({ data: followupData });
    }

    return {
      imported: leads.length,
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

    const firstStatus = await this.prisma.campaignStatus.findFirst({
      where: { campaignId },
      orderBy: { order: 'asc' },
    });

    // Batch insert with createMany
    await this.prisma.lead.createMany({
      data: validatedRecords.map((record) => ({
        campaignId,
        name: record.name,
        email: record.email || null,
        phone: record.phone || null,
        source: 'bulk',
        customData: record.customData,
        statusId: firstStatus?.id || null,
      })),
    });

    const leads = await this.prisma.lead.findMany({
      where: { campaignId, source: 'bulk' },
      orderBy: { createdAt: 'asc' },
    });

    if (allocateRoundRobin && leads.length > 0) {
      await this.allocateRoundRobin(campaignId, leads.map((l) => l.id));
    }

    const leadIds = leads.map((l) => l.id);
    const updatedLeads = await this.prisma.lead.findMany({
      where: { id: { in: leadIds } },
    });

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
      await this.prisma.followup.createMany({ data: followupData });
    }

    return {
      imported: leads.length,
      total: data.length,
      leads: updatedLeads,
    };
  }

  private async allocateRoundRobin(campaignId: string, leadIds: string[]) {
    const activeUsers = await this.prisma.campaignUser.findMany({
      where: { campaignId, isActive: true },
      include: { user: { select: { role: true } } },
      orderBy: { assignedAt: 'asc' },
    });

    const eligibleUsers = activeUsers.filter((au) => au.user?.role === 'USER');

    if (eligibleUsers.length === 0) {
      throw new BadRequestException('No telecaller users assigned to this campaign. Please assign USER role users before importing leads.');
    }

    const lastAssignedLead = await this.prisma.lead.findFirst({
      where: { campaignId, doerId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { doerId: true },
    });

    let startIndex = 0;
    if (lastAssignedLead?.doerId) {
      const lastIndex = eligibleUsers.findIndex((u) => u.userId === lastAssignedLead.doerId);
      if (lastIndex !== -1) {
        startIndex = (lastIndex + 1) % eligibleUsers.length;
      }
    }

    // Batch update doerId with createMany-style update
    const updates = leadIds.map((id, i) => {
      const userIndex = (startIndex + i) % eligibleUsers.length;
      return this.prisma.lead.update({
        where: { id },
        data: { doerId: eligibleUsers[userIndex].userId },
      });
    });

    await this.prisma.$transaction(updates);
  }
}
