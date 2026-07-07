import { Module } from '@nestjs/common';
import { FollowupsService } from './followups.service';
import { FollowupsController } from './followups.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [FollowupsController],
  providers: [FollowupsService],
  exports: [FollowupsService],
})
export class FollowupsModule {}
