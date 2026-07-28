import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { eq, and, ne, inArray, desc, asc, sql } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { leads, followups, campaignStatuses, campaignUsers, users, campaigns } from '../db/schema';
import { PaginationDto } from '../common/pagination.dto';
import { RoundRobinService } from '../common/services/round-robin.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { getTransferUpdatePayload } from './transfer.utils';

@Injectable()
export class LeadsService {
  constructor(
    private database: DatabaseService,
    private roundRobinService: RoundRobinService,
    private notificationsService: NotificationsService,
  ) {}

  async findByCampaign(campaignId: string, userId?: string, role?: string, pagination?: PaginationDto) {
    const conditions: any[] = [eq(leads.campaignId, campaignId), eq(leads.isDeleted, false)];
    if (role === 'USER' && userId) {
      conditions.push(eq(leads.doerId, userId));
    }

    const skip = pagination?.getSkip() || 0;
    const take = pagination?.getTake() || 50;

    const results = await this.database.db
      .select({
        lead: leads,
        doer: {
          id: users.id,
          name: users.name,
          username: users.username,
        },
        status: campaignStatuses,
      })
      .from(leads)
      .leftJoin(users, eq(leads.doerId, users.id))
      .leftJoin(campaignStatuses, eq(leads.statusId, campaignStatuses.id))
      .where(and(...conditions))
      .orderBy(desc(leads.createdAt))
      .offset(skip)
      .limit(take);

    // Get latest followup for each lead using DISTINCT ON (PostgreSQL optimization)
    const leadIds = results.map((r) => r.lead.id);
    let latestFollowups: any[] = [];
    if (leadIds.length > 0) {
      latestFollowups = await this.database.db
        .select({
          leadId: followups.leadId,
          status: followups.status,
          user: { name: users.name },
        })
        .from(followups)
        .innerJoin(users, eq(followups.userId, users.id))
        .where(inArray(followups.leadId, leadIds))
        .orderBy(desc(followups.leadId), desc(followups.createdAt));
    }

    // Group followups by leadId and take the first one per lead
    const followupMap = new Map<string, any>();
    for (const f of latestFollowups) {
      if (!followupMap.has(f.leadId)) {
        followupMap.set(f.leadId, [f]);
      }
    }

    return results.map((r) => ({
      ...r.lead,
      doer: r.doer,
      status: r.status,
      followups: followupMap.get(r.lead.id) || [],
    }));
  }

  async findOne(id: string, userId?: string, role?: string) {
    const [result] = await this.database.db
      .select({
        lead: leads,
        doer: {
          id: users.id,
          name: users.name,
          username: users.username,
        },
        status: campaignStatuses,
        campaign: {
          id: campaigns.id,
          name: campaigns.name,
        },
      })
      .from(leads)
      .leftJoin(users, eq(leads.doerId, users.id))
      .leftJoin(campaignStatuses, eq(leads.statusId, campaignStatuses.id))
      .leftJoin(campaigns, eq(leads.campaignId, campaigns.id))
      .where(and(eq(leads.id, id), eq(leads.isDeleted, false)))
      .limit(1);

    if (!result) throw new NotFoundException('Lead not found');

    if (role === 'USER' && userId && result.lead.doerId !== userId) {
      throw new ForbiddenException('You can only view leads assigned to you');
    }

    // Get followups
    const followupsList = await this.database.db
      .select({
        followup: followups,
        user: { name: users.name, username: users.username },
      })
      .from(followups)
      .innerJoin(users, eq(followups.userId, users.id))
      .where(eq(followups.leadId, id))
      .orderBy(desc(followups.createdAt));

    return {
      ...result.lead,
      doer: result.doer,
      status: result.status,
      campaign: result.campaign,
      followups: followupsList.map((f) => ({
        ...f.followup,
        user: f.user,
      })),
    };
  }

  async create(dto: CreateLeadDto, userId?: string, role?: string) {
    await this.ensureCampaignAccess(dto.campaignId, userId, role);

    const doerId = dto.doerId || await this.roundRobinService.getNextRoundRobinUser(dto.campaignId);

    let statusId = dto.statusId;
    if (!statusId) {
      const [firstStatus] = await this.database.db
        .select()
        .from(campaignStatuses)
        .where(eq(campaignStatuses.campaignId, dto.campaignId))
        .orderBy(asc(campaignStatuses.order))
        .limit(1);
      statusId = firstStatus?.id || undefined;
    }

    const lead = await this.database.db.transaction(async (tx) => {
      const [newLead] = await tx
        .insert(leads)
        .values({
          campaignId: dto.campaignId,
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          doerId,
          statusId,
          source: dto.source || 'manual',
          customData: dto.customData,
        })
        .returning();

      // Auto-create initial followup
      let statusLabel = 'New';
      if (statusId) {
        const [status] = await tx
          .select()
          .from(campaignStatuses)
          .where(eq(campaignStatuses.id, statusId))
          .limit(1);
        statusLabel = status?.label || 'New';
      }

      await tx.insert(followups).values({
        leadId: newLead.id,
        userId: doerId,
        status: statusLabel,
        remarks: dto.source === 'form' ? 'Form submitted' : dto.source === 'bulk' ? 'Imported via bulk upload' : 'Lead created',
      });

      return newLead;
    });

    return lead;
  }

