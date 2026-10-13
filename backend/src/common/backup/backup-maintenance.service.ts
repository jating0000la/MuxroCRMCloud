import { ConflictException, Injectable } from '@nestjs/common';

@Injectable()
export class BackupMaintenanceService {
  restoring = false;
  activeRequests = 0;

  async drainRequests() {
    const deadline = Date.now() + 5000;
    // The HTTP restore request itself counts as one; CLI restore counts as zero.
    while (this.activeRequests > 1 && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (this.activeRequests > 1) throw new ConflictException('Other requests are still running. Try restore again after they finish.');
  }
}
