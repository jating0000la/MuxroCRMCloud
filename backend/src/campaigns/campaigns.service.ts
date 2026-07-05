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
    if (role === 'MANAGER') {
      return this.prisma.campaign.findMany({
        where: {
          OR: [
            { managerId: userId },
            { assignedUsers: { some: { userId, isActive: true } } },
          ],
          isActive: true,
        },
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

    // MANAGER: check if they own or are assigned to this campaign
    if (role === 'MANAGER' && userId) {
      const isManager = campaign.managerId === userId;
      const isAssigned = campaign.assignedUsers.some((au) => au.userId === userId && au.isActive);
      if (!isManager && !isAssigned) {
        throw new ForbiddenException('You do not have access to this campaign');
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
    const results: CampaignUser[] = [];
    for (const uid of dto.userIds) {
      const existing = await this.prisma.campaignUser.findUnique({
        where: { campaignId_userId: { campaignId, userId: uid } },
      });
      if (existing) {
        const updated = await this.prisma.campaignUser.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
        results.push(updated);
      } else {
        const created = await this.prisma.campaignUser.create({
          data: { campaignId, userId: uid },
        });
        results.push(created);
      }
    }
    return results;
  }

  async removeUser(campaignId: string, userId: string, requestUserId?: string, role?: string) {
    await this.findOne(campaignId, requestUserId, role);
    return this.prisma.campaignUser.updateMany({
      where: { campaignId, userId },
      data: { isActive: false },
    });
  }

  async getAssignedUsers(campaignId: string) {
    return this.prisma.campaignUser.findMany({
      where: { campaignId, isActive: true },
      include: { user: { select: { id: true, name: true, username: true, role: true } } },
    });
  }
}
