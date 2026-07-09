import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { campaignStatuses, leads } from '../db/schema';

@Injectable()
export class CampaignStatusesService {
  constructor(private database: DatabaseService) {}

  async findAll(campaignId: string) {
    return this.database.db
      .select()
      .from(campaignStatuses)
      .where(eq(campaignStatuses.campaignId, campaignId))
      .orderBy(asc(campaignStatuses.order));
  }

  async create(campaignId: string, data: { label: string; color?: string; whatsappMessage?: string }) {
    const [maxOrder] = await this.database.db
      .select({ order: campaignStatuses.order })
      .from(campaignStatuses)
      .where(eq(campaignStatuses.campaignId, campaignId))
      .orderBy(desc(campaignStatuses.order))
      .limit(1);

    const [created] = await this.database.db
      .insert(campaignStatuses)
      .values({
        campaignId,
        label: data.label,
        color: data.color || '#3B82F6',
        whatsappMessage: data.whatsappMessage || null,
        order: (maxOrder?.order ?? -1) + 1,
      })
      .returning();

    return created;
  }

  async update(id: string, data: { label?: string; color?: string; order?: number; whatsappMessage?: string }) {
    await this.findOne(id);
    const [updated] = await this.database.db
      .update(campaignStatuses)
      .set(data)
      .where(eq(campaignStatuses.id, id))
      .returning();
    return updated;
  }

  async remove(id: string) {
    const status = await this.findOne(id);

    // Check if any leads are using this status
    const [{ count }] = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.statusId, id));

    if (count > 0) {
      throw new ForbiddenException(
        `Cannot delete status "${status.label}" - ${count} lead(s) are using it. Reassign them first.`,
      );
    }

    await this.database.db.delete(campaignStatuses).where(eq(campaignStatuses.id, id));
  }

  private async findOne(id: string) {
    const [status] = await this.database.db
      .select()
      .from(campaignStatuses)
      .where(eq(campaignStatuses.id, id))
      .limit(1);
    if (!status) throw new NotFoundException('Status not found');
    return status;
  }
}
