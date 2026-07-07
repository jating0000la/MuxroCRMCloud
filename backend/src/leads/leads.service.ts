import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Lead } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/pagination.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async findByCampaign(campaignId: string, userId?: string, role?: string, pagination?: PaginationDto) {
    const where: any = { campaignId };
    // USER: only see leads assigned to them
    if (role === 'USER' && userId) {
      where.doerId = userId;
    }
    // ✅ FIXED: Apply pagination with skip/take
    const skip = pagination?.getSkip() || 0;
    const take = pagination?.getTake() || 50;
    
    return this.prisma.lead.findMany({
      where,
      include: {
        doer: { select: { id: true, name: true, username: true } },
        status: true,
        followups: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { user: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async findOne(id: string, userId?: string, role?: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        doer: { select: { id: true, name: true, username: true } },
        status: true,
        campaign: { select: { id: true, name: true } },
        followups: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true, username: true } } },
        },
        enquiry: true,
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    // USER: can only view leads assigned to them
    if (role === 'USER' && userId && lead.doerId !== userId) {
      throw new ForbiddenException('You can only view leads assigned to you');
    }

    return lead;
  }

  async create(dto: CreateLeadDto, userId?: string, role?: string) {
    await this.ensureCampaignAccess(dto.campaignId, userId, role);

    // Auto-assign via round-robin if no doerId provided
    const doerId = dto.doerId || await this.getNextRoundRobinUser(dto.campaignId);

    // Get the first status if no statusId provided
    let statusId = dto.statusId;
    if (!statusId) {
      const firstStatus = await this.prisma.campaignStatus.findFirst({
        where: { campaignId: dto.campaignId },
        orderBy: { order: 'asc' },
      });
      statusId = firstStatus?.id || undefined;
    }

    const lead = await this.prisma.lead.create({
      data: {
        campaignId: dto.campaignId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        doerId,
        statusId,
        source: dto.source || 'manual',
        customData: dto.customData,
      },
    });

    // Auto-create initial followup so it appears in followup dashboard
    const statusLabel = statusId
      ? (await this.prisma.campaignStatus.findUnique({ where: { id: statusId } }))?.label || 'New'
      : 'New';
    await this.prisma.followup.create({
      data: {
        leadId: lead.id,
        userId: doerId,
        status: statusLabel,
        remarks: dto.source === 'form' ? 'Form submitted' : dto.source === 'bulk' ? 'Imported via bulk upload' : 'Lead created',
      },
    });

    return lead;
  }

  private async getNextRoundRobinUser(campaignId: string): Promise<string> {
    const activeUsers = await this.prisma.campaignUser.findMany({
      where: { campaignId, isActive: true },
      include: { user: { select: { role: true } } },
      orderBy: { assignedAt: 'asc' },
    });

    // Only assign to USER role (telecallers), not ADMIN or MANAGER
    const eligibleUsers = activeUsers.filter((au) => au.user?.role === 'USER');

    if (eligibleUsers.length === 0) {
      throw new BadRequestException('No telecaller users assigned to this campaign. Please assign USER role users before creating leads.');
    }

    const lastAssignedLead = await this.prisma.lead.findFirst({
      where: { campaignId, doerId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { doerId: true },
    });

    if (!lastAssignedLead?.doerId) {
      return eligibleUsers[0].userId;
    }

    const lastIndex = eligibleUsers.findIndex((u) => u.userId === lastAssignedLead.doerId);
    const nextIndex = (lastIndex + 1) % eligibleUsers.length;
    return eligibleUsers[nextIndex].userId;
  }

  async update(id: string, dto: UpdateLeadDto, userId?: string, role?: string) {
    const lead = await this.findOne(id, userId, role);
    // USER: can only edit leads assigned to them
    if (role === 'USER' && lead.doerId !== userId) {
      throw new ForbiddenException('You can only edit leads assigned to you');
    }
    return this.prisma.lead.update({ where: { id }, data: dto });
  }

  async updateStatus(id: string, dto: UpdateStatusDto, userId: string, role?: string) {
    const lead = await this.findOne(id, userId, role);
    // USER: can only update status for leads assigned to them
    if (role === 'USER' && lead.doerId !== userId) {
      throw new ForbiddenException('You can only update status for leads assigned to you');
    }

    const followup = await this.prisma.followup.create({
      data: {
        leadId: id,
        userId,
        status: dto.status,
        remarks: dto.remarks,
        nextCallDate: dto.nextCallDate ? new Date(dto.nextCallDate) : null,
      },
    });

    const leadUpdate: any = {};
    if (dto.statusId) leadUpdate.statusId = dto.statusId;
    if (dto.dnd !== undefined) leadUpdate.dnd = dto.dnd;

    await this.prisma.lead.update({ where: { id }, data: leadUpdate });

    return followup;
  }

  async findDnd(userId?: string, role?: string, pagination?: PaginationDto) {
    const where: any = { dnd: true };
    if (role === 'USER' && userId) {
      where.doerId = userId;
    }
    // ✅ FIXED: Apply pagination with skip/take
    const skip = pagination?.getSkip() || 0;
    const take = pagination?.getTake() || 50;
    
    return this.prisma.lead.findMany({
      where,
      include: {
        doer: { select: { id: true, name: true, username: true } },
        status: true,
        campaign: { select: { id: true, name: true } },
        followups: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { user: { select: { name: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
    });
  }

  async allocateRoundRobin(campaignId: string, leadIds: string[], userId?: string, role?: string) {
    await this.ensureCampaignAccess(campaignId, userId, role);

    const activeUsers = await this.prisma.campaignUser.findMany({
      where: { campaignId, isActive: true },
      include: { user: { select: { role: true } } },
      orderBy: { assignedAt: 'asc' },
    });

    // Only assign to USER role (telecallers), not ADMIN or MANAGER
    const eligibleUsers = activeUsers.filter((au) => au.user?.role === 'USER');

    if (eligibleUsers.length === 0) return { message: 'No telecaller users in campaign' };

    const allocations: Lead[] = [];
    for (let i = 0; i < leadIds.length; i++) {
      const userIndex = i % eligibleUsers.length;
      const updated = await this.prisma.lead.update({
        where: { id: leadIds[i] },
        data: { doerId: eligibleUsers[userIndex].userId },
      });
      allocations.push(updated);
    }

    return allocations;
  }

  async remove(id: string, userId?: string, role?: string) {
    const lead = await this.findOne(id, userId, role);
    if (role === 'USER') {
      throw new ForbiddenException('You cannot delete leads');
    }
    return this.prisma.lead.delete({ where: { id } });
  }

  async getStats(campaignId: string) {
    const total = await this.prisma.lead.count({ where: { campaignId } });
    const byStatus = await this.prisma.lead.groupBy({
      by: ['statusId'],
      where: { campaignId },
      _count: true,
    });
    return { total, byStatus };
  }

  private async ensureCampaignAccess(campaignId: string, userId?: string, role?: string) {
    // MANAGER role removed - only ADMIN and USER exist, no special access checks needed
    return;
  }
}
