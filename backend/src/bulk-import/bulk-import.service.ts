import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Lead } from '@prisma/client';
import { parse } from 'csv-parse/sync';

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
      throw new BadRequestException('Invalid CSV format');
    }

    if (records.length === 0) {
      throw new BadRequestException('CSV file is empty');
    }

    // Get the first status for the campaign
    const firstStatus = await this.prisma.campaignStatus.findFirst({
      where: { campaignId },
      orderBy: { order: 'asc' },
    });

    const leads: Lead[] = [];
    for (const record of records) {
      const name = record.name || record.Name || record.contact_name || '';
      const email = record.email || record.Email || null;
      const phone = record.phone || record.Phone || record.contact_phone || null;

      if (!name) continue;

      const lead = await this.prisma.lead.create({
        data: {
          campaignId,
          name,
          email,
          phone,
          source: 'bulk',
          customData: record,
          statusId: firstStatus?.id || null,
        },
      });
      leads.push(lead);
    }

    if (allocateRoundRobin && leads.length > 0) {
      await this.allocateRoundRobin(campaignId, leads.map((l) => l.id));
    }

    // Re-fetch leads to get updated doerId after allocation
    const leadIds = leads.map((l) => l.id);
    const updatedLeads = await this.prisma.lead.findMany({
      where: { id: { in: leadIds } },
    });

    // Create initial followups for all leads
    const statusLabel = firstStatus?.label || 'New';
    for (const lead of updatedLeads) {
      if (lead.doerId) {
        await this.prisma.followup.create({
          data: {
            leadId: lead.id,
            userId: lead.doerId,
            status: statusLabel,
            remarks: 'Imported via bulk upload',
          },
        });
      }
    }

    return {
      imported: leads.length,
      total: records.length,
      leads: updatedLeads,
    };
  }

  async importFromJSON(campaignId: string, data: any[], allocateRoundRobin: boolean = true) {
    // Get the first status for the campaign
    const firstStatus = await this.prisma.campaignStatus.findFirst({
      where: { campaignId },
      orderBy: { order: 'asc' },
    });

    const leads: Lead[] = [];
    for (const record of data) {
      const name = record.name || record.Name || '';
      if (!name) continue;

      const lead = await this.prisma.lead.create({
        data: {
          campaignId,
          name,
          email: record.email || null,
          phone: record.phone || null,
          source: 'bulk',
          customData: record,
          statusId: firstStatus?.id || null,
        },
      });
      leads.push(lead);
    }

    if (allocateRoundRobin && leads.length > 0) {
      await this.allocateRoundRobin(campaignId, leads.map((l) => l.id));
    }

    // Re-fetch leads to get updated doerId after allocation
    const leadIds = leads.map((l) => l.id);
    const updatedLeads = await this.prisma.lead.findMany({
      where: { id: { in: leadIds } },
    });

    // Create initial followups for all leads
    const statusLabel = firstStatus?.label || 'New';
    for (const lead of updatedLeads) {
      if (lead.doerId) {
        await this.prisma.followup.create({
          data: {
            leadId: lead.id,
            userId: lead.doerId,
            status: statusLabel,
            remarks: 'Imported via bulk upload',
          },
        });
      }
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

    // Only assign to USER role (telecallers), not ADMIN or MANAGER
    const eligibleUsers = activeUsers.filter((au) => au.user?.role === 'USER');

    if (eligibleUsers.length === 0) {
      throw new BadRequestException('No telecaller users assigned to this campaign. Please assign USER role users before importing leads.');
    }

    // Find the last assigned user to continue from there
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

    for (let i = 0; i < leadIds.length; i++) {
      const userIndex = (startIndex + i) % eligibleUsers.length;
      await this.prisma.lead.update({
        where: { id: leadIds[i] },
        data: { doerId: eligibleUsers[userIndex].userId },
      });
    }
  }
}
