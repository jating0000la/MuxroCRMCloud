import { Injectable } from '@nestjs/common';

/**
 * JWT Token blacklist service for logout/revocation
 * In production, use Redis instead of in-memory storage
 */
@Injectable()
export class TokenBlacklistService {
  private blacklist = new Set<string>();

  /**
   * Add token to blacklist
   */
  revoke(token: string, expiresIn: number = 86400): void {
    this.blacklist.add(token);
    
    // Auto-remove from memory after expiration (TTL)
    setTimeout(() => {
      this.blacklist.delete(token);
    }, expiresIn * 1000);
  }

  /**
   * Check if token is blacklisted
   */
  isBlacklisted(token: string): boolean {
    return this.blacklist.has(token);
  }

  /**
   * Clear entire blacklist (for testing/maintenance)
   */
  clear(): void {
    this.blacklist.clear();
  }

  /**
   * Get blacklist size
   */
  size(): number {
    return this.blacklist.size;
  }
}
