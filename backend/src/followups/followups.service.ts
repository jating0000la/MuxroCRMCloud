import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaginationDto } from '../common/pagination.dto';
import { CreateFollowupDto } from './dto/create-followup.dto';
import { UpdateFollowupDto } from './dto/update-followup.dto';

@Injectable()
export class FollowupsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async findByLead(leadId: string, userId?: string, role?: string) {
    if (role === 'USER' && userId) {
      const lead = await this.prisma.lead.findUnique({
        where: { id: leadId },
        select: { doerId: true },
      });

      if (!lead || lead.doerId !== userId) {
        throw new NotFoundException('Lead not found');
      }
    }

    return this.prisma.followup.findMany({
      where: { leadId },
      include: { user: { select: { id: true, name: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateFollowupDto, userId: string) {
    const followup = await this.prisma.followup.create({
      data: {
        leadId: dto.leadId,
        userId,
        status: dto.status,
        remarks: dto.remarks,
        nextCallDate: dto.nextCallDate ? new Date(dto.nextCallDate) : null,
      },
      include: { user: { select: { name: true } } },
    });

    // Create notification for this followup
    await this.notificationsService.createNotificationForFollowup(userId, followup.id);

    return followup;
  }

  async getMyFollowups(userId: string, campaignId?: string, pagination?: PaginationDto) {
    const where: any = { userId };
    if (campaignId) {
      where.lead = { campaignId };
    }
    // ✅ FIXED: Apply pagination with skip/take
    const skip = pagination?.getSkip() || 0;
    const take = pagination?.getTake() || 50;
    
    return this.prisma.followup.findMany({
      where,
      include: {
        lead: {
          include: {
            campaign: { select: { id: true, name: true } },
            status: true,
            doer: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async getUpcomingFollowups(userId: string, campaignId?: string) {
    const where: any = {
      userId,
      nextCallDate: { gte: new Date() },
    };
    if (campaignId) {
      where.lead = { campaignId };
    }
    return this.prisma.followup.findMany({
      where,
      include: {
        lead: {
          include: {
            campaign: { select: { id: true, name: true } },
            status: true,
          },
        },
      },
      orderBy: { nextCallDate: 'asc' },
    });
  }

  async findOne(id: string, userId?: string, role?: string) {
    const followup = await this.prisma.followup.findUnique({
      where: { id },
      include: {
        lead: { select: { doerId: true } },
        user: { select: { name: true } },
      },
    });
    if (!followup) throw new NotFoundException('Followup not found');

    if (role === 'USER' && userId && followup.lead?.doerId !== userId) {
      throw new NotFoundException('Followup not found');
    }

    return followup;
  }

  async update(id: string, dto: UpdateFollowupDto, userId?: string, role?: string) {
    const followup = await this.findOne(id, userId, role);

    const updated = await this.prisma.followup.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.remarks !== undefined && { remarks: dto.remarks }),
        ...(dto.nextCallDate !== undefined && {
          nextCallDate: dto.nextCallDate ? new Date(dto.nextCallDate) : null,
        }),
      },
      include: { user: { select: { name: true } } },
    });

    // Update notification for this followup
    await this.notificationsService.createNotificationForFollowup(
      followup.userId,
      id,
    );

    return updated;
  }

  async remove(id: string, userId?: string, role?: string) {
    await this.findOne(id, userId, role);

    return this.prisma.followup.delete({ where: { id } });
  }

  async findCrossCampaign(phone?: string, email?: string, excludeLeadId?: string, userId?: string, role?: string) {
    if (!phone && !email) return [];

    const orConditions: any[] = [];
    if (phone) {
      const normalized = phone.replace(/\D/g, '');
      orConditions.push({ phone: normalized });
      orConditions.push({ phone: { contains: normalized } });
    }
    if (email) {
      orConditions.push({ email: email.toLowerCase() });
    }

    const leads = await this.prisma.lead.findMany({
      where: {
        ...(excludeLeadId ? { id: { not: excludeLeadId } } : {}),
        ...(role === 'USER' && userId ? { doerId: userId } : {}),
        OR: orConditions,
      },
      select: { id: true, name: true, campaignId: true },
    });

    if (leads.length === 0) return [];

    const leadIds = leads.map((l) => l.id);
    const leadMap = new Map(leads.map((l) => [l.id, l]));

    const followups = await this.prisma.followup.findMany({
      where: { leadId: { in: leadIds } },
      include: {
        user: { select: { id: true, name: true, username: true } },
        lead: {
          include: {
            campaign: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return followups.map((f) => ({
      ...f,
      crossCampaign: true,
      matchedLead: leadMap.get(f.leadId),
    }));
  }
}
