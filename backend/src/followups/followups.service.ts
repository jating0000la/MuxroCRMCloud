import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, inArray, desc, asc, or, like, sql, ne, lt } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { followups, leads, users, campaigns, campaignStatuses } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { PaginationDto } from '../common/pagination.dto';
import { CreateFollowupDto } from './dto/create-followup.dto';
import { UpdateFollowupDto } from './dto/update-followup.dto';

/**
 * Performance-optimized followups service.
 *
 * Key optimizations applied:
 *  - Keyset (cursor) pagination replaces OFFSET — avoids slow-offset on large datasets
 *  - Explicit column selection replaces `...leads` spread — reduces wire transfer & parsing
 *  - Single-query patterns replace N+1 — eliminates redundant round-trips
 *  - Reusable condition builder eliminates duplicated query blocks
 */

// ── Flat-row type returned by followup-list queries ────────────
interface FollowupListRow {
  id: string; leadId: string; userId: string; status: string;
  remarks: string | null; nextCallDate: Date | null; createdAt: Date;
  lead__id: string; lead__name: string; lead__email: string | null;
  lead__phone: string | null; lead__source: string;
  lead__campaignId: string; lead__doerId: string | null;
  lead__statusId: string | null; lead__dnd: boolean;
  lead__isDeleted: boolean; lead__createdAt: Date; lead__updatedAt: Date;
  campaign__id: string; campaign__name: string;
  status__id: string | null; status__label: string | null; status__color: string | null;
  doer__name: string | null;
}

function mapFollowupRow(r: FollowupListRow) {
  return {
    id: r.id,
    leadId: r.leadId,
    userId: r.userId,
    status: r.status,
    remarks: r.remarks,
    nextCallDate: r.nextCallDate,
    createdAt: r.createdAt,
    lead: {
      id: r.lead__id, name: r.lead__name, email: r.lead__email,
      phone: r.lead__phone, source: r.lead__source,
      campaignId: r.lead__campaignId, doerId: r.lead__doerId,
      statusId: r.lead__statusId, dnd: r.lead__dnd,
      isDeleted: r.lead__isDeleted, createdAt: r.lead__createdAt,
      updatedAt: r.lead__updatedAt,
      campaign: { id: r.campaign__id, name: r.campaign__name },
      status: r.status__id
        ? { id: r.status__id, label: r.status__label, color: r.status__color }
        : null,
      doer: r.doer__name ? { name: r.doer__name } : null,
    },
  };
}

const followupListSelect = {
  id: followups.id, leadId: followups.leadId, userId: followups.userId,
  status: followups.status, remarks: followups.remarks,
  nextCallDate: followups.nextCallDate, createdAt: followups.createdAt,
  lead__id: leads.id, lead__name: leads.name, lead__email: leads.email,
  lead__phone: leads.phone, lead__source: leads.source,
  lead__campaignId: leads.campaignId, lead__doerId: leads.doerId,
  lead__statusId: leads.statusId, lead__dnd: leads.dnd,
  lead__isDeleted: leads.isDeleted, lead__createdAt: leads.createdAt,
  lead__updatedAt: leads.updatedAt,
  campaign__id: campaigns.id, campaign__name: campaigns.name,
  status__id: campaignStatuses.id, status__label: campaignStatuses.label,
  status__color: campaignStatuses.color,
  doer__name: users.name,
} as const;

@Injectable()
export class FollowupsService {
  constructor(
    private database: DatabaseService,
    private notificationsService: NotificationsService,
  ) {}

  private buildFollowupListConditions(userId: string, campaignId?: string, cursor?: string) {
    const c: any[] = [eq(followups.userId, userId), eq(campaigns.isActive, true)];
    if (campaignId) c.push(eq(leads.campaignId, campaignId));
    if (cursor) c.push(lt(followups.createdAt, new Date(cursor)));
    return c;
  }

  async findByLead(leadId: string, userId?: string, role?: string) {
    const leadFilter = role === 'USER' && userId ? eq(leads.doerId, userId) : undefined;

    const rows = await this.database.db
      .select({
        id: followups.id, leadId: followups.leadId, userId: followups.userId,
        status: followups.status, remarks: followups.remarks,
        nextCallDate: followups.nextCallDate, createdAt: followups.createdAt,
        userName: users.name, userUsername: users.username, userIdRef: users.id,
      })
      .from(followups)
      .innerJoin(leads, eq(followups.leadId, leads.id))
      .innerJoin(users, eq(followups.userId, users.id))
      .where(leadFilter ? and(eq(followups.leadId, leadId), leadFilter) : eq(followups.leadId, leadId))
      .orderBy(desc(followups.createdAt))
      .limit(100);

    if (rows.length === 0) {
      const [lead] = await this.database.db
        .select({ id: leads.id })
        .from(leads)
        .where(leadFilter ? and(eq(leads.id, leadId), leadFilter) : eq(leads.id, leadId))
        .limit(1);
      if (!lead) throw new NotFoundException('Lead not found');
    }

    return rows.map((r) => ({
      id: r.id, leadId: r.leadId, userId: r.userId, status: r.status,
      remarks: r.remarks, nextCallDate: r.nextCallDate, createdAt: r.createdAt,
      user: { id: r.userIdRef, name: r.userName, username: r.userUsername },
    }));
  }

  async create(dto: CreateFollowupDto, userId: string) {
    // Verify lead exists BEFORE inserting the followup (avoids race condition)
    const [lead] = await this.database.db
      .select({ id: leads.id, doerId: leads.doerId })
      .from(leads).where(eq(leads.id, dto.leadId)).limit(1);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const [followup] = await this.database.db
      .insert(followups)
      .values({
        leadId: dto.leadId, userId, status: dto.status,
        remarks: dto.remarks,
        nextCallDate: dto.nextCallDate ? new Date(dto.nextCallDate) : null,
      })
      .returning();

    const [user] = await this.database.db
      .select({ id: users.id, name: users.name })
      .from(users).where(eq(users.id, userId)).limit(1);

    this.notificationsService
      .createNotificationForFollowup(userId, followup.id, followup.nextCallDate)
      .catch((err) => console.error('Failed to create notification:', err));

    return { ...followup, user };
  }

