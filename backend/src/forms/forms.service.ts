import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/pagination.dto';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { GupshupService } from '../integrations/gupshup.service';
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
    private prisma: PrismaService,
    private gupshup: GupshupService,
  ) {}

  async create(campaignId: string, dto: CreateFormDto) {
    // Check if campaign already has a form
    const existingForm = await this.prisma.form.findFirst({
      where: { campaignId },
    });
    if (existingForm) {
      throw new BadRequestException('This campaign already has a form. Each campaign can only have one form.');
    }

    return this.prisma.form.create({
      data: {
        campaignId,
        title: dto.title,
        fields: (dto.fields || []) as unknown as Prisma.InputJsonValue,
        publicSlug: uuidv4().substring(0, 8),
      },
    });
  }

  async findByCampaign(campaignId: string) {
    return this.prisma.form.findMany({
      where: { campaignId },
      include: { _count: { select: { submissions: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const form = await this.prisma.form.findUnique({
      where: { id },
      include: { campaign: true },
    });
    if (!form) throw new NotFoundException('Form not found');
    return form;
  }

  async findBySlug(slug: string) {
    const form = await this.prisma.form.findUnique({
      where: { publicSlug: slug },
      include: { campaign: { select: { name: true } } },
    });
    if (!form || !form.isPublished) throw new NotFoundException('Form not found');
    return form;
  }

  async submitForm(slug: string, data: Record<string, any>, ipAddress?: string) {
    const form = await this.findBySlug(slug);
    const fields = Array.isArray(form.fields) ? form.fields as PublicFormField[] : [];
    this.validateSubmissionData(fields, data);

    const submission = await this.prisma.enquiry.create({
      data: {
        formId: form.id,
        data,
        ipAddress,
      },
    });

    const name = data.name || data.Name || 'Unknown';
    const email = data.email || data.Email || null;
    const phone = data.phone || data.Phone || null;

    // Find next user via round-robin
    const doerId = await this.getNextRoundRobinUser(form.campaignId);

    // Get the first status (New) for the campaign
    const firstStatus = await this.prisma.campaignStatus.findFirst({
      where: { campaignId: form.campaignId },
      orderBy: { order: 'asc' },
    });

    const lead = await this.prisma.lead.create({
      data: {
        campaignId: form.campaignId,
        enquiryId: submission.id,
        name,
        email,
        phone,
        source: 'form',
        customData: data,
        doerId,
        statusId: firstStatus?.id || null,
      },
    });

    // Auto-create initial followup so it appears in followup dashboard
    const statusLabel = firstStatus?.label || 'New';
    await this.prisma.followup.create({
      data: {
        leadId: lead.id,
        userId: doerId,
        status: statusLabel,
        remarks: 'Form submitted',
      },
    });

    // Send form submission greeting via WhatsApp if configured
    this.sendFormGreeting(phone, name).catch((err) => {
      this.logger.warn(`Form greeting failed: ${err.message}`);
    });

    return { submission, lead };
  }

  private async getNextRoundRobinUser(campaignId: string): Promise<string> {
    // Get all active users assigned to this campaign
    const activeUsers = await this.prisma.campaignUser.findMany({
      where: { campaignId, isActive: true },
      include: { user: { select: { role: true } } },
      orderBy: { assignedAt: 'asc' },
    });

    // Only assign to USER role (telecallers), not ADMIN or MANAGER
    const eligibleUsers = activeUsers.filter((au) => au.user?.role === 'USER');

    if (eligibleUsers.length === 0) {
      throw new BadRequestException('No telecaller users assigned to this campaign. Please assign USER role users before creating leads.');
    }

    // Find the last lead assigned in this campaign to determine who's next
    const lastAssignedLead = await this.prisma.lead.findFirst({
      where: { campaignId, doerId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { doerId: true },
    });

    if (!lastAssignedLead?.doerId) {
      // No leads assigned yet, give to the first eligible user
      return eligibleUsers[0].userId;
    }

    // Find the index of the last assigned user
    const lastIndex = eligibleUsers.findIndex((u) => u.userId === lastAssignedLead.doerId);
    // Next user is the one after the last assigned (wraps around)
    const nextIndex = (lastIndex + 1) % eligibleUsers.length;
    return eligibleUsers[nextIndex].userId;
  }

  async update(id: string, dto: UpdateFormDto) {
    await this.findOne(id);
    const updateData: any = { ...dto };
    if (dto.fields) {
      updateData.fields = dto.fields as unknown as Prisma.InputJsonValue;
    }
    return this.prisma.form.update({ where: { id }, data: updateData });
  }

  async publish(id: string) {
    await this.findOne(id);
    return this.prisma.form.update({
      where: { id },
      data: { isPublished: true },
    });
  }

  async unpublish(id: string) {
    await this.findOne(id);
    return this.prisma.form.update({
      where: { id },
      data: { isPublished: false },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.form.delete({ where: { id } });
  }

  async getSubmissions(formId: string, pagination?: PaginationDto) {
    // ✅ FIXED: Apply pagination with skip/take
    const skip = pagination?.getSkip() || 0;
    const take = pagination?.getTake() || 50;
    
    return this.prisma.enquiry.findMany({
      where: { formId },
      orderBy: { submittedAt: 'desc' },
      skip,
      take,
    });
  }

  private async sendFormGreeting(phone: string | null, name: string): Promise<void> {
    if (!phone) return;

    try {
      const enabledSetting = await this.prisma.setting.findUnique({ where: { key: 'formGreetingEnabled' } });
      if (!enabledSetting) return;

      let enabled = false;
      if (enabledSetting.isEncrypted) {
        const decrypted = await this.prisma.setting.findUnique({ where: { key: 'formGreetingEnabled' } });
        enabled = decrypted?.encryptedValue === 'true';
      } else {
        enabled = enabledSetting.encryptedValue === 'true';
      }
      if (!enabled) return;

      const getVal = async (key: string): Promise<string> => {
        const s = await this.prisma.setting.findUnique({ where: { key } });
        if (!s) return '';
        return s.encryptedValue || '';
      };

      const apiKey = await getVal('gupshupApiKey');
      const source = await getVal('gupshupSource');
      const appName = await getVal('gupshupAppName');
      const templateId = await getVal('formGreetingTemplateId');

      if (!apiKey || !source || !appName || !templateId) {
        this.logger.warn('Form greeting skipped: missing Gupshup config');
        return;
      }

      const greetingMsg = await getVal('formGreetingMessage');
      const params = [name, greetingMsg || 'Thank you for your inquiry!'];

      await this.gupshup.sendTemplateMessage(apiKey, source, phone, templateId, params);
      this.logger.log(`Form greeting sent to ${phone}`);
    } catch (error: any) {
      this.logger.error(`Form greeting error: ${error.message}`);
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
