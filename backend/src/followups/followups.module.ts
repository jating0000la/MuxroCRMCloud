import { Module } from '@nestjs/common';
import { FollowupsService } from './followups.service';
import { FollowupsController } from './followups.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthorizationModule } from '../common/authorization/authorization.module';

@Module({
  imports: [NotificationsModule, AuthorizationModule],
  controllers: [FollowupsController],
  providers: [FollowupsService],
  exports: [FollowupsService],
})
export class FollowupsModule {}
