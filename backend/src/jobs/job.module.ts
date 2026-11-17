import { Module, Global } from '@nestjs/common';
import { JobService } from './job.service';
import { JobExecutionService } from './job-execution.service';

@Global()
@Module({
  providers: [JobService, JobExecutionService],
  exports: [JobService, JobExecutionService],
})
export class JobModule {}
