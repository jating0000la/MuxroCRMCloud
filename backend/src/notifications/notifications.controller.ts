import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get('pending')
  @ApiOperation({ summary: 'Get pending notifications with count' })
  async getPendingNotifications(@Request() req) {
    return this.notificationsService.getPendingWithCount(req.user.id);
  }

  @Get('pending-count')
  @ApiOperation({ summary: 'Get count of pending notifications' })
  async getPendingCount(@Request() req) {
    const count = await this.notificationsService.getPendingCount(req.user.id);
    return { count };
  }

  @Get()
  @ApiOperation({ summary: 'Get all notifications for user' })
  async getNotifications(@Request() req, @Query('limit') limit?: string) {
    const parsed = limit ? Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100) : 20;
    return this.notificationsService.getNotifications(req.user.id, parsed);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Param('id') id: string, @Request() req) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@Request() req) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Patch('sync')
  @ApiOperation({ summary: 'Sync notifications for user' })
  async syncNotifications(@Request() req) {
    await this.notificationsService.syncNotificationsForUser(req.user.id);
    return { message: 'Notifications synced' };
  }
}
