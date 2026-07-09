import { Injectable } from '@nestjs/common';
import { eq, and, inArray, desc, asc, sql, ilike, count } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import {
  campaigns,
  leads,
  followups,
  users,
  campaignStatuses,
  campaignUsers,
} from '../db/schema';

@Injectable()
export class DashboardService {
  constructor(private database: DatabaseService) {}

  async getOverview(userId: string, role: string) {
    let totalCampaigns = 0;
    if (role === 'USER') {
      const assignedCampaignIds = this.database.db
        .select({ campaignId: campaignUsers.campaignId })
        .from(campaignUsers)
        .where(and(eq(campaignUsers.userId, userId), eq(campaignUsers.isActive, true)));

      const [{ total }] = await this.database.db
        .select({ total: sql<number>`count(*)::int` })
        .from(campaigns)
        .where(and(inArray(campaigns.id, assignedCampaignIds), eq(campaigns.isActive, true)));
      totalCampaigns = total;
    } else {
      const [{ total }] = await this.database.db
        .select({ total: sql<number>`count(*)::int` })
        .from(campaigns)
        .where(eq(campaigns.isActive, true));
      totalCampaigns = total;
    }

    const leadConditions: any[] = [];
    if (role === 'USER') {
      leadConditions.push(eq(leads.doerId, userId));
    }
    const [{ totalLeads }] = await this.database.db
      .select({ totalLeads: sql<number>`count(*)::int` })
      .from(leads)
      .where(leadConditions.length > 0 ? and(...leadConditions) : undefined);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const followupConditions: any[] = [sql`${followups.nextCallDate} >= ${today}`];
    if (role === 'USER') {
      followupConditions.push(eq(followups.userId, userId));
    }
    const [{ todayFollowups }] = await this.database.db
      .select({ todayFollowups: sql<number>`count(*)::int` })
      .from(followups)
      .where(and(...followupConditions));

    let totalUsers = 0;
    if (role === 'ADMIN') {
      const [{ total }] = await this.database.db
        .select({ total: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.isActive, true));
      totalUsers = total;
    }

    return { totalCampaigns, totalLeads, todayFollowups, totalUsers };
  }

