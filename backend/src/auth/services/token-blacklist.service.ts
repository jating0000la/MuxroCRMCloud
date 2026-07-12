import { Injectable } from '@nestjs/common';
import { RefreshSessionService } from './refresh-session.service';

/**
 * JWT Token blacklist service backed by database sessions.
 * Replaces the in-memory Set with persistent DB-backed revocation.
 */
@Injectable()
export class TokenBlacklistService {
  constructor(private refreshSessionService: RefreshSessionService) {}

  /**
   * Add token to blacklist (revoke session)
   */
  async revoke(token: string): Promise<void> {
    await this.refreshSessionService.revokeSession(token);
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshSessionService.revokeAllUserSessions(userId);
  }

  /**
   * Check if token is blacklisted/revoked
   */
  async isBlacklisted(token: string): Promise<boolean> {
    return this.refreshSessionService.isRevoked(token);
  }
}
