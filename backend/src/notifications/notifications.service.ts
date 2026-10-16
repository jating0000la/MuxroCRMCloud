import { Injectable } from '@nestjs/common';
import { eq, and, or, inArray, desc, asc, sql, notInArray } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { notifications, followups, leads, users } from '../db/schema';

@Injectable()
export class NotificationsService {
  constructor(private database: DatabaseService) {}

  private leadScope(userId: string) {
    return and(eq(leads.isDeleted, false), eq(leads.dnd, false),
      or(eq(leads.doerId, userId), sql`EXISTS (SELECT 1 FROM "User" caller
        WHERE caller.id = ${userId} AND caller.role = 'ADMIN' AND caller."isActive" = true)`));
  }

  private getNotificationType(date: Date | null) {
    const time = date?.getTime() || 0;
    return time > Date.now() && time < Date.now() + 600000 ? 'upcoming' : 'warning';
  }

  async createNotificationForFollowup(userId: string, followupId: string, _nextCallDate?: Date | null): Promise<void> {
    const [followup] = await this.database.db.select({ nextCallDate: followups.nextCallDate }).from(followups)
      .innerJoin(leads, eq(followups.leadId, leads.id))
      .where(and(eq(followups.id, followupId), this.leadScope(userId))).limit(1);
    if (!followup?.nextCallDate) return;
    await this.database.db.insert(notifications)
      .values({ userId, followupId, type: this.getNotificationType(followup.nextCallDate) })
      .onConflictDoUpdate({ target: [notifications.userId, notifications.followupId],
        set: { type: this.getNotificationType(followup.nextCallDate) } });
  }

  private pendingScope(userId: string) {
    return and(eq(notifications.userId, userId), eq(notifications.type, 'upcoming'),
      eq(notifications.isRead, false), this.leadScope(userId),
      sql`${followups.nextCallDate} > now() AND ${followups.nextCallDate} < now() + interval '10 minutes'`);
  }

  async getPendingNotifications(userId: string) {
    const rows = await this.database.db.selectDistinctOn([followups.leadId], {
      notification: notifications, followup: followups,
      lead: { id: leads.id, name: leads.name }, user: { id: users.id, name: users.name },
    }).from(notifications).innerJoin(followups, eq(notifications.followupId, followups.id))
      .innerJoin(leads, eq(followups.leadId, leads.id)).innerJoin(users, eq(followups.userId, users.id))
      .where(this.pendingScope(userId))
      .orderBy(followups.leadId, desc(followups.createdAt), desc(followups.id));
    return rows.sort((a, b) => a.followup.nextCallDate!.getTime() - b.followup.nextCallDate!.getTime())
      .map(row => ({ ...row.notification, followup: { ...row.followup, lead: row.lead, user: row.user } }));
  }

  async getPendingCount(userId: string) {
    const [row] = await this.database.db.select({ count: sql<number>`count(distinct ${leads.id})::int` })
      .from(notifications).innerJoin(followups, eq(notifications.followupId, followups.id))
      .innerJoin(leads, eq(followups.leadId, leads.id)).where(this.pendingScope(userId));
    return row?.count || 0;
  }

  async getPendingWithCount(userId: string) {
    const [items, count] = await Promise.all([this.getPendingNotifications(userId), this.getPendingCount(userId)]);
    return { notifications: items, count };
  }

  async getNotifications(userId: string, limit = 20) {
    const rows = await this.database.db.select({ notification: notifications, followup: followups,
      lead: { id: leads.id, name: leads.name }, user: { id: users.id, name: users.name },
    }).from(notifications).innerJoin(followups, eq(notifications.followupId, followups.id))
      .innerJoin(leads, eq(followups.leadId, leads.id)).innerJoin(users, eq(followups.userId, users.id))
      .where(and(eq(notifications.userId, userId), this.leadScope(userId)))
      .orderBy(asc(notifications.isRead), desc(notifications.createdAt)).limit(limit);
    return rows.map(row => ({ ...row.notification, followup: { ...row.followup, lead: row.lead, user: row.user } }));
  }

  async markAsRead(id: string, userId: string) {
    const [updated] = await this.database.db.update(notifications).set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId))).returning();
    return updated;
  }

  async markAllAsRead(userId: string) {
    await this.database.db.update(notifications).set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async syncNotificationsForUser(userId: string): Promise<void> {
    await this.database.db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`notifications:${userId}`}))`);
      const latest = await tx.selectDistinctOn([followups.leadId], {
        id: followups.id, nextCallDate: followups.nextCallDate,
      }).from(followups).innerJoin(leads, eq(followups.leadId, leads.id))
        .where(and(this.leadScope(userId), or(eq(leads.doerId, userId), eq(followups.userId, userId))))
        .orderBy(followups.leadId, desc(followups.createdAt), desc(followups.id));
      const rows = latest.filter(f => f.nextCallDate).map(f => ({
        userId, followupId: f.id, type: this.getNotificationType(f.nextCallDate),
      }));
      for (let start = 0; start < rows.length; start += 200) {
        await tx.insert(notifications).values(rows.slice(start, start + 200))
          .onConflictDoUpdate({ target: [notifications.userId, notifications.followupId], set: { type: sql`excluded.type` } });
      }
      const visible = tx.selectDistinctOn([followups.leadId], { id: followups.id }).from(followups)
        .innerJoin(leads, eq(followups.leadId, leads.id))
        .where(and(this.leadScope(userId), or(eq(leads.doerId, userId), eq(followups.userId, userId))))
        .orderBy(followups.leadId, desc(followups.createdAt), desc(followups.id));
      await tx.delete(notifications).where(and(eq(notifications.userId, userId), notInArray(notifications.followupId, visible)));
    });
    await this.cleanupOldNotifications(userId);
  }

  async cleanupOldNotifications(userId: string): Promise<void> {
    const obsolete = this.database.db.select({ id: followups.id }).from(followups)
      .where(sql`${followups.nextCallDate} < now() - interval '7 days'`);
    await this.database.db.delete(notifications).where(and(eq(notifications.userId, userId), inArray(notifications.followupId, obsolete)));
  }
}
