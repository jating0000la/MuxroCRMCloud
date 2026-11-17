import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationService, ResourceType } from './authorization.service';
import { RESOURCE_TYPE_KEY, RESOURCE_PARAM_KEY } from './require-resource.decorator';

@Injectable()
export class ResourceGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authService: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resourceType = this.reflector.getAllAndOverride<ResourceType>(RESOURCE_TYPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no resource type is specified, skip resource-level auth
    if (!resourceType) return true;

    const paramName = this.reflector.getAllAndOverride<string>(RESOURCE_PARAM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) || 'id';

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No user context');
    }

    const resourceId = request.params[paramName];
    if (!resourceId) {
      throw new ForbiddenException(`Missing resource parameter: ${paramName}`);
    }

    switch (resourceType) {
      case 'campaign':
        await this.authService.ensureCampaignAccess(resourceId, user.id, user.role);
        break;
      case 'lead':
        await this.authService.ensureLeadAccess(resourceId, user.id, user.role);
        break;
      case 'followup':
        await this.authService.ensureFollowupAccess(resourceId, user.id, user.role);
        break;
      case 'user':
        await this.authService.ensureUserModifyAccess(resourceId, user.id, user.role);
        break;
      default:
        throw new ForbiddenException(`Unknown resource type: ${resourceType}`);
    }

    return true;
  }
}
