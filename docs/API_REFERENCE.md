# MuxroCRM Cloud — API reference

**Baseline:** `c5de389` · **Reviewed:** 17 October 2026.

This inventory expands 135 controller-handler declarations into **138 HTTP method/path combinations**. Normal routes use `/api/v1`. Authorization labels describe controller guards plus known service-level restrictions; they do not imply that every authenticated caller can access every referenced resource. See [technical documentation](TECHNICAL_DOCUMENTATION.md#4-api-conventions-and-authorization).

JWT access can be supplied by the HttpOnly cookie or a bearer header. Refresh requires its refresh cookie. Callback tokens are separate integration secrets. Administrator-only low-level integration sends are different from the owned-lead `/whatsapp/send/*` interface.

The canonical logo route is `/api/v1/logo/:filename`. The source also registers a redundant `/api/v1/api/v1/logo/:filename` alias because its explicit path is combined with the global prefix/version; it is included rather than presented as an unprefixed `/logo` endpoint. Swagger itself is optional at `/api/docs` and is not a controller route in this count.

## admin

| Method | Path | Authorization | Source handler |
| --- | --- | --- | --- |
| GET | `/api/v1/admin/health` | ADMIN | [AdminDashboardController.getSystemHealth](../backend/src/admin-dashboard.controller.ts#L35) |
| GET | `/api/v1/admin/jobs` | ADMIN | [AdminDashboardController.getJobLogs](../backend/src/admin-dashboard.controller.ts#L169) |
| GET | `/api/v1/admin/failed-jobs` | ADMIN | [AdminDashboardController.getFailedJobs](../backend/src/admin-dashboard.controller.ts#L184) |
| GET | `/api/v1/admin/backups` | ADMIN | [AdminDashboardController.getBackups](../backend/src/admin-dashboard.controller.ts#L195) |
| POST | `/api/v1/admin/backups/trigger` | ADMIN | [AdminDashboardController.triggerBackup](../backend/src/admin-dashboard.controller.ts#L201) |
| GET | `/api/v1/admin/backups/status` | ADMIN | [AdminDashboardController.getBackupStatus](../backend/src/admin-dashboard.controller.ts#L207) |
| GET | `/api/v1/admin/backups/:filename/download` | ADMIN | [AdminDashboardController.downloadBackup](../backend/src/admin-dashboard.controller.ts#L213) |
| DELETE | `/api/v1/admin/backups/:filename` | ADMIN | [AdminDashboardController.deleteBackup](../backend/src/admin-dashboard.controller.ts#L224) |
| POST | `/api/v1/admin/backups/:filename/restore` | ADMIN | [AdminDashboardController.restoreBackup](../backend/src/admin-dashboard.controller.ts#L231) |
| GET | `/api/v1/admin/data-export/download` | ADMIN | [DataExportController.downloadAllData](../backend/src/data-export/data-export.controller.ts#L26) |
| DELETE | `/api/v1/admin/data-export/all` | ADMIN | [DataExportController.deleteAllData](../backend/src/data-export/data-export.controller.ts#L57) |

## auth

| Method | Path | Authorization | Source handler |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/login` | Public login; throttled | [AuthController.login](../backend/src/auth/auth.controller.ts#L53) |
| POST | `/api/v1/auth/refresh` | Valid refresh cookie | [AuthController.refresh](../backend/src/auth/auth.controller.ts#L71) |
| POST | `/api/v1/auth/register` | ADMIN | [AuthController.register](../backend/src/auth/auth.controller.ts#L92) |
| GET | `/api/v1/auth/profile` | Authenticated; service scope | [AuthController.getProfile](../backend/src/auth/auth.controller.ts#L102) |
| POST | `/api/v1/auth/logout` | Authenticated; service scope | [AuthController.logout](../backend/src/auth/auth.controller.ts#L110) |
| POST | `/api/v1/auth/change-password` | Authenticated; service scope | [AuthController.changePassword](../backend/src/auth/auth.controller.ts#L133) |

## campaigns

| Method | Path | Authorization | Source handler |
| --- | --- | --- | --- |
| POST | `/api/v1/campaigns/:campaignId/bulk-import/csv` | ADMIN | [BulkImportController.importCSV](../backend/src/bulk-import/bulk-import.controller.ts#L21) |
| POST | `/api/v1/campaigns/:campaignId/bulk-import/json` | ADMIN | [BulkImportController.importJSON](../backend/src/bulk-import/bulk-import.controller.ts#L47) |
| GET | `/api/v1/campaigns/:campaignId/statuses` | Authenticated; service scope | [CampaignStatusesController.findAll](../backend/src/campaigns/campaign-statuses.controller.ts#L22) |
| POST | `/api/v1/campaigns/:campaignId/statuses` | ADMIN | [CampaignStatusesController.create](../backend/src/campaigns/campaign-statuses.controller.ts#L29) |
| PUT | `/api/v1/campaigns/:campaignId/statuses/:id` | ADMIN | [CampaignStatusesController.update](../backend/src/campaigns/campaign-statuses.controller.ts#L39) |
| DELETE | `/api/v1/campaigns/:campaignId/statuses/:id` | ADMIN | [CampaignStatusesController.remove](../backend/src/campaigns/campaign-statuses.controller.ts#L50) |
| POST | `/api/v1/campaigns` | ADMIN | [CampaignsController.create](../backend/src/campaigns/campaigns.controller.ts#L20) |
| GET | `/api/v1/campaigns` | Authenticated; service scope | [CampaignsController.findAll](../backend/src/campaigns/campaigns.controller.ts#L27) |
| GET | `/api/v1/campaigns/:id` | Authenticated; service scope | [CampaignsController.findOne](../backend/src/campaigns/campaigns.controller.ts#L33) |
| PUT | `/api/v1/campaigns/:id` | ADMIN | [CampaignsController.update](../backend/src/campaigns/campaigns.controller.ts#L39) |
| DELETE | `/api/v1/campaigns/:id` | ADMIN | [CampaignsController.remove](../backend/src/campaigns/campaigns.controller.ts#L46) |
| POST | `/api/v1/campaigns/:id/users` | ADMIN | [CampaignsController.assignUsers](../backend/src/campaigns/campaigns.controller.ts#L53) |
| DELETE | `/api/v1/campaigns/:id/users/:userId` | ADMIN | [CampaignsController.removeUser](../backend/src/campaigns/campaigns.controller.ts#L60) |
| GET | `/api/v1/campaigns/:id/users` | Authenticated; service scope | [CampaignsController.getAssignedUsers](../backend/src/campaigns/campaigns.controller.ts#L67) |
| POST | `/api/v1/campaigns/:campaignId/forms` | ADMIN | [FormsController.create](../backend/src/forms/forms.controller.ts#L24) |
| GET | `/api/v1/campaigns/:campaignId/forms` | Authenticated; service scope | [FormsController.findAll](../backend/src/forms/forms.controller.ts#L31) |
| GET | `/api/v1/campaigns/:campaignId/forms/:id` | Authenticated; service scope | [FormsController.findOne](../backend/src/forms/forms.controller.ts#L38) |
| PUT | `/api/v1/campaigns/:campaignId/forms/:id` | ADMIN | [FormsController.update](../backend/src/forms/forms.controller.ts#L47) |
| POST | `/api/v1/campaigns/:campaignId/forms/:id/publish` | ADMIN | [FormsController.publish](../backend/src/forms/forms.controller.ts#L57) |
| POST | `/api/v1/campaigns/:campaignId/forms/:id/unpublish` | ADMIN | [FormsController.unpublish](../backend/src/forms/forms.controller.ts#L67) |
| DELETE | `/api/v1/campaigns/:campaignId/forms/:id` | ADMIN | [FormsController.remove](../backend/src/forms/forms.controller.ts#L77) |
| GET | `/api/v1/campaigns/:campaignId/forms/:id/submissions` | ADMIN | [FormsController.getSubmissions](../backend/src/forms/forms.controller.ts#L87) |

## dashboard

| Method | Path | Authorization | Source handler |
| --- | --- | --- | --- |
| GET | `/api/v1/dashboard/overview` | Authenticated; service scope | [DashboardController.getOverview](../backend/src/dashboard/dashboard.controller.ts#L19) |
| GET | `/api/v1/dashboard/campaign-stats/:campaignId` | Authenticated; service scope | [DashboardController.getCampaignStats](../backend/src/dashboard/dashboard.controller.ts#L25) |
| GET | `/api/v1/dashboard/followups` | Authenticated; service scope | [DashboardController.getFollowupDashboard](../backend/src/dashboard/dashboard.controller.ts#L32) |
| GET | `/api/v1/dashboard/leads` | Authenticated; service scope | [DashboardController.getAllLeadsDashboard](../backend/src/dashboard/dashboard.controller.ts#L51) |
| GET | `/api/v1/dashboard/sales-funnel` | Authenticated; service scope | [DashboardController.getSalesFunnel](../backend/src/dashboard/dashboard.controller.ts#L70) |
| GET | `/api/v1/dashboard/user-conversion` | Authenticated; service scope | [DashboardController.getUserConversion](../backend/src/dashboard/dashboard.controller.ts#L80) |
| GET | `/api/v1/dashboard/kpi` | Authenticated; service scope | [DashboardController.getKpi](../backend/src/dashboard/dashboard.controller.ts#L97) |
| GET | `/api/v1/dashboard/alerts` | Authenticated; service scope | [DashboardController.getAlerts](../backend/src/dashboard/dashboard.controller.ts#L114) |
| GET | `/api/v1/dashboard/campaign-report` | Authenticated; service scope | [DashboardController.getCampaignReport](../backend/src/dashboard/dashboard.controller.ts#L120) |
| GET | `/api/v1/dashboard/status-report` | Authenticated; service scope | [DashboardController.getStatusReport](../backend/src/dashboard/dashboard.controller.ts#L132) |
| GET | `/api/v1/dashboard/daily-trend` | Authenticated; service scope | [DashboardController.getDailyTrend](../backend/src/dashboard/dashboard.controller.ts#L142) |
| GET | `/api/v1/dashboard/missed-by-user` | Authenticated; service scope | [DashboardController.getMissedByUser](../backend/src/dashboard/dashboard.controller.ts#L159) |

## followups

| Method | Path | Authorization | Source handler |
| --- | --- | --- | --- |
| GET | `/api/v1/followups/lead/:leadId` | Authenticated; service scope | [FollowupsController.findByLead](../backend/src/followups/followups.controller.ts#L17) |
| GET | `/api/v1/followups/cross-campaign` | Authenticated; service scope | [FollowupsController.findCrossCampaign](../backend/src/followups/followups.controller.ts#L23) |
| POST | `/api/v1/followups` | Authenticated; service scope | [FollowupsController.create](../backend/src/followups/followups.controller.ts#L37) |
| GET | `/api/v1/followups/my` | Authenticated; service scope | [FollowupsController.getMyFollowups](../backend/src/followups/followups.controller.ts#L43) |
| GET | `/api/v1/followups/upcoming` | Authenticated; service scope | [FollowupsController.getUpcomingFollowups](../backend/src/followups/followups.controller.ts#L51) |
| PUT | `/api/v1/followups/:id` | Authenticated; service scope | [FollowupsController.update](../backend/src/followups/followups.controller.ts#L57) |
| DELETE | `/api/v1/followups/:id` | Authenticated; service scope | [FollowupsController.remove](../backend/src/followups/followups.controller.ts#L63) |

## forms

| Method | Path | Authorization | Source handler |
| --- | --- | --- | --- |
| GET | `/api/v1/forms/public/:slug` | Public | [PublicFormsController.getForm](../backend/src/forms/public-forms.controller.ts#L22) |
| POST | `/api/v1/forms/public/:slug/submit` | Public | [PublicFormsController.submitForm](../backend/src/forms/public-forms.controller.ts#L31) |

## health

| Method | Path | Authorization | Source handler |
| --- | --- | --- | --- |
| GET | `/api/v1/health` | Public | [HealthController.check](../backend/src/health.controller.ts#L14) |
| GET | `/api/v1/health/detailed` | ADMIN | [HealthController.detailedCheck](../backend/src/health.controller.ts#L31) |

## integrations

| Method | Path | Authorization | Source handler |
| --- | --- | --- | --- |
| GET | `/api/v1/integrations/cloudconnect/config` | ADMIN | [CloudConnectController.getConfig](../backend/src/integrations/cloudconnect/cloudconnect.controller.ts#L14) |
| PUT | `/api/v1/integrations/cloudconnect/config` | ADMIN | [CloudConnectController.save](../backend/src/integrations/cloudconnect/cloudconnect.controller.ts#L15) |
| POST | `/api/v1/integrations/cloudconnect/webhook-token` | ADMIN | [CloudConnectController.token](../backend/src/integrations/cloudconnect/cloudconnect.controller.ts#L16) |
| GET | `/api/v1/integrations/cloudconnect/calls` | Authenticated; service scope | [CloudConnectController.calls](../backend/src/integrations/cloudconnect/cloudconnect.controller.ts#L17) |
| GET | `/api/v1/integrations/cloudconnect/events` | ADMIN | [CloudConnectController.events](../backend/src/integrations/cloudconnect/cloudconnect.controller.ts#L18) |
| POST | `/api/v1/integrations/cloudconnect/events/:id/retry` | ADMIN | [CloudConnectController.retry](../backend/src/integrations/cloudconnect/cloudconnect.controller.ts#L19) |
| GET | `/api/v1/integrations/cloudconnect/webhook` | CloudConnect token; enabled/mapped intake | [CloudConnectWebhookController.get](../backend/src/integrations/cloudconnect/cloudconnect.controller.ts#L27) |
| POST | `/api/v1/integrations/cloudconnect/webhook` | CloudConnect token; enabled/mapped intake | [CloudConnectWebhookController.post](../backend/src/integrations/cloudconnect/cloudconnect.controller.ts#L29) |
| POST | `/api/v1/integrations/gupshup/send-message` | ADMIN | [GupshupController.sendMessage](../backend/src/integrations/gupshup.controller.ts#L25) |
| POST | `/api/v1/integrations/gupshup/send-media` | ADMIN | [GupshupController.sendMedia](../backend/src/integrations/gupshup.controller.ts#L48) |
| POST | `/api/v1/integrations/gupshup/send-template` | ADMIN | [GupshupController.sendTemplate](../backend/src/integrations/gupshup.controller.ts#L71) |
| POST | `/api/v1/integrations/gupshup/test-connection` | ADMIN | [GupshupController.testConnection](../backend/src/integrations/gupshup.controller.ts#L94) |
| POST | `/api/v1/integrations/gupshup/sync-templates` | ADMIN | [GupshupController.syncTemplates](../backend/src/integrations/gupshup.controller.ts#L108) |
| POST | `/api/v1/integrations/process-sutra/start-flow` | ADMIN | [IntegrationsController.startProcessSutraFlow](../backend/src/integrations/integrations.controller.ts#L22) |
| POST | `/api/v1/integrations/indiamart/fetch-leads` | ADMIN | [IntegrationsController.fetchIndiamartLeads](../backend/src/integrations/integrations.controller.ts#L43) |
| POST | `/api/v1/integrations/indiamart/auto-import` | ADMIN | [IntegrationsController.autoImportIndiamartLeads](../backend/src/integrations/integrations.controller.ts#L54) |
| POST | `/api/v1/integrations/indiamart/test-connection` | ADMIN | [IntegrationsController.testIndiamartConnection](../backend/src/integrations/integrations.controller.ts#L75) |
| GET | `/api/v1/integrations/indiamart/last-fetch` | ADMIN | [IntegrationsController.getLastFetchTime](../backend/src/integrations/integrations.controller.ts#L97) |
| POST | `/api/v1/integrations/process-sutra/test-connection` | ADMIN | [IntegrationsController.testProcessSutraConnection](../backend/src/integrations/integrations.controller.ts#L105) |
| GET | `/api/v1/integrations/gupshup/templates` | ADMIN / USER | [GupshupTemplatesController.list](../backend/src/integrations/templates/gupshup-templates.controller.ts#L12) |
| GET | `/api/v1/integrations/gupshup/templates/delivery` | ADMIN | [GupshupTemplatesController.deliveryStatus](../backend/src/integrations/templates/gupshup-templates.controller.ts#L13) |
| POST | `/api/v1/integrations/gupshup/webhook` | Webhook token | [WhatsAppWebhookController.handleWebhook](../backend/src/whatsapp/whatsapp-webhook.controller.ts#L17) |
| POST | `/api/v1/integrations/gupshup/webhook/status` | Webhook token | [WhatsAppWebhookController.handleStatusWebhook](../backend/src/whatsapp/whatsapp-webhook.controller.ts#L31) |

## leads

| Method | Path | Authorization | Source handler |
| --- | --- | --- | --- |
| GET | `/api/v1/leads/campaign/:campaignId` | Authenticated; service scope | [LeadsController.findByCampaign](../backend/src/leads/leads.controller.ts#L22) |
| GET | `/api/v1/leads/dnd` | Authenticated; service scope | [LeadsController.findDnd](../backend/src/leads/leads.controller.ts#L37) |
| GET | `/api/v1/leads/stats/:campaignId` | ADMIN | [LeadsController.getStats](../backend/src/leads/leads.controller.ts#L46) |
| GET | `/api/v1/leads/:id` | Authenticated; service scope | [LeadsController.findOne](../backend/src/leads/leads.controller.ts#L53) |
| POST | `/api/v1/leads` | ADMIN | [LeadsController.create](../backend/src/leads/leads.controller.ts#L59) |
| PUT | `/api/v1/leads/:id` | Authenticated; service scope | [LeadsController.update](../backend/src/leads/leads.controller.ts#L66) |
| PUT | `/api/v1/leads/:id/status` | Authenticated; service scope | [LeadsController.updateStatus](../backend/src/leads/leads.controller.ts#L72) |
| POST | `/api/v1/leads/bulk-allocate/:campaignId` | ADMIN | [LeadsController.allocateRoundRobin](../backend/src/leads/leads.controller.ts#L78) |
| DELETE | `/api/v1/leads/:id` | ADMIN | [LeadsController.remove](../backend/src/leads/leads.controller.ts#L89) |

## logo

| Method | Path | Authorization | Source handler |
| --- | --- | --- | --- |
| GET | `/api/v1/logo/:filename` | Public | [LogoController.getLogo](../backend/src/logo.controller.ts#L12) |
| GET | `/api/v1/api/v1/logo/:filename` | Public | [LogoController.getLogo](../backend/src/logo.controller.ts#L12) |

## notifications

| Method | Path | Authorization | Source handler |
| --- | --- | --- | --- |
| GET | `/api/v1/notifications/pending` | Authenticated; service scope | [NotificationsController.getPendingNotifications](../backend/src/notifications/notifications.controller.ts#L21) |
| GET | `/api/v1/notifications/pending-count` | Authenticated; service scope | [NotificationsController.getPendingCount](../backend/src/notifications/notifications.controller.ts#L27) |
| GET | `/api/v1/notifications` | Authenticated; service scope | [NotificationsController.getNotifications](../backend/src/notifications/notifications.controller.ts#L34) |
| PATCH | `/api/v1/notifications/:id/read` | Authenticated; service scope | [NotificationsController.markAsRead](../backend/src/notifications/notifications.controller.ts#L41) |
| PATCH | `/api/v1/notifications/read-all` | Authenticated; service scope | [NotificationsController.markAllAsRead](../backend/src/notifications/notifications.controller.ts#L47) |
| PATCH | `/api/v1/notifications/sync` | Authenticated; service scope | [NotificationsController.syncNotifications](../backend/src/notifications/notifications.controller.ts#L53) |

## branding

| Method | Path | Authorization | Source handler |
| --- | --- | --- | --- |
| GET | `/api/v1/branding` | Authenticated; service scope | [BrandingController.getBranding](../backend/src/settings/branding.controller.ts#L10) |

## settings

| Method | Path | Authorization | Source handler |
| --- | --- | --- | --- |
| GET | `/api/v1/settings` | ADMIN | [SettingsController.getAllSettings](../backend/src/settings/settings.controller.ts#L40) |
| GET | `/api/v1/settings/:key` | ADMIN | [SettingsController.getSetting](../backend/src/settings/settings.controller.ts#L49) |
| POST | `/api/v1/settings` | ADMIN | [SettingsController.createSetting](../backend/src/settings/settings.controller.ts#L59) |
| PUT | `/api/v1/settings/:key` | ADMIN | [SettingsController.updateSetting](../backend/src/settings/settings.controller.ts#L68) |
| DELETE | `/api/v1/settings/:key` | ADMIN | [SettingsController.deleteSetting](../backend/src/settings/settings.controller.ts#L77) |
| GET | `/api/v1/settings/:key/audit-log` | ADMIN | [SettingsController.getAuditLog](../backend/src/settings/settings.controller.ts#L84) |
| POST | `/api/v1/settings/logo/upload` | ADMIN | [SettingsController.uploadLogo](../backend/src/settings/settings.controller.ts#L90) |
| POST | `/api/v1/settings/:key/test` | ADMIN | [SettingsController.testSetting](../backend/src/settings/settings.controller.ts#L116) |

## users

| Method | Path | Authorization | Source handler |
| --- | --- | --- | --- |
| GET | `/api/v1/users` | ADMIN | [UsersController.findAll](../backend/src/users/users.controller.ts#L26) |
| GET | `/api/v1/users/:id` | ADMIN | [UsersController.findOne](../backend/src/users/users.controller.ts#L33) |
| POST | `/api/v1/users` | ADMIN | [UsersController.create](../backend/src/users/users.controller.ts#L40) |
| PUT | `/api/v1/users/:id` | ADMIN | [UsersController.update](../backend/src/users/users.controller.ts#L47) |
| DELETE | `/api/v1/users/:id` | ADMIN | [UsersController.remove](../backend/src/users/users.controller.ts#L54) |
| PATCH | `/api/v1/users/:id/reset-password` | ADMIN | [UsersController.resetPassword](../backend/src/users/users.controller.ts#L61) |
| DELETE | `/api/v1/users/:id/permanent` | ADMIN | [UsersController.permanentDelete](../backend/src/users/users.controller.ts#L69) |

## whatsapp

| Method | Path | Authorization | Source handler |
| --- | --- | --- | --- |
| GET | `/api/v1/whatsapp/webhook-config` | ADMIN | [WebhookConfigController.get](../backend/src/whatsapp/webhook-config.controller.ts#L17) |
| POST | `/api/v1/whatsapp/webhook-config/token` | ADMIN | [WebhookConfigController.rotate](../backend/src/whatsapp/webhook-config.controller.ts#L22) |
| POST | `/api/v1/whatsapp/webhook` | Webhook token | [WhatsAppWebhookController.handleWebhook](../backend/src/whatsapp/whatsapp-webhook.controller.ts#L17) |
| POST | `/api/v1/whatsapp/webhook/status` | Webhook token | [WhatsAppWebhookController.handleStatusWebhook](../backend/src/whatsapp/whatsapp-webhook.controller.ts#L31) |
| GET | `/api/v1/whatsapp/chats` | Authenticated; service scope | [WhatsAppController.getChats](../backend/src/whatsapp/whatsapp.controller.ts#L34) |
| GET | `/api/v1/whatsapp/chats/:phone/messages` | Authenticated; service scope | [WhatsAppController.getChatMessages](../backend/src/whatsapp/whatsapp.controller.ts#L45) |
| GET | `/api/v1/whatsapp/stats` | Authenticated; service scope | [WhatsAppController.getStats](../backend/src/whatsapp/whatsapp.controller.ts#L57) |
| POST | `/api/v1/whatsapp/send/text` | ADMIN / USER; owned-lead scope for USER | [WhatsAppController.sendText](../backend/src/whatsapp/whatsapp.controller.ts#L65) |
| POST | `/api/v1/whatsapp/send/image` | ADMIN / USER; owned-lead scope for USER | [WhatsAppController.sendImage](../backend/src/whatsapp/whatsapp.controller.ts#L77) |
| POST | `/api/v1/whatsapp/send/video` | ADMIN / USER; owned-lead scope for USER | [WhatsAppController.sendVideo](../backend/src/whatsapp/whatsapp.controller.ts#L89) |
| POST | `/api/v1/whatsapp/send/audio` | ADMIN / USER; owned-lead scope for USER | [WhatsAppController.sendAudio](../backend/src/whatsapp/whatsapp.controller.ts#L101) |
| POST | `/api/v1/whatsapp/send/file` | ADMIN / USER; owned-lead scope for USER | [WhatsAppController.sendFile](../backend/src/whatsapp/whatsapp.controller.ts#L113) |
| POST | `/api/v1/whatsapp/send/location` | ADMIN / USER; owned-lead scope for USER | [WhatsAppController.sendLocation](../backend/src/whatsapp/whatsapp.controller.ts#L125) |
| POST | `/api/v1/whatsapp/send/contact` | ADMIN / USER; owned-lead scope for USER | [WhatsAppController.sendContact](../backend/src/whatsapp/whatsapp.controller.ts#L137) |
| POST | `/api/v1/whatsapp/send/quick-reply` | ADMIN / USER; owned-lead scope for USER | [WhatsAppController.sendQuickReply](../backend/src/whatsapp/whatsapp.controller.ts#L149) |
| POST | `/api/v1/whatsapp/send/list` | ADMIN / USER; owned-lead scope for USER | [WhatsAppController.sendList](../backend/src/whatsapp/whatsapp.controller.ts#L161) |
| POST | `/api/v1/whatsapp/send/template` | ADMIN / USER; owned-lead scope for USER | [WhatsAppController.sendTemplate](../backend/src/whatsapp/whatsapp.controller.ts#L173) |
| POST | `/api/v1/whatsapp/send/broadcast` | ADMIN | [WhatsAppController.sendBroadcast](../backend/src/whatsapp/whatsapp.controller.ts#L185) |
| GET | `/api/v1/whatsapp/contacts` | Authenticated; service scope | [WhatsAppController.getContacts](../backend/src/whatsapp/whatsapp.controller.ts#L195) |
| POST | `/api/v1/whatsapp/sync-templates` | ADMIN | [WhatsAppController.syncTemplates](../backend/src/whatsapp/whatsapp.controller.ts#L208) |

## Contract notes

- `:id`, `:campaignId`, `:leadId` and `:filename` are route placeholders, not literal values. See each linked DTO/controller/service for accepted body and query fields.
- General list pagination, dashboard pagination, follow-up cursors and WhatsApp offsets do not share one response envelope. Read the technical document before writing a generic list client.
- Sales lead access is primarily assigned ownership. CloudConnect global call listing is admin-only; a sales user can request call history for a specific owned lead.
- Role checks are not the entire policy. For example, a status must belong to its campaign, a form ID must match its parent campaign, a template must be approved/supported, and sender/lead state can prevent a send.
- The dashboard campaign-report endpoint is not admin-only: authenticated users can call it, and its missing scope filter is a reproduced audit defect (F01).
- The Process Sutra connection test starts an actual provider flow when configured against a real provider. Gupshup connection testing sends a real session message. Neither should be treated as a harmless ping.
- Backup restore and data deletion are destructive operations with additional validation/maintenance requirements. Their presence in this inventory is not an instruction to invoke them.
