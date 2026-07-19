import { Injectable } from '@nestjs/common';
import { eq, and, or, inArray, desc, asc, sql, ilike, count, lt, gte, between, not } from 'drizzle-orm';
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

    const leadConditions: any[] = [eq(leads.isDeleted, false)];
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
      .where(and(eq(leads.campaignId, campaignId), eq(leads.isDeleted, false)));

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
      .where(and(eq(leads.campaignId, campaignId), eq(leads.isDeleted, false)))
      .groupBy(leads.source);

    return {
      totalLeads,
      byStatus: byStatusResults,
      bySource: bySourceResults,
    };
  }

  async getFollowupDashboard(userId: string, role: string, campaignId?: string, page: number = 1, limit: number = 50) {
    // Query leads first (deduplicated), then fetch latest followup per lead
    // This avoids N duplicate rows when a lead has N followups
    const leadConditions: any[] = [eq(leads.isDeleted, false)];
    if (role === 'USER') {
      leadConditions.push(eq(leads.doerId, userId));
    }
    if (campaignId) leadConditions.push(eq(leads.campaignId, campaignId));

    const whereClause = leadConditions.length > 0 ? and(...leadConditions) : undefined;

    // Count only distinct leads that have at least one followup
    const [{ total }] = await this.database.db
      .select({ total: sql<number>`count(distinct ${leads.id})::int` })
      .from(leads)
      .innerJoin(followups, eq(leads.id, followups.leadId))
      .where(whereClause);

    // Fetch distinct leads with their latest followup
    // Use a subquery approach: get leads, then separately get latest followup per lead
    const offset = (page - 1) * limit;

    const leadResults = await this.database.db
      .select({
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
      })
      .from(leads)
      .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
      .leftJoin(campaignStatuses, eq(leads.statusId, campaignStatuses.id))
      .leftJoin(users, eq(leads.doerId, users.id))
      .innerJoin(followups, eq(leads.id, followups.leadId))
      .where(whereClause)
      .groupBy(leads.id, campaigns.id, campaigns.name, campaignStatuses.id, users.id, users.name, users.username)
      .orderBy(desc(sql`max(${followups.createdAt})`))
      .offset(offset)
      .limit(limit);

    // Fetch the latest followup for each lead in the result
    const leadIds = leadResults.map((r) => r.lead.id);
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

    // Also fetch the followup user info for the latest followup
    const followupUserIds = latestFollowups
      .filter((f) => followupMap.get(f.leadId)?.id === f.id)
      .map((f) => f.userId)
      .filter(Boolean);
    const uniqueUserIds = [...new Set(followupUserIds)];
    let userMap = new Map<string, any>();
    if (uniqueUserIds.length > 0) {
      const followupUsers = await this.database.db
        .select({ id: users.id, name: users.name, username: users.username })
        .from(users)
        .where(inArray(users.id, uniqueUserIds));
      userMap = new Map(followupUsers.map((u) => [u.id, u]));
    }

    return {
      data: leadResults.map((r) => ({
        ...(followupMap.get(r.lead.id) || {}),
        lead: r.lead,
        user: followupMap.get(r.lead.id)
          ? userMap.get(followupMap.get(r.lead.id).userId) || null
          : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAllLeadsDashboard(userId: string, role: string, campaignId?: string, page: number = 1, limit: number = 50) {
    const conditions: any[] = [eq(leads.isDeleted, false)];
    if (campaignId) conditions.push(eq(leads.campaignId, campaignId));
    if (role === 'USER') conditions.push(eq(leads.doerId, userId));

    const offset = (page - 1) * limit;

    const [{ total }] = await this.database.db
      .select({ total: sql<number>`count(*)::int` })
      .from(leads)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

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
      .orderBy(desc(leads.updatedAt))
      .offset(offset)
      .limit(limit);

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

    return {
      data: results.map((r) => ({
        ...r.lead,
        campaign: r.campaign,
        doer: r.doer,
        status: r.status,
        followups: followupMap.has(r.lead.id) ? [followupMap.get(r.lead.id)] : [],
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSalesFunnel(userId: string, role: string, campaignId?: string) {
    const leadConditions: any[] = [eq(leads.isDeleted, false)];
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
    const leadConditions: any[] = [eq(leads.isDeleted, false)];
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

  async getKpiOverview(userId: string, role: string, campaignId?: string, startDate?: string, endDate?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = new Date();
    const twoHoursAgo = new Date(date.setHours(date.getHours()-2))
    const now = new Date()

    const leadConditions: any[] = [eq(leads.isDeleted, false)];
    if (role === 'USER') leadConditions.push(eq(leads.doerId, userId));
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

    const [{ totalLeads }] = await this.database.db
      .select({ totalLeads: sql<number>`count(*)::int` })
      .from(leads)
      .where(whereClause);

    const todayLeadConditions: any[] = [eq(leads.isDeleted, false), sql`${leads.createdAt} >= ${today}`, sql`${leads.createdAt} < ${tomorrow}`];
    if (role === 'USER') todayLeadConditions.push(eq(leads.doerId, userId));
    if (campaignId) todayLeadConditions.push(eq(leads.campaignId, campaignId));

    const [{ todayNewLeads }] = await this.database.db
      .select({ todayNewLeads: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(...todayLeadConditions));

    // Find status IDs whose label contains 'completed' (to exclude them)
    const completedStatuses = await this.database.db
      .select({ id: campaignStatuses.id })
      .from(campaignStatuses)
      .where(ilike(campaignStatuses.label, '%completed%'));
    const completedIds = completedStatuses.map((s) => s.id);

    // Query leads first (deduplicated), then fetch latest followup per lead — same approach as getFollowupDashboard
    const followupLeadConditions: any[] = [eq(leads.isDeleted, false)];
    if (role === 'USER') followupLeadConditions.push(eq(leads.doerId, userId));
    if (campaignId) followupLeadConditions.push(eq(leads.campaignId, campaignId));
    // Exclude leads whose status label contains 'completed'
    if (completedIds.length > 0) {
      followupLeadConditions.push(or(sql`${leads.statusId} IS NULL`, not(inArray(leads.statusId, completedIds))));
    }

    const followupLeadWhere = and(...followupLeadConditions);

    // Get distinct lead IDs that have followups
    const leadsWithFollowups = await this.database.db
      .select({ leadId: followups.leadId })
      .from(followups)
      .innerJoin(leads, eq(followups.leadId, leads.id))
      .where(followupLeadWhere)
      .groupBy(followups.leadId);

    // Fetch latest followup for each lead
    const fLeadIds = leadsWithFollowups.map((r) => r.leadId);
    let latestFollowups: any[] = [];
    if (fLeadIds.length > 0) {
      latestFollowups = await this.database.db
        .select()
        .from(followups)
        .where(inArray(followups.leadId, fLeadIds))
        .orderBy(desc(followups.createdAt));
    }

    // Build map of latest followup per lead
    const followupMap = new Map<string, any>();
    for (const f of latestFollowups) {
      if (!followupMap.has(f.leadId)) {
        followupMap.set(f.leadId, f);
      }
    }

    // Count pending and missed in TypeScript (same logic as FollowupDashboardPage)
    let dueFollowups = 0;
    let missedFollowups = 0;
    for (const [, followup] of followupMap) {
      if (!followup.nextCallDate) continue;
      const nextDate = new Date(followup.nextCallDate);
      if (nextDate < twoHoursAgo) {
        missedFollowups++;
      } else if (nextDate >= twoHoursAgo && nextDate < now) {
        dueFollowups++;
      }
    }

    const wonStatuses = await this.database.db
      .select({ id: campaignStatuses.id })
      .from(campaignStatuses)
      .where(ilike(campaignStatuses.label, '%won%'));

    const wonConditions: any[] = [eq(leads.isDeleted, false)];
    if (role === 'USER') wonConditions.push(eq(leads.doerId, userId));
    if (campaignId) wonConditions.push(eq(leads.campaignId, campaignId));
    if (wonStatuses.length > 0) {
      wonConditions.push(inArray(leads.statusId, wonStatuses.map((s) => s.id)));
    } else {
      wonConditions.push(sql`1 = 0`);
    }

    const [{ wonDeals }] = await this.database.db
      .select({ wonDeals: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(...wonConditions));

    const convertedStatuses = await this.database.db
      .select({ id: campaignStatuses.id })
      .from(campaignStatuses)
      .where(ilike(campaignStatuses.label, '%convert%'));

    let overallConversion = 0;
    if (totalLeads > 0 && convertedStatuses.length > 0) {
      const convConditions: any[] = [eq(leads.isDeleted, false)];
      if (role === 'USER') convConditions.push(eq(leads.doerId, userId));
      if (campaignId) convConditions.push(eq(leads.campaignId, campaignId));
      convConditions.push(inArray(leads.statusId, convertedStatuses.map((s) => s.id)));

      const [{ converted }] = await this.database.db
        .select({ converted: sql<number>`count(*)::int` })
        .from(leads)
        .where(and(...convConditions));

      overallConversion = Math.round((converted / totalLeads) * 100);
    }

    return {
      totalLeads,
      todayNewLeads,
      dueFollowups,
      missedFollowups,
      wonDeals,
      overallConversion,
    };
  }

  async getBusinessAlerts(userId: string, role: string) {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const now = new Date();

    const alerts: string[] = [];

    // Query leads first (deduplicated), then fetch latest followup per lead — same reliable pattern
    const alertLeadConditions: any[] = [eq(leads.isDeleted, false)];
    if (role === 'USER') alertLeadConditions.push(eq(leads.doerId, userId));

    const alertLeadWhere = and(...alertLeadConditions);

    const alertLeadsWithFollowups = await this.database.db
      .select({ leadId: followups.leadId })
      .from(followups)
      .innerJoin(leads, eq(followups.leadId, leads.id))
      .where(alertLeadWhere)
      .groupBy(followups.leadId);

    const alertLeadIds = alertLeadsWithFollowups.map((r) => r.leadId);
    let alertLatestFollowups: any[] = [];
    if (alertLeadIds.length > 0) {
      alertLatestFollowups = await this.database.db
        .select()
        .from(followups)
        .where(inArray(followups.leadId, alertLeadIds))
        .orderBy(desc(followups.createdAt));
    }

    const alertFollowupMap = new Map<string, any>();
    for (const f of alertLatestFollowups) {
      if (!alertFollowupMap.has(f.leadId)) {
        alertFollowupMap.set(f.leadId, f);
      }
    }

    // Upcoming followups: nextCallDate is within the next 10 minutes
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
    let upcomingCount = 0;
    for (const [, followup] of alertFollowupMap) {
      if (!followup.nextCallDate) continue;
      const nextDate = new Date(followup.nextCallDate);
      if (nextDate > now && nextDate < tenMinutesFromNow) {
        upcomingCount++;
      }
    }

    if (upcomingCount > 0) {
      alerts.push(`${upcomingCount} follow-up(s) coming up in the next 10 minutes`);
    }


    const userConversion = await this.getUserConversion(userId, role);
    if (userConversion.length > 0) {
      const highest = userConversion[0];
      alerts.push(`${highest.name} has highest conversion at ${highest.conversionRate}%`);

      const lowest = userConversion[userConversion.length - 1];
      if (lowest.conversionRate < highest.conversionRate) {
        alerts.push(`${lowest.name} needs attention with ${lowest.conversionRate}% conversion`);
      }
    }

    const campaignStats = await this.database.db
      .select({
        campaignId: leads.campaignId,
        campaignName: campaigns.name,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
      .where(and(eq(leads.isDeleted, false), sql`${leads.statusId} IS NOT NULL`))
      .groupBy(leads.campaignId, campaigns.name)
      .orderBy(desc(sql`count(*)::int`))
      .limit(1);

    if (campaignStats.length > 0) {
      alerts.push(`Top campaign: ${campaignStats[0].campaignName} with ${campaignStats[0].count} leads`);
    }

    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [{ staleLeads }] = await this.database.db
      .select({ staleLeads: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(eq(leads.isDeleted, false), sql`${leads.updatedAt} < ${sevenDaysAgo}`));

    if (staleLeads > 0) {
      alerts.push(`${staleLeads} leads with no activity for 7+ days`);
    }

    return alerts;
  }

  async getCampaignWiseReport(userId: string, role: string, startDate?: string, endDate?: string) {
    const leadConditions: any[] = [eq(leads.isDeleted, false)];
    if (role === 'USER') leadConditions.push(eq(leads.doerId, userId));

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

    const campaignData = await this.database.db
      .select({
        campaignId: campaigns.id,
        campaignName: campaigns.name,
        totalLeads: sql<number>`count(${leads.id})::int`,
      })
      .from(campaigns)
      .leftJoin(leads, and(eq(leads.campaignId, campaigns.id), ...leadConditions))
      .where(eq(campaigns.isActive, true))
      .groupBy(campaigns.id, campaigns.name)
      .orderBy(desc(sql`count(${leads.id})::int`));

    const convertedStatuses = await this.database.db
      .select({ id: campaignStatuses.id })
      .from(campaignStatuses)
      .where(ilike(campaignStatuses.label, '%convert%'));

    const wonStatuses = await this.database.db
      .select({ id: campaignStatuses.id })
      .from(campaignStatuses)
      .where(ilike(campaignStatuses.label, '%won%'));

    const convertedIds = convertedStatuses.map((s) => s.id);
    const campaignIds = campaignData.map((c) => c.campaignId);

    // Single query for converted lead counts per campaign (was N+1)
    let convertedCounts: Record<string, number> = {};
    if (convertedIds.length > 0 && campaignIds.length > 0) {
      const ccRows = await this.database.db
        .select({
          campaignId: leads.campaignId,
          count: sql<number>`count(*)::int`,
        })
        .from(leads)
        .where(and(
          inArray(leads.campaignId, campaignIds),
          eq(leads.isDeleted, false),
          inArray(leads.statusId, convertedIds),
        ))
        .groupBy(leads.campaignId);
      ccRows.forEach((r) => { convertedCounts[r.campaignId!] = r.count; });
    }

    // Single query for total lead counts per campaign (was N+1)
    let totalCounts: Record<string, number> = {};
    if (campaignIds.length > 0) {
      const tcRows = await this.database.db
        .select({
          campaignId: leads.campaignId,
          count: sql<number>`count(*)::int`,
        })
        .from(leads)
        .where(and(
          inArray(leads.campaignId, campaignIds),
          eq(leads.isDeleted, false),
        ))
        .groupBy(leads.campaignId);
      tcRows.forEach((r) => { totalCounts[r.campaignId!] = r.count; });
    }

    const results = campaignData.map((c) => {
      const totalLeadsCount = totalCounts[c.campaignId] || c.totalLeads;
      const converted = convertedCounts[c.campaignId] || 0;
      const lost = Math.max(0, totalLeadsCount - converted);

      return {
        campaignId: c.campaignId,
        campaignName: c.campaignName,
        totalLeads: totalLeadsCount,
        converted,
        lost,
        conversionRate: totalLeadsCount > 0 ? Math.round((converted / totalLeadsCount) * 100) : 0,
      };
    });

    return results;
  }

  async getStatusWiseReport(userId: string, role: string, campaignId?: string) {
    const conditions: any[] = [eq(leads.isDeleted, false)];
    if (role === 'USER') conditions.push(eq(leads.doerId, userId));
    if (campaignId) conditions.push(eq(leads.campaignId, campaignId));

    const statusConditions: any[] = [];
    if (campaignId) statusConditions.push(eq(campaignStatuses.campaignId, campaignId));

    const statuses = await this.database.db
      .select({
        label: campaignStatuses.label,
        color: campaignStatuses.color,
        count: sql<number>`count(${leads.id})::int`,
      })
      .from(campaignStatuses)
      .leftJoin(leads, and(eq(campaignStatuses.id, leads.statusId), ...conditions))
      .where(statusConditions.length > 0 ? and(...statusConditions) : undefined)
      .groupBy(campaignStatuses.id, campaignStatuses.label, campaignStatuses.color)
      .orderBy(asc(campaignStatuses.order));

    return statuses;
  }

  async getDailyTrend(userId: string, role: string, campaignId?: string, startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date();
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Fetch converted statuses ONCE (was re-fetched every day in the old loop)
    const convertedStatuses = await this.database.db
      .select({ id: campaignStatuses.id })
      .from(campaignStatuses)
      .where(ilike(campaignStatuses.label, '%convert%'));

    const convertedStatusIds = convertedStatuses.map((s) => s.id);

    // Query 1: New leads per day (single query with GROUP BY instead of N queries)
    const leadConditions: any[] = [
      eq(leads.isDeleted, false),
      sql`${leads.createdAt} >= ${start}`,
      sql`${leads.createdAt} <= ${end}`,
    ];
    if (role === 'USER') leadConditions.push(eq(leads.doerId, userId));
    if (campaignId) leadConditions.push(eq(leads.campaignId, campaignId));

    const newLeadsByDay = await this.database.db
      .select({
        date: sql<string>`to_char(${leads.createdAt}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(and(...leadConditions))
      .groupBy(sql`to_char(${leads.createdAt}, 'YYYY-MM-DD')`);

    // Query 2: Converted leads per day (single query with GROUP BY)
    const convertedLeadsByDay = new Map<string, number>();
    if (convertedStatusIds.length > 0) {
      const convConditions: any[] = [
        eq(leads.isDeleted, false),
        sql`${leads.updatedAt} >= ${start}`,
        sql`${leads.updatedAt} <= ${end}`,
        inArray(leads.statusId, convertedStatusIds),
      ];
      if (role === 'USER') convConditions.push(eq(leads.doerId, userId));
      if (campaignId) convConditions.push(eq(leads.campaignId, campaignId));

      const rows = await this.database.db
        .select({
          date: sql<string>`to_char(${leads.updatedAt}, 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(leads)
        .where(and(...convConditions))
        .groupBy(sql`to_char(${leads.updatedAt}, 'YYYY-MM-DD')`);

      for (const r of rows) convertedLeadsByDay.set(r.date, r.count);
    }

    // Query 3: Missed followups per day (single query with GROUP BY)
    const followupConditions: any[] = [
      sql`${followups.nextCallDate} >= ${start}`,
      sql`${followups.nextCallDate} <= ${end}`,
    ];
    if (role === 'USER') followupConditions.push(eq(followups.userId, userId));

    const missedByDay = await this.database.db
      .select({
        date: sql<string>`to_char(${followups.nextCallDate}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(followups)
      .where(and(...followupConditions))
      .groupBy(sql`to_char(${followups.nextCallDate}, 'YYYY-MM-DD')`);

    // Build lookup maps for O(1) merge
    const newLeadsMap = new Map(newLeadsByDay.map((r) => [r.date, r.count]));
    const missedMap = new Map(missedByDay.map((r) => [r.date, r.count]));

    // Generate all days in range and merge results
    const days: Array<{ date: string; newLeads: number; convertedLeads: number; missedFollowups: number }> = [];
    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      days.push({
        date: dateStr,
        newLeads: newLeadsMap.get(dateStr) ?? 0,
        convertedLeads: convertedLeadsByDay.get(dateStr) ?? 0,
        missedFollowups: missedMap.get(dateStr) ?? 0,
      });
      current.setDate(current.getDate() + 1);
    }

    return days;
  }

  async getMissedByUser(userId: string, role: string, campaignId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const followupConditions: any[] = [sql`${followups.nextCallDate} < ${today}`];
    if (role === 'USER') followupConditions.push(eq(followups.userId, userId));
    if (campaignId) {
      followupConditions.push(sql`${followups.leadId} IN (SELECT "id" FROM "Lead" WHERE "campaignId" = ${campaignId})`);
    }

    const results = await this.database.db
      .select({
        userId: users.id,
        userName: users.name,
        username: users.username,
        missedCount: sql<number>`count(*)::int`,
        oldestPending: sql<Date>`min(${followups.nextCallDate})`,
      })
      .from(followups)
      .innerJoin(users, eq(followups.userId, users.id))
      .where(and(...followupConditions))
      .groupBy(users.id, users.name, users.username)
      .orderBy(desc(sql`count(*)::int`));

    const [{ overdueCount }] = await this.database.db
      .select({ overdueCount: sql<number>`count(*)::int` })
      .from(followups)
      .where(and(...followupConditions, sql`${followups.nextCallDate} < ${today}`));

    return results.map((r) => ({
      ...r,
      overdueCount,
    }));
  }
}
