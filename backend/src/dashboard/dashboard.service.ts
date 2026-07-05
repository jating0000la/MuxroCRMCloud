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

  async getSalesFunnel(userId: string, role: string, campaignId?: string) {
    const leadWhere: any = {};
    if (role === 'USER') leadWhere.doerId = userId;
    if (role === 'MANAGER') leadWhere.campaign = { managerId: userId };
    if (campaignId) leadWhere.campaignId = campaignId;

    const totalLeads = await this.prisma.lead.count({ where: leadWhere });

    const contactedLeads = await this.prisma.lead.count({
      where: {
        ...leadWhere,
        followups: { some: {} },
      },
    });

    const statuses = await this.prisma.campaignStatus.findMany({
      where: campaignId ? { campaignId } : {},
      include: { _count: { select: { leads: true } } },
      orderBy: { order: 'asc' },
    });

    const statusFunnel = statuses.map((s) => ({
      status: s.label,
      color: s.color,
      count: s._count.leads,
      percentage: totalLeads > 0 ? Math.round((s._count.leads / totalLeads) * 100) : 0,
    }));

    const leadsWithStatus = await this.prisma.lead.count({
      where: {
        ...leadWhere,
        statusId: { not: null },
      },
    });

    const dndLeads = await this.prisma.lead.count({
      where: { ...leadWhere, dnd: true },
    });

    const conversionRate = totalLeads > 0 ? Math.round((leadsWithStatus / totalLeads) * 100) : 0;
    const contactRate = totalLeads > 0 ? Math.round((contactedLeads / totalLeads) * 100) : 0;

    return {
      totalLeads,
      contactedLeads,
      contactRate,
      leadsWithStatus,
      conversionRate,
      dndLeads,
      statusFunnel,
    };
  }

  async getUserConversion(userId: string, role: string, campaignId?: string) {
    const leadWhere: any = {};
    if (role === 'MANAGER') leadWhere.campaign = { managerId: userId };
    if (campaignId) leadWhere.campaignId = campaignId;

    const users = await this.prisma.user.findMany({
      where: { isActive: true, role: 'USER' },
      select: { id: true, name: true, username: true },
    });

    const userStats = await Promise.all(
      users.map(async (user) => {
        const userLeadWhere: any = { ...leadWhere, doerId: user.id };

        const totalLeads = await this.prisma.lead.count({ where: userLeadWhere });

        const contactedLeads = await this.prisma.lead.count({
          where: { ...userLeadWhere, followups: { some: {} } },
        });

        const leadsWithStatus = await this.prisma.lead.count({
          where: { ...userLeadWhere, statusId: { not: null } },
        });

        const convertedLeads = await this.prisma.lead.count({
          where: {
            ...userLeadWhere,
            status: { is: { label: { contains: 'convert', mode: 'insensitive' } } },
          },
        });

        const dndLeads = await this.prisma.lead.count({
          where: { ...userLeadWhere, dnd: true },
        });

        return {
          userId: user.id,
          name: user.name,
          username: user.username,
          totalLeads,
          contactedLeads,
          contactRate: totalLeads > 0 ? Math.round((contactedLeads / totalLeads) * 100) : 0,
          leadsWithStatus,
          qualifiedRate: totalLeads > 0 ? Math.round((leadsWithStatus / totalLeads) * 100) : 0,
          convertedLeads,
          conversionRate: totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0,
          dndLeads,
        };
      }),
    );

    return userStats.sort((a, b) => b.conversionRate - a.conversionRate);
  }
}
