import { Injectable, BadRequestException } from '@nestjs/common';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import { leads, campaignUsers, users, roundRobinCursors } from '../../db/schema';

export type AllocationTransaction = Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0];

@Injectable()
export class RoundRobinService {
  constructor(private database: DatabaseService) {}

  private async getEligibleUsers(campaignId: string, tx: AllocationTransaction) {
    const eligible = await tx.select({ userId: users.id }).from(campaignUsers)
      .innerJoin(users, eq(campaignUsers.userId, users.id))
      .where(and(eq(campaignUsers.campaignId, campaignId), eq(campaignUsers.isActive, true),
        eq(users.isActive, true), eq(users.role, 'USER')))
      .orderBy(asc(campaignUsers.assignedAt), asc(campaignUsers.id))
      .for('share');
    if (!eligible.length) throw new BadRequestException('No telecaller users assigned to this campaign. Please assign active USER role users before creating leads.');
    return eligible;
  }

  // Selection and insertion must share a transaction so the campaign lock lasts
  // through the write. Never open a second pool connection inside that transaction.
  async getNextRoundRobinUser(campaignId: string, tx: AllocationTransaction): Promise<string> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${campaignId}))`);
    const eligible = await this.getEligibleUsers(campaignId, tx);
    const [cursor] = await tx.select().from(roundRobinCursors)
      .where(eq(roundRobinCursors.campaignId, campaignId)).limit(1);
    let previous = cursor?.userId;
    if (!cursor) {
      const [last] = await tx.select({ doerId: leads.doerId }).from(leads)
        .where(and(eq(leads.campaignId, campaignId), eq(leads.isDeleted, false), sql`${leads.doerId} IS NOT NULL`))
        .orderBy(desc(leads.createdAt), desc(leads.id)).limit(1);
      previous = last?.doerId;
    }
    const next = (eligible.findIndex(user => user.userId === previous) + 1) % eligible.length;
    await tx.insert(roundRobinCursors).values({ campaignId, userId: eligible[next].userId })
      .onConflictDoUpdate({ target: roundRobinCursors.campaignId, set: { userId: eligible[next].userId } });
    return eligible[next].userId;
  }

  async allocateRoundRobin(campaignId: string, leadIds: string[], transaction?: AllocationTransaction) {
    if (!leadIds.length || leadIds.length > 5000 || new Set(leadIds).size !== leadIds.length) {
      throw new BadRequestException('Allocate between 1 and 5000 distinct leads');
    }
    const allocate = async (tx: AllocationTransaction) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${campaignId}))`);
      const nextUserId = await this.getNextRoundRobinUser(campaignId, tx);
      const eligible = await this.getEligibleUsers(campaignId, tx);
      const start = eligible.findIndex(user => user.userId === nextUserId);
      const allocations: (typeof leads.$inferSelect)[] = [];
      for (const [index, id] of leadIds.entries()) {
        const [updated] = await tx.update(leads)
          .set({ doerId: eligible[(start + index) % eligible.length].userId, updatedAt: sql`clock_timestamp()` })
          .where(and(eq(leads.id, id), eq(leads.campaignId, campaignId), eq(leads.isDeleted, false)))
          .returning();
        if (!updated) throw new BadRequestException('Every lead must be an existing, non-deleted lead in this campaign');
        allocations.push(updated);
      }
      await tx.update(roundRobinCursors).set({ userId: allocations[allocations.length - 1].doerId })
        .where(eq(roundRobinCursors.campaignId, campaignId));
      return allocations;
    };
    return transaction ? allocate(transaction) : this.database.db.transaction(allocate);
  }
}
