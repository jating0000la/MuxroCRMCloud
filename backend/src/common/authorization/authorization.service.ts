import { Injectable, ForbiddenException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import { campaignUsers, leads, followups, campaigns, users } from '../../db/schema';

export type ResourceType = 'campaign' | 'lead' | 'followup' | 'user';

@Injectable()
export class AuthorizationService {
  constructor(private database: DatabaseService) {}

  async ensureCampaignAccess(campaignId: string, userId: string, userRole: string): Promise<void> {
    if (userRole === 'ADMIN') return;

    const [assignment] = await this.database.db
      .select({ id: campaignUsers.id })
      .from(campaignUsers)
      .where(
        and(
          eq(campaignUsers.campaignId, campaignId),
          eq(campaignUsers.userId, userId),
          eq(campaignUsers.isActive, true),
        ),
      )
      .limit(1);

    if (!assignment) {
      throw new ForbiddenException('You are not assigned to this campaign');
    }
  }

  async ensureLeadAccess(leadId: string, userId: string, userRole: string): Promise<void> {
    if (userRole === 'ADMIN') return;

    const [lead] = await this.database.db
      .select({ doerId: leads.doerId, campaignId: leads.campaignId })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) {
      throw new ForbiddenException('Lead not found');
    }

    if (lead.doerId === userId) return;

    const [assignment] = await this.database.db
      .select({ id: campaignUsers.id })
      .from(campaignUsers)
      .where(
        and(
          eq(campaignUsers.campaignId, lead.campaignId),
          eq(campaignUsers.userId, userId),
          eq(campaignUsers.isActive, true),
        ),
      )
      .limit(1);

    if (!assignment) {
      throw new ForbiddenException('You do not have access to this lead');
    }
  }

  async ensureLeadWriteAccess(leadId: string, userId: string, userRole: string): Promise<void> {
    if (userRole === 'ADMIN') return;

    const [lead] = await this.database.db
      .select({ doerId: leads.doerId })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) {
      throw new ForbiddenException('Lead not found');
    }

    if (lead.doerId !== userId) {
      throw new ForbiddenException('You can only modify leads assigned to you');
    }
  }

  async ensureFollowupAccess(followupId: string, userId: string, userRole: string): Promise<void> {
    if (userRole === 'ADMIN') return;

    const [followup] = await this.database.db
      .select({ userId: followups.userId })
      .from(followups)
      .where(eq(followups.id, followupId))
      .limit(1);

    if (!followup) {
      throw new ForbiddenException('Followup not found');
    }

    if (followup.userId !== userId) {
      throw new ForbiddenException('You do not have access to this followup');
    }
  }

  async ensureUserModifyAccess(targetUserId: string, callerId: string, callerRole: string): Promise<void> {
    if (callerRole !== 'ADMIN') {
      throw new ForbiddenException('Only admins can modify users');
    }

    if (targetUserId === callerId) return;

    const [target] = await this.database.db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (target?.role === 'ADMIN') {
      throw new ForbiddenException('Admins cannot modify other admin accounts');
    }
  }

  async getUserCampaignIds(userId: string, userRole: string): Promise<string[]> {
    if (userRole === 'ADMIN') {
      const allCampaigns = await this.database.db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.isActive, true));
      return allCampaigns.map((c) => c.id);
    }

    const assigned = await this.database.db
      .select({ campaignId: campaignUsers.campaignId })
      .from(campaignUsers)
      .where(and(eq(campaignUsers.userId, userId), eq(campaignUsers.isActive, true)));
    return assigned.map((a) => a.campaignId);
  }
}
