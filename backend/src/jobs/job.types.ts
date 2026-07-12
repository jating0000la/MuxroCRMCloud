export const JOB_TYPES = {
  // Bulk operations
  BULK_IMPORT_CSV: 'bulk-import-csv',
  BULK_IMPORT_JSON: 'bulk-import-json',
  BULK_ALLOCATE: 'bulk-allocate',

  // WhatsApp / Gupshup
  WHATSAPP_SEND_MESSAGE: 'whatsapp-send-message',
  WHATSAPP_SEND_TEMPLATE: 'whatsapp-send-template',
  WHATSAPP_FORM_GREETING: 'whatsapp-form-greeting',

  // Integrations
  INDIAMART_FETCH: 'indiamart-fetch',
  INDIAMART_AUTO_IMPORT: 'indiamart-auto-import',

  // Notifications
  NOTIFICATION_SYNC: 'notification-sync',
  NOTIFICATION_CLEANUP: 'notification-cleanup',

  // Scheduled
  SCHEDULED_FOLLOWUP_CHECK: 'scheduled-followup-check',
  OUTBOX_PUBLISH: 'outbox-publish',
  BACKUP_DATABASE: 'backup-database',
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

export interface BulkImportJobPayload {
  campaignId: string;
  fileBufferBase64?: string;
  jsonData?: any[];
  fileFormat: 'csv' | 'json';
  allocateRoundRobin: boolean;
  userId: string;
}

export interface BulkAllocateJobPayload {
  campaignId: string;
  leadIds: string[];
  userId: string;
}

export interface WhatsAppMessageJobPayload {
  phone: string;
  message: string;
  source?: string;
  appName?: string;
}

export interface WhatsAppTemplateJobPayload {
  phone: string;
  templateName: string;
  params?: string[];
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document';
}

export interface WhatsAppGreetingJobPayload {
  phone: string;
  name: string;
  formComm: Record<string, any>;
  formData: Record<string, any>;
}

export interface IndiaMartFetchJobPayload {
  campaignId: string;
  startTime?: string;
  endTime?: string;
  userId?: string;
}

export interface NotificationSyncJobPayload {
  userId: string;
}

export interface OutboxPublishJobPayload {
  eventIds: string[];
}

export interface BackupJobPayload {
  retentionDays?: number;
}
