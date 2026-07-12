import { Module } from '@nestjs/common';
import { RoundRobinService } from './services/round-robin.service';

@Module({
  providers: [RoundRobinService],
  exports: [RoundRobinService],
})
export class RoundRobinModule {}
