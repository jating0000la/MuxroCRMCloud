import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { eq, and, ne } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { users } from '../db/schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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
      .from(users);
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

  async create(dto: CreateUserDto) {
    const [existing] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.username, dto.username))
      .limit(1);
    if (existing) throw new ConflictException('Username already exists');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const [created] = await this.database.db
      .insert(users)
      .values({ ...dto, password: hashedPassword })
      .returning({
        id: users.id,
        username: users.username,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });
    return created;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    if (dto.username) {
      const [existing] = await this.database.db
        .select()
        .from(users)
        .where(eq(users.username, dto.username))
        .limit(1);
      if (existing && existing.id !== id) throw new ConflictException('Username already exists');
    }
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }
    const [updated] = await this.database.db
      .update(users)
      .set(dto)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        username: users.username,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
      });
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.database.db
      .update(users)
      .set({ isActive: false })
      .where(eq(users.id, id));
    return { message: 'User deactivated successfully' };
  }

  async resetPassword(id: string, newPassword: string) {
    await this.findOne(id);
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.database.db
      .update(users)
      .set({ password: hashed })
      .where(eq(users.id, id));
    return { message: 'Password reset successfully' };
  }

  async permanentDelete(id: string) {
    await this.findOne(id);
    await this.database.db.delete(users).where(eq(users.id, id));
    return { message: 'User permanently deleted' };
  }

  async findByUsername(username: string) {
    const [user] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return user || null;
  }
}