  async getMyFollowups(userId: string, campaignId?: string, pagination?: PaginationDto, cursor?: string) {
    const take = pagination?.getTake() || 50;
    const conditions = this.buildFollowupListConditions(userId, campaignId, cursor);

    const rows = await this.database.db
      .select(followupListSelect)
      .from(followups)
      .innerJoin(leads, eq(followups.leadId, leads.id))
      .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
      .leftJoin(campaignStatuses, eq(leads.statusId, campaignStatuses.id))
      .leftJoin(users, eq(leads.doerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(followups.createdAt))
      .limit(take + 1);

    const hasMore = rows.length > take;
    const items = rows.slice(0, take).map(mapFollowupRow);
    const nextCursor = hasMore
      ? new Date((rows[take - 1] as any).createdAt).toISOString()
      : null;

    return { data: items, cursor: nextCursor };
  }

  async getUpcomingFollowups(userId: string, campaignId?: string, pagination?: PaginationDto) {
    const take = pagination?.getTake() || 50;
    const conditions: any[] = [
      eq(followups.userId, userId), eq(campaigns.isActive, true),
      sql`${followups.nextCallDate} >= ${new Date()}`,
    ];
    if (campaignId) conditions.push(eq(leads.campaignId, campaignId));

    const rows = await this.database.db
      .select(followupListSelect)
      .from(followups)
      .innerJoin(leads, eq(followups.leadId, leads.id))
      .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
      .leftJoin(campaignStatuses, eq(leads.statusId, campaignStatuses.id))
      .leftJoin(users, eq(leads.doerId, users.id))
      .where(and(...conditions))
      .orderBy(asc(followups.nextCallDate))
      .limit(take);

    return rows.map(mapFollowupRow);
  }

  async findOne(id: string, userId?: string, role?: string) {
    const conditions: any[] = [eq(followups.id, id)];
    if (role === 'USER' && userId) conditions.push(eq(leads.doerId, userId));

    const [row] = await this.database.db
      .select({
        id: followups.id, leadId: followups.leadId, userId: followups.userId,
        status: followups.status, remarks: followups.remarks,
        nextCallDate: followups.nextCallDate, createdAt: followups.createdAt,
        lead__doerId: leads.doerId, user__name: users.name,
      })
      .from(followups)
      .innerJoin(leads, eq(followups.leadId, leads.id))
      .innerJoin(users, eq(followups.userId, users.id))
      .where(and(...conditions)).limit(1);

    if (!row) throw new NotFoundException('Followup not found');

    return {
      id: row.id, leadId: row.leadId, userId: row.userId, status: row.status,
      remarks: row.remarks, nextCallDate: row.nextCallDate, createdAt: row.createdAt,
      lead: { doerId: row.lead__doerId }, user: { name: row.user__name },
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
      .update(followups).set(updateData).where(eq(followups.id, id)).returning();

    const [user] = await this.database.db
      .select({ id: users.id, name: users.name })
      .from(users).where(eq(users.id, updated.userId)).limit(1);

    this.notificationsService
      .createNotificationForFollowup(updated.userId, id, updated.nextCallDate)
      .catch((err) => console.error('Failed to update notification:', err));

    return { ...updated, user };
  }

  async remove(id: string, userId?: string, role?: string) {
    await this.findOne(id, userId, role);
    const [deleted] = await this.database.db
      .delete(followups).where(eq(followups.id, id)).returning();
    return deleted;
  }

  async findCrossCampaign(phone?: string, email?: string, excludeLeadId?: string, userId?: string, role?: string) {
    if (!phone && !email) return [];

    const conditions: any[] = [eq(leads.isDeleted, false)];
    if (phone) {
      const normalized = phone.replace(/\D/g, '');
      conditions.push(or(eq(leads.phone, normalized), like(leads.phone, `%${normalized}%`)));
    }
    if (email) conditions.push(eq(leads.email, email.toLowerCase()));
    if (excludeLeadId) conditions.push(ne(leads.id, excludeLeadId));
    if (role === 'USER' && userId) conditions.push(eq(leads.doerId, userId));

    const rows = await this.database.db
      .select({
        id: followups.id, leadId: followups.leadId, userId: followups.userId,
        status: followups.status, remarks: followups.remarks,
        nextCallDate: followups.nextCallDate, createdAt: followups.createdAt,
        user__id: users.id, user__name: users.name, user__username: users.username,
        lead__id: leads.id, lead__name: leads.name, lead__campaignId: leads.campaignId,
        campaign__id: campaigns.id, campaign__name: campaigns.name,
      })
      .from(followups)
      .innerJoin(leads, eq(followups.leadId, leads.id))
      .innerJoin(users, eq(followups.userId, users.id))
      .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
      .where(and(...conditions))
      .orderBy(desc(followups.createdAt));

    return rows.map((r) => ({
      id: r.id, leadId: r.leadId, userId: r.userId, status: r.status,
      remarks: r.remarks, nextCallDate: r.nextCallDate, createdAt: r.createdAt,
      crossCampaign: true,
      matchedLead: { id: r.lead__id, name: r.lead__name, campaignId: r.lead__campaignId },
      user: { id: r.user__id, name: r.user__name, username: r.user__username },
      lead: { campaign: { id: r.campaign__id, name: r.campaign__name } },
    }));
  }
}
