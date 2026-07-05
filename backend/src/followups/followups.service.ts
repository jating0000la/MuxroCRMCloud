import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFollowupDto } from './dto/create-followup.dto';
import { UpdateFollowupDto } from './dto/update-followup.dto';

@Injectable()
export class FollowupsService {
  constructor(private prisma: PrismaService) {}

  async findByLead(leadId: string) {
    return this.prisma.followup.findMany({
      where: { leadId },
      include: { user: { select: { id: true, name: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateFollowupDto, userId: string) {
    return this.prisma.followup.create({
      data: {
        leadId: dto.leadId,
        userId,
        status: dto.status,
        remarks: dto.remarks,
        nextCallDate: dto.nextCallDate ? new Date(dto.nextCallDate) : null,
      },
      include: { user: { select: { name: true } } },
    });
  }

  async getMyFollowups(userId: string, campaignId?: string) {
    const where: any = { userId };
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
            doer: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
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

  async findOne(id: string) {
    const followup = await this.prisma.followup.findUnique({
      where: { id },
      include: {
        lead: true,
        user: { select: { name: true } },
      },
    });
    if (!followup) throw new NotFoundException('Followup not found');
    return followup;
  }

  async update(id: string, dto: UpdateFollowupDto) {
    const followup = await this.prisma.followup.findUnique({ where: { id } });
    if (!followup) throw new NotFoundException('Followup not found');

    return this.prisma.followup.update({
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
  }

  async remove(id: string) {
    const followup = await this.prisma.followup.findUnique({ where: { id } });
    if (!followup) throw new NotFoundException('Followup not found');

    return this.prisma.followup.delete({ where: { id } });
  }
}
