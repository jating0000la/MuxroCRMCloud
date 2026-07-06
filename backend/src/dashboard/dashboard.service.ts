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

  async getUserConversion(userId: string, role: string, campaignId?: string, startDate?: string, endDate?: string) {
    const leadWhere: any = {};
    if (role === 'MANAGER') leadWhere.campaign = { managerId: userId };
    if (campaignId) leadWhere.campaignId = campaignId;

    if (startDate || endDate) {
      const createdAt: any = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        createdAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        createdAt.lte = end;
      }
      leadWhere.createdAt = createdAt;
    }

    // ✅ OPTIMIZED: Use database aggregation instead of N+1 queries
    // Get all active users first (small dataset)
    const users = await this.prisma.user.findMany({
      where: { isActive: true, role: 'USER' },
      select: { id: true, name: true, username: true },
    });

    // Get all aggregated stats in ONE query using groupBy
    const leadStats = await this.prisma.lead.groupBy({
      by: ['doerId'],
      where: leadWhere,
      _count: {
        id: true,
      },
    });

    const leadStatsMap = new Map(
      leadStats.map((stat) => [stat.doerId, stat._count.id]),
    );

    // Get contacted leads (has followups)
    const contactedLeads = await this.prisma.lead.groupBy({
      by: ['doerId'],
      where: { ...leadWhere, followups: { some: {} } },
      _count: { id: true },
    });

    const contactedLeadsMap = new Map(
      contactedLeads.map((stat) => [stat.doerId, stat._count.id]),
    );

    // Get qualified leads (has status)
    const qualifiedLeads = await this.prisma.lead.groupBy({
      by: ['doerId'],
      where: { ...leadWhere, statusId: { not: null } },
      _count: { id: true },
    });

    const qualifiedLeadsMap = new Map(
      qualifiedLeads.map((stat) => [stat.doerId, stat._count.id]),
    );

    // Get converted leads
    const convertedLeads = await this.prisma.lead.groupBy({
      by: ['doerId'],
      where: {
        ...leadWhere,
        status: { is: { label: { contains: 'convert', mode: 'insensitive' } } },
      },
      _count: { id: true },
    });

    const convertedLeadsMap = new Map(
      convertedLeads.map((stat) => [stat.doerId, stat._count.id]),
    );

    // Get DND leads
    const dndLeads = await this.prisma.lead.groupBy({
      by: ['doerId'],
      where: { ...leadWhere, dnd: true },
      _count: { id: true },
    });

    const dndLeadsMap = new Map(
      dndLeads.map((stat) => [stat.doerId, stat._count.id]),
    );

    // Calculate stats from aggregated data (no N+1)
    const userStats = users.map((user) => {
      const totalLeads = leadStatsMap.get(user.id) || 0;
      const contacted = contactedLeadsMap.get(user.id) || 0;
      const qualified = qualifiedLeadsMap.get(user.id) || 0;
      const converted = convertedLeadsMap.get(user.id) || 0;
      const dnd = dndLeadsMap.get(user.id) || 0;

      return {
        userId: user.id,
        name: user.name,
        username: user.username,
        totalLeads,
        contactedLeads: contacted,
        contactRate: totalLeads > 0 ? Math.round((contacted / totalLeads) * 100) : 0,
        leadsWithStatus: qualified,
        qualifiedRate: totalLeads > 0 ? Math.round((qualified / totalLeads) * 100) : 0,
        convertedLeads: converted,
        conversionRate: totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0,
        dndLeads: dnd,
      };
    });

    return userStats.sort((a, b) => b.conversionRate - a.conversionRate);
  }
}
