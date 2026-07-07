import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CampaignUser } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AssignUsersDto } from './dto/assign-users.dto';

@Injectable()
export class CampaignsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCampaignDto, userId: string) {
    const campaign = await this.prisma.campaign.create({
      data: {
        name: dto.name,
        description: dto.description,
        managerId: userId,
        statuses: {
          create: [
            { label: 'New', color: '#3B82F6', order: 0 },
            { label: 'Contacted', color: '#F59E0B', order: 1 },
            { label: 'Interested', color: '#10B981', order: 2 },
            { label: 'Converted', color: '#059669', order: 3 },
            { label: 'Lost', color: '#EF4444', order: 4 },
          ],
        },
      },
      include: { statuses: true },
    });
    return campaign;
  }

  async findAll(userId: string, role: string) {
    if (role === 'ADMIN') {
      return this.prisma.campaign.findMany({
        include: {
          manager: { select: { id: true, name: true, username: true } },
          _count: { select: { leads: true, forms: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
    // USER: only campaigns they're assigned to
    return this.prisma.campaign.findMany({
      where: {
        assignedUsers: { some: { userId, isActive: true } },
        isActive: true,
      },
      include: {
        manager: { select: { id: true, name: true, username: true } },
        _count: { select: { leads: true, forms: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId?: string, role?: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, name: true, username: true } },
        assignedUsers: {
          include: { user: { select: { id: true, name: true, username: true } } },
        },
        statuses: { orderBy: { order: 'asc' } },
        _count: { select: { leads: true, forms: true } },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    // USER: check if assigned to this campaign
    if (role === 'USER' && userId) {
      const isAssigned = await this.prisma.campaignUser.findUnique({
        where: { campaignId_userId: { campaignId: id, userId } },
      });
      if (!isAssigned || !isAssigned.isActive) {
        throw new ForbiddenException('You are not assigned to this campaign');
      }
    }

    return campaign;
  }

  async update(id: string, dto: UpdateCampaignDto, userId?: string, role?: string) {
    await this.findOne(id, userId, role);
    return this.prisma.campaign.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId?: string, role?: string) {
    await this.findOne(id, userId, role);
    return this.prisma.campaign.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async assignUsers(campaignId: string, dto: AssignUsersDto, userId?: string, role?: string) {
    await this.findOne(campaignId, userId, role);
    const uniqueUserIds = [...new Set(dto.userIds)];

    // Validate that only USER role users can be assigned to campaigns
    if (uniqueUserIds.length > 0) {
      const usersToAssign = await this.prisma.user.findMany({
        where: { id: { in: uniqueUserIds } },
        select: { id: true, role: true },
      });

      const invalidUsers = usersToAssign.filter((u) => u.role !== 'USER');
      if (invalidUsers.length > 0) {
        throw new ForbiddenException('Only USER role users can be assigned to campaigns');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const deactivateWhere: any = { campaignId, isActive: true };
      if (uniqueUserIds.length > 0) {
        deactivateWhere.userId = { notIn: uniqueUserIds };
      }

      await tx.campaignUser.updateMany({
        where: deactivateWhere,
        data: { isActive: false },
      });

      const results: CampaignUser[] = [];
      for (const uid of uniqueUserIds) {
        const existing = await tx.campaignUser.findUnique({
          where: { campaignId_userId: { campaignId, userId: uid } },
        });

        if (existing) {
          const updated = await tx.campaignUser.update({
            where: { id: existing.id },
            data: { isActive: true },
          });
          results.push(updated);
        } else {
          const created = await tx.campaignUser.create({
            data: { campaignId, userId: uid },
          });
          results.push(created);
        }
      }

      return results;
    });
  }

  async removeUser(campaignId: string, userId: string, requestUserId?: string, role?: string) {
    await this.findOne(campaignId, requestUserId, role);
    return this.prisma.campaignUser.updateMany({
      where: { campaignId, userId },
      data: { isActive: false },
    });
  }

  async getAssignedUsers(campaignId: string, userId?: string, role?: string) {
    await this.findOne(campaignId, userId, role);
    return this.prisma.campaignUser.findMany({
      where: { campaignId, isActive: true },
      include: { user: { select: { id: true, name: true, username: true, role: true } } },
    });
  }
}
