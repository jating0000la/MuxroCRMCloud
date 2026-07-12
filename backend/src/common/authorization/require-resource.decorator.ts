import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ResourceType } from './authorization.service';

export const RESOURCE_TYPE_KEY = 'resourceType';
export const RESOURCE_PARAM_KEY = 'resourceParam';

export function RequireResource(type: ResourceType, paramName: string = 'id') {
  return applyDecorators(
    SetMetadata(RESOURCE_TYPE_KEY, type),
    SetMetadata(RESOURCE_PARAM_KEY, paramName),
  );
}
