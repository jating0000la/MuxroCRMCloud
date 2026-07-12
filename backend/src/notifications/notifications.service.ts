import { Injectable } from '@nestjs/common';
import { eq, and, inArray, desc, asc, sql } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { notifications, followups, leads, users } from '../db/schema';
import { subHours, startOfDay, endOfDay, isBefore, isAfter } from 'date-fns';

@Injectable()
export class NotificationsService {
  constructor(private database: DatabaseService) {}

  private getNotificationType(nextCallDate: Date | null): string {
    if (!nextCallDate) return 'warning';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    if (isBefore(nextCallDate, today)) {
      return 'overdue';
    }

    if (
      isAfter(nextCallDate, startOfDay(today)) &&
      isBefore(nextCallDate, endOfDay(today))
    ) {
      return 'today';
    }

    if (
      isAfter(nextCallDate, startOfDay(tomorrow)) &&
      isBefore(nextCallDate, endOfDay(tomorrow))
    ) {
      return 'tomorrow';
    }

    return 'warning';
  }

  async createNotificationForFollowup(
    userId: string,
    followupId: string,
  ): Promise<void> {
    const [followup] = await this.database.db
      .select()
      .from(followups)
      .where(eq(followups.id, followupId))
      .limit(1);

    if (!followup) return;

    const type = this.getNotificationType(followup.nextCallDate);

    if (!followup.nextCallDate) return;

    const [existing] = await this.database.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.followupId, followupId),
        ),
      )
      .limit(1);

    if (existing && existing.type === type) {
      return;
    }

    if (existing) {
      await this.database.db
        .update(notifications)
        .set({ type })
        .where(eq(notifications.id, existing.id));
    } else {
      await this.database.db.insert(notifications).values({
        userId,
        followupId,
        type,
      });
    }
  }

  async getPendingNotifications(userId: string) {
    const results = await this.database.db
      .select({
        notification: notifications,
        followup: {
          ...followups,
          lead: {
            id: leads.id,
            name: leads.name,
          },
          user: {
            id: users.id,
            name: users.name,
          },
        },
      })
      .from(notifications)
      .innerJoin(followups, eq(notifications.followupId, followups.id))
      .innerJoin(leads, eq(followups.leadId, leads.id))
      .innerJoin(users, eq(followups.userId, users.id))
      .where(
        and(
          eq(notifications.userId, userId),
          inArray(notifications.type, ['overdue', 'today', 'tomorrow']),
          eq(notifications.isRead, false),
        ),
      )
      .orderBy(desc(notifications.type), desc(notifications.createdAt));

    return results.map((r) => ({
      ...r.notification,
      followup: r.followup,
    }));
  }

  async getNotifications(userId: string, limit = 20) {
    const results = await this.database.db
      .select({
        notification: notifications,
        followup: {
          ...followups,
          lead: {
            id: leads.id,
            name: leads.name,
          },
          user: {
            id: users.id,
            name: users.name,
          },
        },
      })
      .from(notifications)
      .innerJoin(followups, eq(notifications.followupId, followups.id))
      .innerJoin(leads, eq(followups.leadId, leads.id))
      .innerJoin(users, eq(followups.userId, users.id))
      .where(eq(notifications.userId, userId))
      .orderBy(asc(notifications.isRead), desc(notifications.createdAt))
      .limit(limit);

    return results.map((r) => ({
      ...r.notification,
      followup: r.followup,
    }));
  }

  async markAsRead(notificationId: string, userId: string) {
    const [updated] = await this.database.db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning();
    return updated;
  }

  async markAllAsRead(userId: string) {
    await this.database.db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async getPendingCount(userId: string): Promise<number> {
    const [{ count }] = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          inArray(notifications.type, ['overdue', 'today']),
          eq(notifications.isRead, false),
        ),
      );
    return count;
  }

  async syncNotificationsForUser(userId: string): Promise<void> {
    const followupsList = await this.database.db
      .select({
        id: followups.id,
        nextCallDate: followups.nextCallDate,
      })
      .from(followups)
      .innerJoin(leads, eq(followups.leadId, leads.id))
      .where(and(eq(followups.userId, userId), eq(leads.dnd, false)));

    const followupIds = followupsList.map((f) => f.id);
    if (followupIds.length === 0) {
      await this.cleanupOldNotifications(userId);
      return;
    }

    const existingNotifications = await this.database.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          inArray(notifications.followupId, followupIds),
        ),
      );

    const existingMap = new Map(existingNotifications.map((n) => [n.followupId, n]));
    const followupMap = new Map(followupsList.map((f) => [f.id, f]));

    const toInsert: { userId: string; followupId: string; type: string }[] = [];
    const toUpdate: { id: string; type: string }[] = [];

    for (const followupId of followupIds) {
      const followup = followupMap.get(followupId);
      if (!followup?.nextCallDate) continue;

      const type = this.getNotificationType(followup.nextCallDate);
      const existing = existingMap.get(followupId);

      if (existing && existing.type !== type) {
        toUpdate.push({ id: existing.id, type });
      } else if (!existing) {
        toInsert.push({ userId, followupId, type });
      }
    }

    if (toInsert.length > 0) {
      await this.database.db.insert(notifications).values(toInsert);
    }
    if (toUpdate.length > 0) {
      for (const update of toUpdate) {
        await this.database.db
          .update(notifications)
          .set({ type: update.type })
          .where(eq(notifications.id, update.id));
      }
    }

    await this.cleanupOldNotifications(userId);
  }

  private async cleanupOldNotifications(userId: string): Promise<void> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const pastNotifications = await this.database.db
      .select({ id: notifications.id })
      .from(notifications)
      .innerJoin(followups, eq(notifications.followupId, followups.id))
      .where(
        and(
          eq(notifications.userId, userId),
          sql`${followups.nextCallDate} < ${sevenDaysAgo}`,
        ),
      );

    if (pastNotifications.length > 0) {
      await this.database.db
        .delete(notifications)
        .where(inArray(notifications.id, pastNotifications.map((n) => n.id)));
    }
  }
}
