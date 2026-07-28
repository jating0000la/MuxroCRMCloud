import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, inArray, desc, asc, or, like, sql, ne } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { followups, leads, users, campaigns, campaignStatuses } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { PaginationDto } from '../common/pagination.dto';
import { CreateFollowupDto } from './dto/create-followup.dto';
import { UpdateFollowupDto } from './dto/update-followup.dto';

@Injectable()
export class FollowupsService {
  constructor(
    private database: DatabaseService,
    private notificationsService: NotificationsService,
  ) {}

  async findByLead(leadId: string, userId?: string, role?: string) {
    if (role === 'USER' && userId) {
      const [lead] = await this.database.db
        .select({ doerId: leads.doerId })
        .from(leads)
        .where(eq(leads.id, leadId))
        .limit(1);

      if (!lead || lead.doerId !== userId) {
        throw new NotFoundException('Lead not found');
      }
    }

    const results = await this.database.db
      .select({
        followup: followups,
        user: {
          id: users.id,
          name: users.name,
          username: users.username,
        },
      })
      .from(followups)
      .innerJoin(users, eq(followups.userId, users.id))
      .where(eq(followups.leadId, leadId))
      .orderBy(desc(followups.createdAt))
      .limit(100); // Safety cap

    return results.map((r) => ({
      ...r.followup,
      user: r.user,
    }));
  }

