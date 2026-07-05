import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOverview(userId: string, role: string) {
    const campaignWhere: any = {};
    if (role === 'MANAGER') {
      campaignWhere.managerId = userId;
    } else if (role === 'USER') {
      campaignWhere.assignedUsers = { some: { userId, isActive: true } };
    }

    const totalCampaigns = await this.prisma.campaign.count({
      where: { ...campaignWhere, isActive: true },
    });

    const leadWhere: any = {};
    if (role === 'USER') {
      leadWhere.doerId = userId;
    }
    if (role === 'MANAGER') {
      leadWhere.campaign = { managerId: userId };
    }

    const totalLeads = await this.prisma.lead.count({ where: leadWhere });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayFollowups = await this.prisma.followup.count({
      where: {
        userId: role === 'USER' ? userId : undefined,
        nextCallDate: { gte: today },
      },
    });

    const totalUsers = role === 'ADMIN' ? await this.prisma.user.count({ where: { isActive: true } }) : 0;

    return {
      totalCampaigns,
      totalLeads,
      todayFollowups,
      totalUsers,
    };
  }

  async getCampaignStats(campaignId: string) {
    const totalLeads = await this.prisma.lead.count({ where: { campaignId } });

    const byStatus = await this.prisma.campaignStatus.findMany({
      where: { campaignId },
      include: { _count: { select: { leads: true } } },
      orderBy: { order: 'asc' },
    });

    const bySource = await this.prisma.lead.groupBy({
      by: ['source'],
      where: { campaignId },
      _count: true,
    });

    return {
      totalLeads,
      byStatus: byStatus.map((s) => ({ status: s.label, color: s.color, count: s._count.leads })),
      bySource: bySource.map((s) => ({ source: s.source, count: s._count })),
    };
  }

  async getFollowupDashboard(userId: string, role: string, campaignId?: string) {
    const where: any = {};

    if (role === 'USER') {
      where.userId = userId;
    }

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
            doer: { select: { id: true, name: true, username: true } },
          },
        },
        user: { select: { id: true, name: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllLeadsDashboard(userId: string, role: string, campaignId?: string) {
    const where: any = {};
    if (campaignId) where.campaignId = campaignId;

    if (role === 'USER') {
      where.doerId = userId;
    } else if (role === 'MANAGER') {
      where.campaign = { managerId: userId };
    }

    return this.prisma.lead.findMany({
      where,
      include: {
        campaign: { select: { id: true, name: true } },
        doer: { select: { id: true, name: true, username: true } },
        status: true,
        followups: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
