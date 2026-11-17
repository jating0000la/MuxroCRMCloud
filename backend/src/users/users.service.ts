import { Injectable, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { eq, and, ne, isNull, sql } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { users, campaigns, leads, refreshSessions, campaignUsers, User } from '../db/schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type Transaction = Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0];

const publicUser = {
  id: users.id, username: users.username, name: users.name, email: users.email,
  role: users.role, isActive: users.isActive, createdAt: users.createdAt,
};

@Injectable()
export class UsersService {
  constructor(private database: DatabaseService) {}

  async findAll() {
    return this.database.db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .limit(1000); // Safety cap — users list is admin-only and never huge
  }

  async findOne(id: string) {
    const [user] = await this.database.db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async lockManagement(tx: Transaction, actorId: string) {
    // Serialize account mutations so concurrent admin changes cannot remove all admins.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1465078354)`);
    const [actor] = await tx.select({ id: users.id }).from(users)
      .where(and(eq(users.id, actorId), eq(users.role, 'ADMIN'), eq(users.isActive, true)));
    if (!actor) throw new ForbiddenException('Active admin access is required');
  }

  private async getUser(tx: Transaction, id: string) {
    const [user] = await tx.select(publicUser).from(users).where(eq(users.id, id));
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async protectAdmin(tx: Transaction, user: Pick<User, 'id' | 'role' | 'isActive'>,
    actorId: string, role: string, isActive: boolean) {
    if (user.role === 'ADMIN' && user.isActive && (role !== 'ADMIN' || !isActive)) {
      const [otherAdmin] = await tx.select({ id: users.id }).from(users)
        .where(and(eq(users.role, 'ADMIN'), eq(users.isActive, true), ne(users.id, user.id))).limit(1);
      if (!otherAdmin) throw new ConflictException('At least one active admin must remain');
    }
    if (user.id === actorId && (role !== 'ADMIN' || !isActive)) {
      throw new ForbiddenException('You cannot demote, deactivate, or delete your own account');
    }
  }

  private async revokeSessions(tx: Transaction, userId: string) {
    await tx.update(refreshSessions).set({ revokedAt: new Date() })
      .where(and(eq(refreshSessions.userId, userId), isNull(refreshSessions.revokedAt)));
  }

  async create(dto: CreateUserDto, actorId: string) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    return this.database.db.transaction(async tx => {
      await this.lockManagement(tx, actorId);
      const [existing] = await tx.select({ id: users.id }).from(users)
        .where(eq(users.username, dto.username)).limit(1);
      if (existing) throw new ConflictException('Username already exists');
      const [created] = await tx.insert(users).values({ ...dto, password: hashedPassword }).returning(publicUser);
      return created;
    });
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    return this.database.db.transaction(async tx => {
      await this.lockManagement(tx, actorId);
      const user = await this.getUser(tx, id);
      await this.protectAdmin(tx, user, actorId, dto.role ?? user.role, dto.isActive ?? user.isActive);
      if (dto.username !== undefined) {
        const [existing] = await tx.select({ id: users.id }).from(users)
          .where(and(eq(users.username, dto.username), ne(users.id, id))).limit(1);
        if (existing) throw new ConflictException('Username already exists');
      }
      const [updated] = await tx.update(users).set({
        username: dto.username, name: dto.name, email: dto.email,
        role: dto.role, isActive: dto.isActive, updatedAt: new Date(),
      }).where(eq(users.id, id)).returning(publicUser);
      if (!updated.isActive) await tx.update(campaignUsers).set({ isActive: false }).where(eq(campaignUsers.userId, id));
      if (updated.role !== user.role || updated.isActive !== user.isActive || updated.username !== user.username) {
        await this.revokeSessions(tx, id);
      }
      return updated;
    });
  }

  async remove(id: string, actorId: string) {
    return this.database.db.transaction(async tx => {
      await this.lockManagement(tx, actorId);
      const user = await this.getUser(tx, id);
      await this.protectAdmin(tx, user, actorId, user.role, false);
      await tx.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, id));
      await tx.update(campaignUsers).set({ isActive: false }).where(eq(campaignUsers.userId, id));
      await this.revokeSessions(tx, id);
      return { message: 'User deactivated successfully' };
    });
  }

  async resetPassword(id: string, newPassword: string, actorId: string) {
    const password = await bcrypt.hash(newPassword, 10);
    return this.database.db.transaction(async tx => {
      await this.lockManagement(tx, actorId);
      await this.getUser(tx, id);
      await tx.update(users).set({ password, updatedAt: new Date() }).where(eq(users.id, id));
      await tx.update(campaignUsers).set({ isActive: false }).where(eq(campaignUsers.userId, id));
      await this.revokeSessions(tx, id);
      return { message: 'Password reset successfully' };
    });
  }

  async permanentDelete(id: string, actorId: string) {
    return this.database.db.transaction(async tx => {
      await this.lockManagement(tx, actorId);
      const user = await this.getUser(tx, id);
      await this.protectAdmin(tx, user, actorId, user.role, false);
      const [assignedLead] = await tx.select({ id: leads.id }).from(leads).where(eq(leads.doerId, id)).limit(1);
      const [managedCampaign] = await tx.select({ id: campaigns.id }).from(campaigns)
        .where(eq(campaigns.managerId, id)).limit(1);
      if (assignedLead || managedCampaign) {
        throw new ConflictException('Reassign this user’s leads and managed campaigns before permanent deletion, or deactivate the account');
      }
      await tx.delete(users).where(eq(users.id, id));
      return { message: 'User permanently deleted' };
    });
  }

  async findByUsername(username: string) {
    const [user] = await this.database.db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        password: users.password,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return user || null;
  }
}
