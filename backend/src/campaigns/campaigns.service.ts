import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { eq, and, ne, inArray, sql, desc, asc } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { campaigns, campaignUsers, campaignStatuses, users, leads, forms } from '../db/schema';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AssignUsersDto } from './dto/assign-users.dto';

@Injectable()
export class CampaignsService {
  constructor(private database: DatabaseService) {}

  async create(dto: CreateCampaignDto, userId: string) {
    const [campaign] = await this.database.db
      .insert(campaigns)
      .values({
        name: dto.name,
        description: dto.description,
        managerId: userId,
      })
      .returning();

    // Create default statuses
    const defaultStatuses = [
      { label: 'New', color: '#3B82F6', order: 0 },
      { label: 'Contacted', color: '#F59E0B', order: 1 },
      { label: 'Interested', color: '#10B981', order: 2 },
      { label: 'Converted', color: '#059669', order: 3 },
      { label: 'Lost', color: '#EF4444', order: 4 },
    ];

    const statuses = await this.database.db
      .insert(campaignStatuses)
      .values(defaultStatuses.map((s) => ({ ...s, campaignId: campaign.id })))
      .returning();

    return { ...campaign, statuses };
  }

  async findAll(userId: string, role: string) {
    const leadCount = sql<number>`(SELECT count(*)::int FROM "Lead" WHERE "Lead"."campaignId" = ${campaigns.id} AND "Lead"."isDeleted" = false)`;
    const formCount = sql<number>`(SELECT count(*)::int FROM "Form" WHERE "Form"."campaignId" = ${campaigns.id})`;

    if (role === 'ADMIN') {
      const result = await this.database.db
        .select({
          campaign: campaigns,
          manager: {
            id: users.id,
            name: users.name,
            username: users.username,
          },
          leadCount,
          formCount,
        })
        .from(campaigns)
        .leftJoin(users, eq(campaigns.managerId, users.id))
        .orderBy(desc(campaigns.createdAt));

      return result.map((r) => ({
        ...r.campaign,
        manager: r.manager,
        _count: { leads: r.leadCount, forms: r.formCount },
      }));
    }

    // USER: only campaigns they're assigned to
    const assignedCampaignIds = this.database.db
      .select({ campaignId: campaignUsers.campaignId })
      .from(campaignUsers)
      .where(and(eq(campaignUsers.userId, userId), eq(campaignUsers.isActive, true)));

    const result = await this.database.db
      .select({
        campaign: campaigns,
        manager: {
          id: users.id,
          name: users.name,
          username: users.username,
        },
        leadCount,
        formCount,
      })
      .from(campaigns)
      .leftJoin(users, eq(campaigns.managerId, users.id))
      .where(and(inArray(campaigns.id, assignedCampaignIds), eq(campaigns.isActive, true)))
      .orderBy(desc(campaigns.createdAt));

    return result.map((r) => ({
      ...r.campaign,
      manager: r.manager,
      _count: { leads: r.leadCount, forms: r.formCount },
    }));
  }

  async findOne(id: string, userId?: string, role?: string) {
    const [result] = await this.database.db
      .select({
        campaign: campaigns,
        manager: {
          id: users.id,
          name: users.name,
          username: users.username,
        },
      })
      .from(campaigns)
      .leftJoin(users, eq(campaigns.managerId, users.id))
      .where(eq(campaigns.id, id))
      .limit(1);

    if (!result) throw new NotFoundException('Campaign not found');

    // Get assigned users
    const assignedUsers = await this.database.db
      .select({
        id: campaignUsers.id,
        campaignId: campaignUsers.campaignId,
        userId: campaignUsers.userId,
        isActive: campaignUsers.isActive,
        assignedAt: campaignUsers.assignedAt,
        user: {
          id: users.id,
          name: users.name,
          username: users.username,
        },
      })
      .from(campaignUsers)
      .innerJoin(users, eq(campaignUsers.userId, users.id))
      .where(eq(campaignUsers.campaignId, id));

    // Get statuses
    const statuses = await this.database.db
      .select()
      .from(campaignStatuses)
      .where(eq(campaignStatuses.campaignId, id))
      .orderBy(asc(campaignStatuses.order));

    const campaign = {
      ...result.campaign,
      manager: result.manager,
      assignedUsers,
      statuses,
    };

    // USER: check if assigned to this campaign
    if (role === 'USER' && userId) {
      const [isAssigned] = await this.database.db
        .select()
        .from(campaignUsers)
        .where(
          and(
            eq(campaignUsers.campaignId, id),
            eq(campaignUsers.userId, userId),
          ),
        )
        .limit(1);
      if (!isAssigned || !isAssigned.isActive) {
        throw new ForbiddenException('You are not assigned to this campaign');
      }
    }

    return campaign;
  }

