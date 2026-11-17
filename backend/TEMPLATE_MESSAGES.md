# Gupshup template communication

Deploy backend/frontend together and apply `npm run db:migrate` in `backend` (including `0006_famous_cardiac.sql`). Back up the database before applying deployment migrations. The API starts the form/status template sender automatically; a separate worker is optional for these messages and remains required for other background jobs. API and worker instances share the queue safely.

1. Save API key, source, App Name and **App ID** in Settings → Communication Setup.
2. Click **Sync Gupshup templates**. The catalog preserves approval, language, body, media URL/ID and button metadata from `containerMeta` and components. Only approved, supported templates can be selected for sending.
3. In a form builder → **Messages**, enable the approved template greeting, choose a template, map `{{1}}`, `{{2}}`, etc. to form fields or fixed values, and choose the recipient phone field. For image/video/document headers, supply a public media URL; the synced default is prefilled when available.
4. In Campaign → Settings → **Lead Statuses**, select a template and map values separately for each status. A selected template takes precedence over legacy text. In a lead's status dialog, leave WhatsApp communication enabled to queue that status's template; disable it for a status-only update.

Form submission alone does not open a WhatsApp customer-service session. Form greetings now use `/wa/api/v1/template/msg` with `{id, params}` and a text or media `message` envelope, matching the supplied Apps Script. The approved template's static URL/phone/quick-reply buttons are sent by Gupshup through the template ID. The system does not rebuild buttons as plain text. Existing free-form form greetings require selecting an approved template; no free-form fallback is sent automatically.

Named variables, dynamic text-header variables, dynamic URL-button variables, location/carousel/product templates need additional provider-specific payload mappings. They remain visible in the synced catalog with an explanation and cannot be selected accidentally. Image/video/document templates require a public URL; a media ID or a form attachment data URL is not substituted for that URL.

The lead/follow-up and greeting request commit in one database transaction. The API attempts to queue it immediately, consumes the template queue, and recovers unpublished requests every three seconds, including after restarts. Queue outages retain requests for later recovery. Provider delivery jobs retry with pg-boss; attempts and errors appear in Settings → Communication Setup → **Automatic WhatsApp delivery** and admin job logs (`GET /api/v1/admin/failed-jobs`). Messages accepted by Gupshup are recorded in WhatsApp history with the rendered body, header and button metadata. Acceptance is not final delivery; delivery webhooks still determine delivered/read/failed status.

Sales users can send the administrator-configured status template for their assigned leads. They cannot change that template or send to another user’s lead. The separate `/whatsapp/send/*` API also permits direct session/template sends to owned leads; low-level integration sends and broadcasts remain administrator-only. The lead status dialog shows the sending switch for these templates and skips communication for missing phone numbers or DND leads.

On a PM2 VPS, pull the latest `main`, rebuild backend/frontend, apply pending migrations, and restart `muxro-crm-backend` and `muxro-crm-frontend` from the existing ecosystem configuration. Restart `muxro-crm-worker` too if installed. In Communication Setup, confirm **Automatic sender: Running**, submit a test form or update an assigned lead's status, then refresh delivery status to see provider acceptance or its error. No new database migration is required for the automatic-sender repair beyond `0006`.

A stable automation key prevents repeated successful job executions from sending again. As with any provider without a documented idempotency key, a crash after provider acceptance but before the database records the result can cause a retry to send twice. Deleted/DND leads, changed recipient numbers and leads moved to another campaign are checked before sending. Bulk deletion cancels queued communication and restored outbox records are not replayed.

Template sync uses the configured App ID; a failed sync preserves the previous catalog. If an approved template is removed or rejected on the next sync, pending sends fail rather than becoming session text. Source/API settings are resolved on the worker and credentials are not embedded in public form responses or queued payloads.

Validation uses an isolated PostgreSQL database and mocked Gupshup responses. No real customer messages are sent by tests.
