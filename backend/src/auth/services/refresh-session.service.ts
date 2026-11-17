import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { eq, and, lt, gt, isNull, sql } from 'drizzle-orm';
import * as crypto from 'crypto';
import { DatabaseService } from '../../db/database.service';
import { refreshSessions } from '../../db/schema';

@Injectable()
export class RefreshSessionService {
  private logger = new Logger('RefreshSessionService');

  constructor(private database: DatabaseService) {}

  /**
   * Hash a token for storage (we never store raw JWTs).
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Create a new refresh session when user logs in.
   */
  async createSession(userId: string, token: string, expiresAt: Date, id: string = crypto.randomUUID(),
    db: Pick<DatabaseService['db'], 'insert'> = this.database.db): Promise<void> {
    const tokenHash = this.hashToken(token);
    await db.insert(refreshSessions).values({
      id,
      userId,
      tokenHash,
      expiresAt,
    });
    this.logger.debug(`Session created for user ${userId}`);
  }

  /** Consume a refresh token once and replace it within the caller's transaction. */
  async rotateSession(token: string, userId: string, replacement: { sessionId: string; refresh_token: string; expiresAt: Date },
    tx: Pick<DatabaseService['db'], 'update' | 'insert'>): Promise<void> {
    const [session] = await tx.update(refreshSessions).set({ revokedAt: new Date() })
      .where(and(eq(refreshSessions.tokenHash, this.hashToken(token)), eq(refreshSessions.userId, userId),
        isNull(refreshSessions.revokedAt), gt(refreshSessions.expiresAt, new Date())))
      .returning({ id: refreshSessions.id });
    if (!session) throw new UnauthorizedException('Refresh token is invalid. Please log in again.');
    await this.createSession(userId, replacement.refresh_token, replacement.expiresAt, replacement.sessionId, tx);
  }

  async revokeSessionById(id: string, userId: string): Promise<void> {
    await this.database.db.update(refreshSessions).set({ revokedAt: new Date() })
      .where(and(eq(refreshSessions.id, id), eq(refreshSessions.userId, userId), isNull(refreshSessions.revokedAt)));
  }

  /**
   * Revoke a specific session (logout).
   */
  async revokeSession(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    await this.database.db
      .update(refreshSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshSessions.tokenHash, tokenHash), isNull(refreshSessions.revokedAt)));
    this.logger.debug(`Session revoked`);
  }

  /**
   * Revoke all sessions for a user (e.g., on password change).
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.database.db
      .update(refreshSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshSessions.userId, userId), isNull(refreshSessions.revokedAt)));
    this.logger.debug(`All sessions revoked for user ${userId}`);
  }

  /**
   * Check if a token has been revoked.
   */
  async isRevoked(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    const [session] = await this.database.db
      .select()
      .from(refreshSessions)
      .where(eq(refreshSessions.tokenHash, tokenHash))
      .limit(1);

    // Not found = revoked (or never existed)
    if (!session) return true;
    // Explicitly revoked
    if (session.revokedAt) return true;
    // Expired
    if (session.expiresAt < new Date()) return true;

    return false;
  }

  /**
   * Get all active sessions for a user.
   */
  async getActiveSessions(userId: string) {
    return this.database.db
      .select({
        id: refreshSessions.id,
        createdAt: refreshSessions.createdAt,
        expiresAt: refreshSessions.expiresAt,
      })
      .from(refreshSessions)
      .where(
        and(
          eq(refreshSessions.userId, userId),
          isNull(refreshSessions.revokedAt),
          sql`${refreshSessions.expiresAt} > NOW()`,
        ),
      )
      .orderBy(refreshSessions.createdAt);
  }

  /**
   * Cleanup expired sessions (call periodically).
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.database.db
      .delete(refreshSessions)
      .where(lt(refreshSessions.expiresAt, new Date()));
    const deleted = (result as any).rowCount || 0;
    if (deleted > 0) {
      this.logger.debug(`Cleaned up ${deleted} expired sessions`);
    }
    return deleted;
  }

  /**
   * Get session stats for admin dashboard.
   */
  async getStats() {
    const [{ total }] = await this.database.db
      .select({ total: sql<number>`count(*)::int` })
      .from(refreshSessions)
      .where(isNull(refreshSessions.revokedAt));

    const [{ activeUsers }] = await this.database.db
      .select({ activeUsers: sql<number>`count(distinct ${refreshSessions.userId})::int` })
      .from(refreshSessions)
      .where(
        and(
          isNull(refreshSessions.revokedAt),
          sql`${refreshSessions.expiresAt} > NOW()`,
        ),
      );

    return { total, activeUsers };
  }
}
