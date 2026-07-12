import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { eq, and, desc, asc, inArray } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { forms, enquiries, leads, campaignStatuses, followups, campaigns } from '../db/schema';
import { PaginationDto } from '../common/pagination.dto';
import { RoundRobinService } from '../common/services/round-robin.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { GupshupService } from '../integrations/gupshup.service';
import { SettingsService } from '../settings/settings.service';
import { v4 as uuidv4 } from 'uuid';

type PublicFormField = {
  name?: unknown;
  label?: unknown;
  type?: unknown;
  required?: unknown;
  options?: unknown;
  min?: unknown;
  max?: unknown;
};

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    private database: DatabaseService,
    private gupshup: GupshupService,
    private settingsService: SettingsService,
    private roundRobinService: RoundRobinService,
  ) {}

  async create(campaignId: string, dto: CreateFormDto) {
    const [existingForm] = await this.database.db
      .select()
      .from(forms)
      .where(eq(forms.campaignId, campaignId))
      .limit(1);

    if (existingForm) {
      throw new BadRequestException('This campaign already has a form. Each campaign can only have one form.');
    }

    const [form] = await this.database.db
      .insert(forms)
      .values({
        campaignId,
        title: dto.title,
        fields: (dto.fields || []) as any,
        publicSlug: uuidv4().substring(0, 8),
      })
      .returning();

    return form;
  }

  async findByCampaign(campaignId: string) {
    return this.database.db
      .select()
      .from(forms)
      .where(eq(forms.campaignId, campaignId))
      .orderBy(desc(forms.createdAt));
  }

  async findOne(id: string) {
    const [form] = await this.database.db
      .select({
        form: forms,
        campaign: campaigns,
      })
      .from(forms)
      .innerJoin(campaigns, eq(forms.campaignId, campaigns.id))
      .where(eq(forms.id, id))
      .limit(1);

    if (!form) throw new NotFoundException('Form not found');
    return { ...form.form, campaign: form.campaign };
  }

  async findBySlug(slug: string) {
    const [result] = await this.database.db
      .select({
        form: forms,
        campaign: { name: campaigns.name },
      })
      .from(forms)
      .innerJoin(campaigns, eq(forms.campaignId, campaigns.id))
      .where(eq(forms.publicSlug, slug))
      .limit(1);

    if (!result || !result.form.isPublished) throw new NotFoundException('Form not found');
    return { ...result.form, campaign: result.campaign };
  }

  async submitForm(slug: string, data: Record<string, any>, ipAddress?: string) {
    const form = await this.findBySlug(slug);
    const fields = Array.isArray(form.fields) ? form.fields as PublicFormField[] : [];
    this.validateSubmissionData(fields, data);

    // Wrap enquiry + lead + followup creation in a transaction
    const result = await this.database.db.transaction(async (tx) => {
      const [submission] = await tx
        .insert(enquiries)
        .values({
          formId: form.id,
          data,
          ipAddress,
        })
        .returning();

      const name = data.name || data.Name || 'Unknown';
      const email = data.email || data.Email || null;
      const phone = data.phone || data.Phone || null;

      const doerId = await this.roundRobinService.getNextRoundRobinUser(form.campaignId);

      const [firstStatus] = await tx
        .select()
        .from(campaignStatuses)
        .where(eq(campaignStatuses.campaignId, form.campaignId))
        .orderBy(asc(campaignStatuses.order))
        .limit(1);

      const [lead] = await tx
        .insert(leads)
        .values({
          campaignId: form.campaignId,
          enquiryId: submission.id,
          name,
          email,
          phone,
          source: 'form',
          customData: data,
          doerId,
          statusId: firstStatus?.id || null,
        })
        .returning();

      const statusLabel = firstStatus?.label || 'New';
      await tx.insert(followups).values({
        leadId: lead.id,
        userId: doerId,
        status: statusLabel,
        remarks: 'Form submitted',
      });

      return { submission, lead, phone, name, data, doerId };
    });

    // Send greeting outside transaction (non-blocking)
    const metaField = fields.find((f: any) => f.type === '__design_meta' || f.name === '__form_meta');
    const formComm = (metaField as any)?.meta?.communication || {};
    this.sendFormGreeting(result.phone, result.name, formComm, result.data).catch((err) => {
      this.logger.warn(`Form greeting failed: ${err.message}`);
    });

    return { submission: result.submission, lead: result.lead };
  }

  async update(id: string, dto: UpdateFormDto) {
    await this.findOne(id);
    const updateData: any = { ...dto };
    if (dto.fields) {
      updateData.fields = dto.fields as any;
    }
    const [updated] = await this.database.db
      .update(forms)
      .set(updateData)
      .where(eq(forms.id, id))
      .returning();
    return updated;
  }

  async publish(id: string) {
    await this.findOne(id);
    const [updated] = await this.database.db
      .update(forms)
      .set({ isPublished: true })
      .where(eq(forms.id, id))
      .returning();
    return updated;
  }

  async unpublish(id: string) {
    await this.findOne(id);
    const [updated] = await this.database.db
      .update(forms)
      .set({ isPublished: false })
      .where(eq(forms.id, id))
      .returning();
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);

    return await this.database.db.transaction(async (tx) => {
      // Null out enquiryId on any leads that reference this form's enquiries
      // to avoid FK violation when cascade-deleting enquiries
      const formEnquiries = await tx
        .select({ id: enquiries.id })
        .from(enquiries)
        .where(eq(enquiries.formId, id));

      if (formEnquiries.length > 0) {
        const enquiryIds = formEnquiries.map((e) => e.id);
        await tx
          .update(leads)
          .set({ enquiryId: null })
          .where(inArray(leads.enquiryId, enquiryIds));
      }

      const [deleted] = await tx
        .delete(forms)
        .where(eq(forms.id, id))
        .returning();
      return deleted;
    });
  }

  async getSubmissions(formId: string, pagination?: PaginationDto) {
    const skip = pagination?.getSkip() || 0;
    const take = pagination?.getTake() || 50;

    return this.database.db
      .select()
      .from(enquiries)
      .where(eq(enquiries.formId, formId))
      .orderBy(desc(enquiries.submittedAt))
      .offset(skip)
      .limit(take);
  }

  private async sendFormGreeting(
    phone: string | null,
    name: string,
    formComm: Record<string, any> = {},
    formData: Record<string, any> = {},
  ): Promise<void> {
    if (!phone) return;

    try {
      const formEnabled = formComm.whatsappEnabled === true;
      const rawMessage = formComm.greetingMessage || '';

      if (!formEnabled || !rawMessage) return;

      const apiKey = await this.getSettingValue('gupshupApiKey');
      const source = await this.getSettingValue('gupshupSource');
      const appName = await this.getSettingValue('gupshupAppName');

      const normalizedPhone = String(phone).replace(/\D/g, '');
      if (!normalizedPhone) {
        this.logger.warn('Form greeting skipped: submitted phone number is invalid');
        return;
      }

      if (!apiKey || !source || !appName) {
        this.logger.warn('Form greeting skipped: missing Gupshup global config');
        return;
      }

      const message = rawMessage.replace(/\{\{(\w+)\}\}/g, (_, field) => {
        const value = formData[field];
        if (value === undefined || value === null) return '';
        return String(value);
      });

      if (!message.trim()) return;

      const result = await this.gupshup.sendSessionMessage(apiKey, source, appName, normalizedPhone, message);
      this.logger.log(`Form greeting sent to ${normalizedPhone}: ${result.messageId}`);
    } catch (error: any) {
      this.logger.error(`Form greeting failed: ${this.getErrorMessage(error)}`);
    }
  }

  private async getSettingValue(key: string): Promise<string> {
    try {
      return await this.settingsService.getSettingForUse(key);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return '';
      }
      throw error;
    }
  }

  private getErrorMessage(error: any): string {
    if (error?.response?.data) {
      if (typeof error.response.data === 'string') {
        return error.response.data;
      }

      const apiMessage = error.response.data.message || error.response.data.status || JSON.stringify(error.response.data);
      return `${error.response.status || 'Gupshup error'} - ${apiMessage}`;
    }

    return error?.message || 'Unknown error';
  }

  private validateSubmissionData(fields: PublicFormField[], data: Record<string, any>) {
    for (const field of fields) {
      if (typeof field.name !== 'string' || !field.name.trim()) continue;

      const name = field.name;
      const label = typeof field.label === 'string' && field.label.trim() ? field.label : name;
      const type = typeof field.type === 'string' ? field.type : 'text';
      const value = data[name];
      const isEmpty =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0);

      if (field.required && isEmpty) {
        throw new BadRequestException(`${label} is required`);
      }

      if (isEmpty) continue;

      if (type === 'email' && (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
        throw new BadRequestException(`${label} must be a valid email address`);
      }

      if (type === 'phone' && (typeof value !== 'string' || !/^[\d\s\-+()]*$/.test(value))) {
        throw new BadRequestException(`${label} must be a valid phone number`);
      }

      if (type === 'number' && Number.isNaN(Number(value))) {
        throw new BadRequestException(`${label} must be a number`);
      }

      const options = Array.isArray(field.options)
        ? field.options.map((option) => String(option))
        : [];

      if ((type === 'select' || type === 'radio') && options.length > 0 && !options.includes(String(value))) {
        throw new BadRequestException(`${label} has an invalid option`);
      }

      if (type === 'checkbox' && options.length > 0) {
        if (!Array.isArray(value) || value.some((item) => !options.includes(String(item)))) {
          throw new BadRequestException(`${label} has an invalid option`);
        }
      }

      if (type === 'linear_scale' || type === 'rating') {
        const numericValue = Number(value);
        const min = Number(field.min ?? 1);
        const max = Number(field.max ?? 5);
        if (Number.isNaN(numericValue) || numericValue < min || numericValue > max) {
          throw new BadRequestException(`${label} is outside the allowed range`);
        }
      }
    }
  }
}