  async getCampaignStats(campaignId: string) {
    const [{ totalLeads }] = await this.database.db
      .select({ totalLeads: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.campaignId, campaignId));

    const byStatusResults = await this.database.db
      .select({
        label: campaignStatuses.label,
        color: campaignStatuses.color,
        count: sql<number>`count(${leads.id})::int`,
      })
      .from(campaignStatuses)
      .leftJoin(leads, eq(campaignStatuses.id, leads.statusId))
      .where(eq(campaignStatuses.campaignId, campaignId))
      .groupBy(campaignStatuses.id, campaignStatuses.label, campaignStatuses.color)
      .orderBy(asc(campaignStatuses.order));

    const bySourceResults = await this.database.db
      .select({
        source: leads.source,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(eq(leads.campaignId, campaignId))
      .groupBy(leads.source);

    return {
      totalLeads,
      byStatus: byStatusResults,
      bySource: bySourceResults,
    };
  }

  async getFollowupDashboard(userId: string, role: string, campaignId?: string) {
    const conditions: any[] = [];
    if (role === 'USER') {
      conditions.push(eq(followups.userId, userId));
    }

    let results;
    if (campaignId) {
      results = await this.database.db
        .select({
          followup: followups,
          lead: {
            ...leads,
            campaign: {
              id: campaigns.id,
              name: campaigns.name,
            },
            status: campaignStatuses,
            doer: {
              id: users.id,
              name: users.name,
              username: users.username,
            },
          },
          user: {
            id: users.id,
            name: users.name,
            username: users.username,
          },
        })
        .from(followups)
        .innerJoin(leads, eq(followups.leadId, leads.id))
        .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
        .leftJoin(campaignStatuses, eq(leads.statusId, campaignStatuses.id))
        .leftJoin(users, eq(followups.userId, users.id))
        .where(and(eq(leads.campaignId, campaignId), ...(conditions.length > 0 ? conditions : [])))
        .orderBy(desc(followups.createdAt));
    } else {
      results = await this.database.db
        .select({
          followup: followups,
          lead: {
            ...leads,
            campaign: {
              id: campaigns.id,
              name: campaigns.name,
            },
            status: campaignStatuses,
            doer: {
              id: users.id,
              name: users.name,
              username: users.username,
            },
          },
          user: {
            id: users.id,
            name: users.name,
            username: users.username,
          },
        })
        .from(followups)
        .innerJoin(leads, eq(followups.leadId, leads.id))
        .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
        .leftJoin(campaignStatuses, eq(leads.statusId, campaignStatuses.id))
        .leftJoin(users, eq(followups.userId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(followups.createdAt));
    }

    return results.map((r) => ({
      ...r.followup,
      lead: r.lead,
      user: r.user,
    }));
  }

  async getAllLeadsDashboard(userId: string, role: string, campaignId?: string) {
    const conditions: any[] = [];
    if (campaignId) conditions.push(eq(leads.campaignId, campaignId));
    if (role === 'USER') conditions.push(eq(leads.doerId, userId));

    const results = await this.database.db
      .select({
        lead: leads,
        campaign: {
          id: campaigns.id,
          name: campaigns.name,
        },
        doer: {
          id: users.id,
          name: users.name,
          username: users.username,
        },
        status: campaignStatuses,
      })
      .from(leads)
      .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
      .leftJoin(users, eq(leads.doerId, users.id))
      .leftJoin(campaignStatuses, eq(leads.statusId, campaignStatuses.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(leads.updatedAt));

    // Get latest followup for each lead
    const leadIds = results.map((r) => r.lead.id);
    let latestFollowups: any[] = [];
    if (leadIds.length > 0) {
      latestFollowups = await this.database.db
        .select()
        .from(followups)
        .where(inArray(followups.leadId, leadIds))
        .orderBy(desc(followups.createdAt));
    }

    const followupMap = new Map<string, any>();
    for (const f of latestFollowups) {
      if (!followupMap.has(f.leadId)) {
        followupMap.set(f.leadId, f);
      }
    }

    return results.map((r) => ({
      ...r.lead,
      campaign: r.campaign,
      doer: r.doer,
      status: r.status,
      followups: followupMap.has(r.lead.id) ? [followupMap.get(r.lead.id)] : [],
    }));
  }

  async getSalesFunnel(userId: string, role: string, campaignId?: string) {
    const leadConditions: any[] = [];
    if (role === 'USER') leadConditions.push(eq(leads.doerId, userId));
    if (campaignId) leadConditions.push(eq(leads.campaignId, campaignId));

    const whereClause = leadConditions.length > 0 ? and(...leadConditions) : undefined;

    const [{ totalLeads }] = await this.database.db
      .select({ totalLeads: sql<number>`count(*)::int` })
      .from(leads)
      .where(whereClause);

    const [{ contactedLeads }] = await this.database.db
      .select({ contactedLeads: sql<number>`count(distinct ${leads.id})::int` })
      .from(leads)
      .innerJoin(followups, eq(leads.id, followups.leadId))
      .where(whereClause);

    const statusConditions: any[] = [];
    if (campaignId) statusConditions.push(eq(campaignStatuses.campaignId, campaignId));

    const statuses = await this.database.db
      .select({
        label: campaignStatuses.label,
        color: campaignStatuses.color,
        count: sql<number>`count(${leads.id})::int`,
      })
      .from(campaignStatuses)
      .leftJoin(leads, eq(campaignStatuses.id, leads.statusId))
      .where(statusConditions.length > 0 ? and(...statusConditions) : undefined)
      .groupBy(campaignStatuses.id, campaignStatuses.label, campaignStatuses.color)
      .orderBy(asc(campaignStatuses.order));

    const statusFunnel = statuses.map((s) => ({
      status: s.label,
      color: s.color,
      count: s.count,
      percentage: totalLeads > 0 ? Math.round((s.count / totalLeads) * 100) : 0,
    }));

    const [{ leadsWithStatus }] = await this.database.db
      .select({ leadsWithStatus: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(...leadConditions, sql`${leads.statusId} IS NOT NULL`));

    const [{ dndLeads }] = await this.database.db
      .select({ dndLeads: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(...leadConditions, eq(leads.dnd, true)));

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
    const leadConditions: any[] = [];
    if (role === 'MANAGER') {
      // MANAGER role filter (simplified)
    }
    if (campaignId) leadConditions.push(eq(leads.campaignId, campaignId));

    if (startDate || endDate) {
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        leadConditions.push(sql`${leads.createdAt} >= ${start}`);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        leadConditions.push(sql`${leads.createdAt} <= ${end}`);
      }
    }

    const whereClause = leadConditions.length > 0 ? and(...leadConditions) : undefined;

    // Get all active users
    const activeUsers = await this.database.db
      .select({ id: users.id, name: users.name, username: users.username })
      .from(users)
      .where(and(eq(users.isActive, true), eq(users.role, 'USER')));

    // Get total leads per user
    const leadStats = await this.database.db
      .select({
        doerId: leads.doerId,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(whereClause)
      .groupBy(leads.doerId);

    const leadStatsMap = new Map(leadStats.map((s) => [s.doerId, s.count]));

    // Get contacted leads (has followups)
    const contactedLeads = await this.database.db
      .select({
        doerId: leads.doerId,
        count: sql<number>`count(distinct ${leads.id})::int`,
      })
      .from(leads)
      .innerJoin(followups, eq(leads.id, followups.leadId))
      .where(whereClause)
      .groupBy(leads.doerId);

    const contactedLeadsMap = new Map(contactedLeads.map((s) => [s.doerId, s.count]));

    // Get qualified leads (has status)
    const qualifiedLeads = await this.database.db
      .select({
        doerId: leads.doerId,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(and(...leadConditions, sql`${leads.statusId} IS NOT NULL`))
      .groupBy(leads.doerId);

    const qualifiedLeadsMap = new Map(qualifiedLeads.map((s) => [s.doerId, s.count]));

    // Get converted leads (status label contains 'convert')
    const convertedLeads = await this.database.db
      .select({
        doerId: leads.doerId,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .innerJoin(campaignStatuses, eq(leads.statusId, campaignStatuses.id))
      .where(and(...leadConditions, ilike(campaignStatuses.label, '%convert%')))
      .groupBy(leads.doerId);

    const convertedLeadsMap = new Map(convertedLeads.map((s) => [s.doerId, s.count]));

    // Get DND leads
    const dndLeads = await this.database.db
      .select({
        doerId: leads.doerId,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(and(...leadConditions, eq(leads.dnd, true)))
      .groupBy(leads.doerId);

    const dndLeadsMap = new Map(dndLeads.map((s) => [s.doerId, s.count]));

    const userStats = activeUsers.map((user) => {
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