  async create(dto: CreateFollowupDto, userId: string) {
    // Validate leadId exists
    const [leadExists] = await this.database.db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.id, dto.leadId))
      .limit(1);
    if (!leadExists) throw new NotFoundException('Lead not found');

    const [followup] = await this.database.db
      .insert(followups)
      .values({
        leadId: dto.leadId,
        userId,
        status: dto.status,
        remarks: dto.remarks,
        nextCallDate: dto.nextCallDate ? new Date(dto.nextCallDate) : null,
      })
      .returning();

    // Get user name for response
    const [user] = await this.database.db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Create notification for this followup
    await this.notificationsService.createNotificationForFollowup(userId, followup.id);

    return { ...followup, user };
  }

  async getMyFollowups(userId: string, campaignId?: string, pagination?: PaginationDto) {
    const conditions: any[] = [eq(followups.userId, userId)];

    const skip = pagination?.getSkip() || 0;
    const take = pagination?.getTake() || 50;

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
            doer: { name: users.name },
          },
        })
        .from(followups)
        .innerJoin(leads, eq(followups.leadId, leads.id))
        .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
        .leftJoin(campaignStatuses, eq(leads.statusId, campaignStatuses.id))
        .leftJoin(users, eq(leads.doerId, users.id))
        .where(and(eq(followups.userId, userId), eq(leads.campaignId, campaignId), eq(campaigns.isActive, true)))
        .orderBy(desc(followups.createdAt))
        .offset(skip)
        .limit(take);
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
            doer: { name: users.name },
          },
        })
        .from(followups)
        .innerJoin(leads, eq(followups.leadId, leads.id))
        .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
        .leftJoin(campaignStatuses, eq(leads.statusId, campaignStatuses.id))
        .leftJoin(users, eq(leads.doerId, users.id))
        .where(and(eq(followups.userId, userId), eq(campaigns.isActive, true)))
        .orderBy(desc(followups.createdAt))
        .offset(skip)
        .limit(take);
    }

    return results.map((r) => ({
      ...r.followup,
      lead: r.lead,
    }));
  }

  async getUpcomingFollowups(userId: string, campaignId?: string) {
    const conditions: any[] = [
      eq(followups.userId, userId),
      sql`${followups.nextCallDate} >= ${new Date()}`,
    ];

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
          },
        })
        .from(followups)
        .innerJoin(leads, eq(followups.leadId, leads.id))
        .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
        .leftJoin(campaignStatuses, eq(leads.statusId, campaignStatuses.id))
        .where(and(eq(followups.userId, userId), eq(leads.campaignId, campaignId), eq(campaigns.isActive, true), sql`${followups.nextCallDate} >= ${new Date()}`))
        .orderBy(asc(followups.nextCallDate));
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
          },
        })
        .from(followups)
        .innerJoin(leads, eq(followups.leadId, leads.id))
        .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
        .leftJoin(campaignStatuses, eq(leads.statusId, campaignStatuses.id))
        .where(and(eq(followups.userId, userId), eq(campaigns.isActive, true), sql`${followups.nextCallDate} >= ${new Date()}`))
        .orderBy(asc(followups.nextCallDate));
    }

    return results.map((r) => ({
      ...r.followup,
      lead: r.lead,
    }));
  }

  async findOne(id: string, userId?: string, role?: string) {
    const [result] = await this.database.db
      .select({
        followup: followups,
        lead: { doerId: leads.doerId },
        user: { name: users.name },
      })
      .from(followups)
      .innerJoin(leads, eq(followups.leadId, leads.id))
      .innerJoin(users, eq(followups.userId, users.id))
      .where(eq(followups.id, id))
      .limit(1);

    if (!result) throw new NotFoundException('Followup not found');

    if (role === 'USER' && userId && result.lead?.doerId !== userId) {
      throw new NotFoundException('Followup not found');
    }

    return {
      ...result.followup,
      lead: result.lead,
      user: result.user,
    };
  }

  async update(id: string, dto: UpdateFollowupDto, userId?: string, role?: string) {
    await this.findOne(id, userId, role);

    const updateData: any = {};
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.remarks !== undefined) updateData.remarks = dto.remarks;
    if (dto.nextCallDate !== undefined) {
      updateData.nextCallDate = dto.nextCallDate ? new Date(dto.nextCallDate) : null;
    }

    const [updated] = await this.database.db
      .update(followups)
      .set(updateData)
      .where(eq(followups.id, id))
      .returning();

    // Get user name for response
    const [user] = await this.database.db
      .select({ name: users.name })
      .from(users)
      .where(eq(followups.userId, updated.userId))
      .limit(1);

    // Update notification for this followup
    await this.notificationsService.createNotificationForFollowup(
      updated.userId,
      id,
    );

    return { ...updated, user };
  }

  async remove(id: string, userId?: string, role?: string) {
    await this.findOne(id, userId, role);
    const [deleted] = await this.database.db
      .delete(followups)
      .where(eq(followups.id, id))
      .returning();
    return deleted;
  }

  async findCrossCampaign(phone?: string, email?: string, excludeLeadId?: string, userId?: string, role?: string) {
    if (!phone && !email) return [];

    const leadConditions: any[] = [];
    if (phone) {
      const normalized = phone.replace(/\D/g, '');
      const escaped = normalized.replace(/[%_]/g, '\\$&');
      leadConditions.push(or(eq(leads.phone, normalized), like(leads.phone, `%${escaped}%`)));
    }
    if (email) {
      leadConditions.push(eq(leads.email, email.toLowerCase()));
    }

    if (excludeLeadId) {
      leadConditions.push(ne(leads.id, excludeLeadId));
    }
    if (role === 'USER' && userId) {
      // USER can only see followups for leads they are assigned to (doer)
      leadConditions.push(eq(leads.doerId, userId));
    }

    // Filter out deleted leads
    leadConditions.push(eq(leads.isDeleted, false));

    const matchingLeads = await this.database.db
      .select({ id: leads.id, name: leads.name, campaignId: leads.campaignId })
      .from(leads)
      .where(and(...leadConditions));

    if (matchingLeads.length === 0) return [];

    const leadIds = matchingLeads.map((l) => l.id);
    const leadMap = new Map(matchingLeads.map((l) => [l.id, l]));

    const followupsList = await this.database.db
      .select({
        followup: followups,
        user: {
          id: users.id,
          name: users.name,
          username: users.username,
        },
        leadCampaign: {
          id: campaigns.id,
          name: campaigns.name,
        },
      })
      .from(followups)
      .innerJoin(users, eq(followups.userId, users.id))
      .innerJoin(leads, eq(followups.leadId, leads.id))
      .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
      .where(inArray(followups.leadId, leadIds))
      .orderBy(desc(followups.createdAt));

    return followupsList.map((f) => ({
      ...f.followup,
      crossCampaign: true,
      matchedLead: leadMap.get(f.followup.leadId),
      user: f.user,
      lead: {
        campaign: f.leadCampaign,
      },
    }));
  }
}
