import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CampaignStatusesService {
  constructor(private prisma: PrismaService) {}

  async findAll(campaignId: string) {
    return this.prisma.campaignStatus.findMany({
      where: { campaignId },
      orderBy: { order: 'asc' },
    });
  }

  async create(campaignId: string, data: { label: string; color?: string }) {
    const maxOrder = await this.prisma.campaignStatus.findFirst({
      where: { campaignId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    return this.prisma.campaignStatus.create({
      data: {
        campaignId,
        label: data.label,
        color: data.color || '#3B82F6',
        order: (maxOrder?.order ?? -1) + 1,
      },
    });
  }

  async update(id: string, data: { label?: string; color?: string; order?: number }) {
    await this.findOne(id);
    return this.prisma.campaignStatus.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    const status = await this.findOne(id);

    // Check if any leads are using this status
    const leadsUsingStatus = await this.prisma.lead.count({
      where: { statusId: id },
    });

    if (leadsUsingStatus > 0) {
      throw new ForbiddenException(
        `Cannot delete status "${status.label}" - ${leadsUsingStatus} lead(s) are using it. Reassign them first.`
      );
    }

    return this.prisma.campaignStatus.delete({ where: { id } });
  }

  private async findOne(id: string) {
    const status = await this.prisma.campaignStatus.findUnique({ where: { id } });
    if (!status) throw new NotFoundException('Status not found');
    return status;
  }
}
