import { User } from '../types';

export type Permission =
  | 'campaign:create'
  | 'campaign:edit'
  | 'campaign:delete'
  | 'campaign:assign_users'
  | 'campaign:view_all'
  | 'lead:view_all'
  | 'lead:view_assigned'
  | 'lead:create'
  | 'lead:edit'
  | 'lead:delete'
  | 'lead:update_status'
  | 'form:create'
  | 'form:edit'
  | 'form:delete'
  | 'form:publish'
  | 'bulk_import:execute'
  | 'user:view'
  | 'user:create'
  | 'user:edit'
  | 'user:delete'
  | 'enquiry:submit';

const rolePermissions: Record<string, Permission[]> = {
  ADMIN: [
    'campaign:create',
    'campaign:edit',
    'campaign:delete',
    'campaign:assign_users',
    'campaign:view_all',
    'lead:view_all',
    'lead:create',
    'lead:edit',
    'lead:delete',
    'lead:update_status',
    'form:create',
    'form:edit',
    'form:delete',
    'form:publish',
    'bulk_import:execute',
    'user:view',
    'user:create',
    'user:edit',
    'user:delete',
    'enquiry:submit',
  ],
  USER: [
    'lead:view_assigned',
    'lead:update_status',
    'enquiry:submit',
  ],
};

export function hasPermission(user: User | null, permission: Permission): boolean {
  if (!user) return false;
  return rolePermissions[user.role]?.includes(permission) || false;
}

export function hasAnyPermission(user: User | null, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(user, p));
}

export function isAdmin(user: User | null): boolean {
  return user?.role === 'ADMIN';
}

export function isUser(user: User | null): boolean {
  return user?.role === 'USER';
}

export function canManageCampaigns(user: User | null): boolean {
  return hasAnyPermission(user, ['campaign:create', 'campaign:edit']);
}

export function canManageLeads(user: User | null): boolean {
  return hasAnyPermission(user, ['lead:create', 'lead:edit', 'lead:delete']);
}

export function canManageForms(user: User | null): boolean {
  return hasAnyPermission(user, ['form:create', 'form:edit', 'form:publish']);
}

export function canManageUsers(user: User | null): boolean {
  return hasPermission(user, 'user:view');
}

export function canImportLeads(user: User | null): boolean {
  return hasPermission(user, 'bulk_import:execute');
}