  async update(id: string, dto: UpdateLeadDto, userId?: string, role?: string) {
    const lead = await this.findOne(id, userId, role);
    if (role === 'USER' && lead.doerId !== userId) {
      throw new ForbiddenException('You can only edit leads assigned to you');
    }
    // Whitelist allowed fields while allowing controlled campaign transfers.
    const allowedFields: Record<string, any> = {};
    if (dto.name !== undefined) allowedFields.name = dto.name;
    if (dto.email !== undefined) allowedFields.email = dto.email;
    if (dto.phone !== undefined) allowedFields.phone = dto.phone;
    if (dto.statusId !== undefined) allowedFields.statusId = dto.statusId;
    if (dto.customData !== undefined) allowedFields.customData = dto.customData;
    if (dto.source !== undefined) allowedFields.source = dto.source;
    if (role === 'ADMIN') {
      let transferPayload: any = { campaignId: dto.campaignId, doerId: dto.doerId };
      if (dto.campaignId && dto.campaignId !== lead.campaignId) {
        const targetStatuses = await this.database.db
          .select({ id: campaignStatuses.id, campaignId: campaignStatuses.campaignId })
          .from(campaignStatuses)
          .where(eq(campaignStatuses.campaignId, dto.campaignId));

        transferPayload = getTransferUpdatePayload(
          transferPayload,
          lead.campaignId,
          lead.statusId || undefined,
          targetStatuses,
        );
      }

      if (transferPayload.campaignId !== undefined) {
        const [targetCampaign] = await this.database.db
          .select({ id: campaigns.id })
          .from(campaigns)
          .where(eq(campaigns.id, transferPayload.campaignId))
          .limit(1);
        if (!targetCampaign) {
          throw new NotFoundException('Campaign not found');
        }
        allowedFields.campaignId = transferPayload.campaignId;
      }
      if (transferPayload.doerId !== undefined) allowedFields.doerId = transferPayload.doerId;
      if (transferPayload.statusId !== undefined) allowedFields.statusId = transferPayload.statusId;
    }
    allowedFields.updatedAt = new Date();
    const [updated] = await this.database.db
      .update(leads)
      .set(allowedFields)
      .where(eq(leads.id, id))
      .returning();
    return updated;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, userId: string, role?: string) {
    const lead = await this.findOne(id, userId, role);
    if (role === 'USER' && lead.doerId !== userId) {
      throw new ForbiddenException('You can only update status for leads assigned to you');
    }

    // Wrap followup insert + lead status update in a transaction for atomicity
    const [followup] = await this.database.db.transaction(async (tx) => {
      const [newFollowup] = await tx
        .insert(followups)
        .values({
          leadId: id,
          userId,
          status: dto.status,
          remarks: dto.remarks,
          nextCallDate: dto.nextCallDate ? new Date(dto.nextCallDate) : null,
        })
        .returning();

      const leadUpdate: any = {};
      if (dto.statusId) leadUpdate.statusId = dto.statusId;
      if (dto.dnd !== undefined) leadUpdate.dnd = dto.dnd;

      await tx.update(leads).set(leadUpdate).where(eq(leads.id, id));

      return [newFollowup] as const;
    });

    // Create notification after transaction commits (best-effort, non-critical)
    await this.notificationsService.createNotificationForFollowup(userId, followup.id, followup.nextCallDate);

    return followup;
  }

  async findDnd(userId?: string, role?: string, pagination?: PaginationDto) {
    const conditions: any[] = [eq(leads.dnd, true), eq(leads.isDeleted, false)];
    if (role === 'USER' && userId) {
      conditions.push(eq(leads.doerId, userId));
    }

    const skip = pagination?.getSkip() || 0;
    const take = pagination?.getTake() || 50;

    const results = await this.database.db
      .select({
        lead: leads,
        doer: {
          id: users.id,
          name: users.name,
          username: users.username,
        },
        status: campaignStatuses,
        campaign: {
          id: campaigns.id,
          name: campaigns.name,
        },
      })
      .from(leads)
      .leftJoin(users, eq(leads.doerId, users.id))
      .leftJoin(campaignStatuses, eq(leads.statusId, campaignStatuses.id))
      .leftJoin(campaigns, eq(leads.campaignId, campaigns.id))
      .where(and(...conditions))
      .orderBy(desc(leads.updatedAt))
      .offset(skip)
      .limit(take);

    return results.map((r) => ({
      ...r.lead,
      doer: r.doer,
      status: r.status,
      campaign: r.campaign,
    }));
  }

  async allocateRoundRobin(campaignId: string, leadIds: string[], userId?: string, role?: string) {
    await this.ensureCampaignAccess(campaignId, userId, role);
    return this.roundRobinService.allocateRoundRobin(campaignId, leadIds);
  }

  async remove(id: string, userId?: string, role?: string) {
    const lead = await this.findOne(id, userId, role);
    if (role === 'USER') {
      throw new ForbiddenException('You cannot delete leads');
    }
    const [deleted] = await this.database.db
      .update(leads)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return deleted;
  }

  async getStats(campaignId: string) {
    const [{ total }] = await this.database.db
      .select({ total: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(eq(leads.campaignId, campaignId), eq(leads.isDeleted, false)));

    const byStatus = await this.database.db
      .select({
        statusId: leads.statusId,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(eq(leads.campaignId, campaignId))
      .groupBy(leads.statusId);

    return { total, byStatus };
  }

  private async ensureCampaignAccess(campaignId: string, userId?: string, role?: string) {
    if (role === 'ADMIN') return;
    if (!userId) throw new ForbiddenException('User ID required');

    const [assignment] = await this.database.db
      .select()
      .from(campaignUsers)
      .where(and(eq(campaignUsers.campaignId, campaignId), eq(campaignUsers.userId, userId), eq(campaignUsers.isActive, true)))
      .limit(1);

    if (!assignment) {
      throw new ForbiddenException('You are not assigned to this campaign');
    }
  }
}
