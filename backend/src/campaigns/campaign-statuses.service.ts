import { TemplateMessageConfig } from '../integrations/templates/template.types';
import { GupshupTemplatesService } from '../integrations/templates/gupshup-templates.service';
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { campaignStatuses, leads } from '../db/schema';

@Injectable()
export class CampaignStatusesService {
  constructor(private database: DatabaseService, private templates: GupshupTemplatesService) {}

  async findAll(campaignId: string) {
    return this.database.db
      .select()
      .from(campaignStatuses)
      .where(eq(campaignStatuses.campaignId, campaignId))
      .orderBy(asc(campaignStatuses.order));
  }

  async create(campaignId: string, data: { label: string; color?: string; whatsappMessage?: string; whatsappTemplate?: TemplateMessageConfig | null }) {
    if (data.whatsappTemplate) await this.templates.validateConfig(data.whatsappTemplate);
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
        whatsappTemplate: data.whatsappTemplate || null,
        order: (maxOrder?.order ?? -1) + 1,
      })
      .returning();

    return created;
  }

  async update(campaignId: string, id: string, data: { label?: string; color?: string; order?: number; whatsappMessage?: string; whatsappTemplate?: TemplateMessageConfig | null }) {
    const current = await this.findOne(campaignId, id);
    if (data.whatsappTemplate) await this.templates.validateConfig(data.whatsappTemplate);
    if (Object.values(data).every(value => value === undefined)) return current;
    const [updated] = await this.database.db
      .update(campaignStatuses)
      .set({
        label: data.label, color: data.color, order: data.order, whatsappMessage: data.whatsappMessage, whatsappTemplate: data.whatsappTemplate,
      })
      .where(and(eq(campaignStatuses.id, id), eq(campaignStatuses.campaignId, campaignId)))
      .returning();
    return updated;
  }

  async remove(campaignId: string, id: string) {
    const status = await this.findOne(campaignId, id);

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

    await this.database.db.delete(campaignStatuses).where(and(eq(campaignStatuses.id, id), eq(campaignStatuses.campaignId, campaignId)));
  }

  private async findOne(campaignId: string, id: string) {
    const [status] = await this.database.db
      .select()
      .from(campaignStatuses)
      .where(and(eq(campaignStatuses.id, id), eq(campaignStatuses.campaignId, campaignId)))
      .limit(1);
    if (!status) throw new NotFoundException('Status not found');
    return status;
  }
}