  async update(id: string, dto: UpdateCampaignDto, userId?: string, role?: string) {
    await this.findOne(id, userId, role);
    const [updated] = await this.database.db
      .update(campaigns)
      .set(dto)
      .where(eq(campaigns.id, id))
      .returning();
    return updated;
  }

  async remove(id: string, userId?: string, role?: string) {
    await this.findOne(id, userId, role);
    const [updated] = await this.database.db
      .update(campaigns)
      .set({ isActive: false })
      .where(eq(campaigns.id, id))
      .returning();
    return updated;
  }

  async assignUsers(campaignId: string, dto: AssignUsersDto, userId?: string, role?: string) {
    await this.findOne(campaignId, userId, role);
    const uniqueUserIds = [...new Set(dto.userIds)];

    // Validate that only USER role users can be assigned to campaigns
    if (uniqueUserIds.length > 0) {
      const usersToAssign = await this.database.db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(inArray(users.id, uniqueUserIds));

      const invalidUsers = usersToAssign.filter((u) => u.role !== 'USER');
      if (invalidUsers.length > 0) {
        throw new ForbiddenException('Only USER role users can be assigned to campaigns');
      }
    }

    // Wrap entire assignment in a transaction for atomicity
    return this.database.db.transaction(async (tx) => {
      // Deactivate all current assignments
      await tx
        .update(campaignUsers)
        .set({ isActive: false })
        .where(and(eq(campaignUsers.campaignId, campaignId), eq(campaignUsers.isActive, true)));

      const results: any[] = [];
      for (const uid of uniqueUserIds) {
        const [existing] = await tx
          .select()
          .from(campaignUsers)
          .where(and(eq(campaignUsers.campaignId, campaignId), eq(campaignUsers.userId, uid)))
          .limit(1);

        if (existing) {
          const [updated] = await tx
            .update(campaignUsers)
            .set({ isActive: true })
            .where(eq(campaignUsers.id, existing.id))
            .returning();
          results.push(updated);
        } else {
          const [created] = await tx
            .insert(campaignUsers)
            .values({ campaignId, userId: uid })
            .returning();
          results.push(created);
        }
      }

      return results;
    });
  }

  async removeUser(campaignId: string, userId: string, requestUserId?: string, role?: string) {
    await this.findOne(campaignId, requestUserId, role);
    await this.database.db
      .update(campaignUsers)
      .set({ isActive: false })
      .where(and(eq(campaignUsers.campaignId, campaignId), eq(campaignUsers.userId, userId)));
  }

  async getAssignedUsers(campaignId: string, userId?: string, role?: string) {
    await this.findOne(campaignId, userId, role);
    return this.database.db
      .select({
        id: campaignUsers.id,
        campaignId: campaignUsers.campaignId,
        userId: campaignUsers.userId,
        isActive: campaignUsers.isActive,
        assignedAt: campaignUsers.assignedAt,
        user: {
          id: users.id,
          name: users.name,
          username: users.username,
          role: users.role,
        },
      })
      .from(campaignUsers)
      .innerJoin(users, eq(campaignUsers.userId, users.id))
      .where(and(eq(campaignUsers.campaignId, campaignId), eq(campaignUsers.isActive, true)));
  }
}
