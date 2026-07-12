import { Module, Global } from '@nestjs/common';
import { JobService } from './job.service';

@Global()
@Module({
  providers: [JobService],
  exports: [JobService],
})
export class JobModule {}
