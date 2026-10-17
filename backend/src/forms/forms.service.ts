import { GupshupTemplatesService } from '../integrations/templates/gupshup-templates.service';
import { OutboxService } from '../common/outbox/outbox.service';
import { JOB_TYPES } from '../jobs/job.types';
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { sql, eq, and, desc, asc, inArray } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { forms, enquiries, leads, campaignStatuses, followups, campaigns, outboxEvents } from '../db/schema';
import { PaginationDto, createPaginatedResponse } from '../common/pagination.dto';
import { RoundRobinService } from '../common/services/round-robin.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
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
    private templates: GupshupTemplatesService,
    private outbox: OutboxService,
    private roundRobinService: RoundRobinService,
  ) {}

  async create(campaignId: string, dto: CreateFormDto) {
    await this.validateCommunication(dto.fields || []);
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
      .select({ form: forms, submissions: sql<number>`(SELECT count(*)::int FROM "Enquiry" e WHERE e."formId" = "Form"."id")` })
      .from(forms)
      .where(eq(forms.campaignId, campaignId))
      .orderBy(desc(forms.createdAt))
      .then(rows => rows.map(row => ({ ...row.form, _count: { submissions: row.submissions } })));
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
      .where(and(eq(forms.publicSlug, slug), eq(campaigns.isActive, true)))
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
      const [available] = await tx.select({ fields: forms.fields }).from(forms)
        .innerJoin(campaigns, eq(forms.campaignId, campaigns.id))
        .where(and(eq(forms.id, form.id), eq(forms.isPublished, true), eq(campaigns.isActive, true)))
        .for('share');
      if (!available) throw new NotFoundException('Form not found');
      this.validateSubmissionData((available.fields || []) as PublicFormField[], data);
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
      const actualFields = available.fields || [];
      const communication = (actualFields.find((f: any) => f.type === '__design_meta' || f.name === '__form_meta') as any)?.meta?.communication || {};
      const phone = data[communication.recipientField || 'phone'] || data.phone || data.Phone || null;

      const doerId = await this.roundRobinService.getNextRoundRobinUser(form.campaignId, tx);

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
          updatedAt: sql`clock_timestamp()`,
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

      if (communication.whatsappEnabled === true && communication.templateId && phone) {
        const request = this.templates.resolve(communication, { ...data, name, email, phone });
        await tx.insert(outboxEvents).values({ aggregateType: 'lead', aggregateId: lead.id, eventType: JOB_TYPES.WHATSAPP_FORM_GREETING,
          payload: { ...request, phone: String(phone), leadId: lead.id, campaignId: form.campaignId, automationKey: `form-submission:${submission.id}` } });
      }
      return { submission, lead, phone, name, data, doerId };
    });

    // The worker retries delivery; a queue outage never loses a committed form greeting.
    void this.outbox.publishFormGreetings().catch(() => this.logger.warn('Greeting remains in the outbox for worker recovery'));

    return { submission: result.submission, lead: result.lead };
  }

  async update(id: string, dto: UpdateFormDto) {
    await this.findOne(id);
    const updateData: any = { ...dto };
    if (dto.fields) {
      await this.validateCommunication(dto.fields);
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
    const form = await this.findOne(id);
    await this.validateCommunication(form.fields || []);
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

    const [rows, [{ total }]] = await Promise.all([
      this.database.db.select().from(enquiries).where(eq(enquiries.formId, formId))
        .orderBy(desc(enquiries.submittedAt), desc(enquiries.id)).offset(skip).limit(take),
      this.database.db.select({ total: sql<number>`count(*)::int` }).from(enquiries).where(eq(enquiries.formId, formId)),
    ]);
    return createPaginatedResponse(rows, total, pagination?.page || 1, take);
  }

  private async validateCommunication(fields: any[]) {
    const meta = fields.find(f => f.type === '__design_meta' || f.name === '__form_meta');
    const config = meta?.meta?.communication;
    if (config?.whatsappEnabled === true) {
      await this.templates.validateConfig(config, fields.filter(f => f !== meta).map(f => f.name));
    }
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

      if (type === 'file') {
        const match = typeof value?.dataUrl === 'string' && value.dataUrl.match(/^data:[^,]*;base64,([A-Za-z0-9+/]*={0,2})$/);
        if (!match || !Number.isInteger(value.size) || value.size < 0 || value.size > 4 * 1024 * 1024 ||
            Buffer.from(match[1], 'base64').length !== value.size) {
          throw new BadRequestException(`${label} must be a valid attachment up to 4 MB`);
        }
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
