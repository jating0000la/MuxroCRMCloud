import { GupshupTemplatesModule } from '../integrations/templates/gupshup-templates.module';
import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { RoundRobinModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [RoundRobinModule, NotificationsModule, GupshupTemplatesModule],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
