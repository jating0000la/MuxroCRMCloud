import { Module, Global } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { ResourceGuard } from './resource.guard';

@Global()
@Module({
  providers: [AuthorizationService, ResourceGuard],
  exports: [AuthorizationService, ResourceGuard],
})
export class AuthorizationModule {}
