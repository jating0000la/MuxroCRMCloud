import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { subHours, startOfDay, endOfDay, isBefore, isAfter } from 'date-fns';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get notification type based on followup due date
   */
  private getNotificationType(nextCallDate: Date | null): string {
    if (!nextCallDate) return 'warning';

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    // Overdue - past the due date
    if (isBefore(nextCallDate, today)) {
      return 'overdue';
    }

    // Today
    if (
      isAfter(nextCallDate, startOfDay(today)) &&
      isBefore(nextCallDate, endOfDay(today))
    ) {
      return 'today';
    }

    // Tomorrow
    if (
      isAfter(nextCallDate, startOfDay(tomorrow)) &&
      isBefore(nextCallDate, endOfDay(tomorrow))
    ) {
      return 'tomorrow';
    }

    return 'warning';
  }

  /**
   * Create or update notifications for a followup
   */
  async createNotificationForFollowup(
    userId: string,
    followupId: string,
  ): Promise<void> {
    const followup = await this.prisma.followup.findUnique({
      where: { id: followupId },
    });

    if (!followup) return;

    const type = this.getNotificationType(followup.nextCallDate);

    // Skip creating notifications only if there's no next call date
    if (!followup.nextCallDate) return;

    // Check if notification already exists
    const existing = await this.prisma.notification.findUnique({
      where: {
        userId_followupId: {
          userId,
          followupId,
        },
      },
    });

    if (existing && existing.type === type) {
      return; // No need to update
    }

    // Upsert notification
    await this.prisma.notification.upsert({
      where: {
        userId_followupId: {
          userId,
          followupId,
        },
      },
      update: {
        type,
      },
      create: {
        userId,
        followupId,
        type,
      },
    });
  }

  /**
   * Get all pending notifications for a user (overdue + today + tomorrow)
   */
  async getPendingNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        type: { in: ['overdue', 'today', 'tomorrow'] },
        isRead: false,
      },
      include: {
        followup: {
          include: {
            lead: {
              select: { id: true, name: true },
            },
            user: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: [{ type: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Get all notifications for a user
   */
  async getNotifications(userId: string, limit = 20) {
    return this.prisma.notification.findMany({
      where: { userId },
      include: {
        followup: {
          include: {
            lead: {
              select: { id: true, name: true },
            },
            user: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  /**
   * Get count of pending notifications (overdue + today)
   */
  async getPendingCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        type: { in: ['overdue', 'today'] },
        isRead: false,
      },
    });
  }

  /**
   * Sync notifications for all user followups
   */
  async syncNotificationsForUser(userId: string): Promise<void> {
    const followups = await this.prisma.followup.findMany({
      where: { userId, lead: { dnd: false } },
      select: { id: true },
    });

    for (const followup of followups) {
      await this.createNotificationForFollowup(userId, followup.id);
    }

    // Clean up old notifications that are no longer relevant
    await this.cleanupOldNotifications(userId);
  }

  /**
   * Clean up notifications for completed/cancelled followups
   */
  private async cleanupOldNotifications(userId: string): Promise<void> {
    // Delete notifications for followups that are in the past
    const pastNotifications = await this.prisma.notification.findMany({
      where: {
        userId,
        followup: {
          nextCallDate: {
            lt: new Date(new Date().setDate(new Date().getDate() - 7)), // More than 7 days old
          },
        },
      },
      select: { id: true },
    });

    if (pastNotifications.length > 0) {
      await this.prisma.notification.deleteMany({
        where: { id: { in: pastNotifications.map((n) => n.id) } },
      });
    }
  }
}
