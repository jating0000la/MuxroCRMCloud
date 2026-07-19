import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import { leads, campaignUsers, users } from '../../db/schema';

@Injectable()
export class RoundRobinService {
  private logger = new Logger('RoundRobinService');

  constructor(private database: DatabaseService) {}

  private async getEligibleUsers(campaignId: string) {
    const activeUsers = await this.database.db
      .select({
        userId: campaignUsers.userId,
        role: users.role,
      })
      .from(campaignUsers)
      .innerJoin(users, eq(campaignUsers.userId, users.id))
      .where(and(eq(campaignUsers.campaignId, campaignId), eq(campaignUsers.isActive, true)))
      .orderBy(asc(campaignUsers.assignedAt));

    const eligibleUsers = activeUsers.filter((au) => au.role === 'USER');

    if (eligibleUsers.length === 0) {
      throw new BadRequestException('No telecaller users assigned to this campaign. Please assign USER role users before creating leads.');
    }

    return eligibleUsers;
  }

  async getNextRoundRobinUser(campaignId: string): Promise<string> {
    const eligibleUsers = await this.getEligibleUsers(campaignId);

    const [lastAssignedLead] = await this.database.db
      .select({ doerId: leads.doerId })
      .from(leads)
      .where(and(eq(leads.campaignId, campaignId), sql`${leads.doerId} IS NOT NULL`))
      .orderBy(desc(leads.createdAt))
      .limit(1);

    if (!lastAssignedLead?.doerId) {
      return eligibleUsers[0].userId;
    }

    const lastIndex = eligibleUsers.findIndex((u) => u.userId === lastAssignedLead.doerId);
    const nextIndex = (lastIndex + 1) % eligibleUsers.length;
    return eligibleUsers[nextIndex].userId;
  }

  async allocateRoundRobin(campaignId: string, leadIds: string[]): Promise<any[]> {
    const eligibleUsers = await this.getEligibleUsers(campaignId);

    const [lastAssignedLead] = await this.database.db
      .select({ doerId: leads.doerId })
      .from(leads)
      .where(and(eq(leads.campaignId, campaignId), sql`${leads.doerId} IS NOT NULL`))
      .orderBy(desc(leads.createdAt))
      .limit(1);

    let startIndex = 0;
    if (lastAssignedLead?.doerId) {
      const lastIndex = eligibleUsers.findIndex((u) => u.userId === lastAssignedLead.doerId);
      if (lastIndex !== -1) {
        startIndex = (lastIndex + 1) % eligibleUsers.length;
      }
    }

    return await this.database.db.transaction(async (tx) => {
      // Advisory lock on campaign (hash campaignId to bigint) — prevents concurrent allocations
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${campaignId}))`);

      const allocations: any[] = [];
      for (let i = 0; i < leadIds.length; i++) {
        const userIndex = (startIndex + i) % eligibleUsers.length;
        const [updated] = await tx
          .update(leads)
          .set({ doerId: eligibleUsers[userIndex].userId })
          .where(eq(leads.id, leadIds[i]))
          .returning();
        allocations.push(updated);
      }

      return allocations;
    });
  }
}
