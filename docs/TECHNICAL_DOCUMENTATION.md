# MuxroCRM Cloud — technical documentation

**Version baseline:** `c5de389` · **Reviewed:** 17 October 2026. This document describes current implementation; open defects are tracked in the [system audit](SYSTEM_AUDIT.md). See [architecture](ARCHITECTURE.md) for diagrams and [API reference](API_REFERENCE.md) for individual routes.

## 1. Product scope and operating model

MuxroCRM Cloud manages campaigns, customer enquiries, lead ownership, sales follow-ups, DND status, dashboards and communication history. Leads can arrive through a public form, manual entry, CSV/JSON import, IndiaMART, incoming CloudConnect calls, or configured WhatsApp sender auto-creation.

There are two CRM roles: `ADMIN` and `USER`. An administrator configures campaigns, forms, sales assignments, integrations and global communication settings. A sales user works primarily with assigned leads through Follow-ups, Dashboard, DND and WhatsApp. CloudConnect operators are an independent provider-agent directory in integration settings; they are not a third CRM role or a field on the CRM user record.

This is a single application/database installation with global settings. It does not implement separate customer organizations or general SaaS tenant isolation. CloudConnect's provider `tenantId` identifies its incoming call namespace, not a CRM organization boundary.

Voice intake is inbound-only. The code does not implement a CloudConnect outbound dialer. CRM communication includes WhatsApp APIs and external telephone/email/WhatsApp links; clicking such a link is different from a server-recorded provider send.

## 2. Technology and repository layout

Versions below are resolved versions from the audited lockfiles, rather than only package-manifest ranges.

| Layer | Technology/version | Implementation |
| --- | --- | --- |
| Browser UI | React 18.3.1, React Router 6.30.4 | [App.tsx](../frontend/src/App.tsx), route-level lazy loading |
| Frontend build | Vite 8.1.4, TypeScript 5.9.3, Tailwind 3.4.19 | [frontend package](../frontend/package.json), [Vite configuration](../frontend/vite.config.ts) |
| HTTP client | Axios 1.18.1 in both projects | Cookie-based browser requests; NestJS Axios integration for providers |
| API | NestJS 11.1.28, Express platform | [AppModule](../backend/src/app.module.ts), [bootstrap](../backend/src/main.ts) |
| Persistence | Drizzle ORM 0.45.2, `pg` 8.22.0, PostgreSQL | [schema](../backend/src/db/schema.ts), [database service](../backend/src/db/database.service.ts) |
| Jobs | pg-boss 12.26.0 | Queues in the same PostgreSQL database; separate pg-boss connection pool |
| Authentication | JWT, Passport, bcryptjs | Persisted, hashed refresh sessions and current-account checks |
| Secrets | AES-256-GCM; scrypt key derivation | [encryption service](../backend/src/settings/encryption.service.ts) |
| Operations | PM2, external reverse proxy, PostgreSQL utilities | [ecosystem](../backend/ecosystem.config.cjs), [Compose](../docker-compose.yml) |

The dependency versions above have outstanding registry advisories. See audit F05; this table is an inventory, not an endorsement of their security status.

```text
backend/
  src/
    auth/ users/ campaigns/ forms/ leads/ followups/ dashboard/
    bulk-import/ notifications/ settings/ whatsapp/ integrations/
    integrations/cloudconnect/ integrations/templates/
    db/ jobs/ common/ data-export/
    main.ts                 HTTP API entry point
    worker.ts               standalone background worker entry point
  drizzle/                  0000–0006 SQL migrations and journal/snapshots
  test/                     five Node test-runner regression suites
  ecosystem.config.cjs      PM2 API, worker and frontend processes
frontend/
  src/pages/                12 routed pages
  src/components/           shared layouts, editors, chat and lead components
  src/context/              authentication, theme and notifications
  src/services/             API clients and pagination helpers
  src/pages/forms/public-form/  public renderer, fields, hooks and page sections
scripts/                    database backup/restore CLI wrappers
docs/                       technical, architecture and audit documentation
```

There is no Redis cache, WebSocket service, object-storage service or organization-management module in the implemented runtime.

## 3. Page and feature inventory

Browser validation used administrator and sales accounts at desktop and mobile widths. A rendered page or correct redirect is a smoke check; it does not establish that every action on that page is correct. The [audit matrix](SYSTEM_AUDIT.md#page-by-page-assessment) records open issues.

| Route | Access | Current features and primary API area |
| --- | --- | --- |
| `/login` | Public | Username/password login, remember-user choice, restore notice; `/auth/*` |
| `/form/:slug` | Public, published/active forms only | Dynamic enquiry form, optional landing-page sections, file values, validation and thank-you/redirect; `/forms/public/*` |
| `/dashboard` | ADMIN/USER | KPI cards, funnel, campaign/status reports, user conversion, daily trends and missed follow-ups; `/dashboard/*` |
| `/campaigns` | ADMIN UI | Campaign list, search/filter, creation wizard, editing and deactivation; `/campaigns` |
| `/campaigns/:id` | ADMIN UI | Leads, Forms, Team Members and Settings tabs; manual/imported leads, sales allocation, statuses and per-status templates |
| `/followups` | ADMIN/USER | Assigned/all-lead worklist, filters, local pagination, lead details, next-call status update, external contact links and legacy Process Sutra action |
| `/dnd` | ADMIN/USER | DND list within the caller's permitted lead scope |
| `/admin/users` | ADMIN | Create/edit accounts, role/activity management, password reset and controlled deletion |
| `/admin/backups` | ADMIN | Capabilities, custom-format backup creation/download/deletion and controlled database restore |
| `/admin/data-management` | ADMIN | Six-CSV ZIP export and explicit-confirmation campaign-data deletion |
| `/settings` | ADMIN | Profile/branding, API & Webhook, Communication Setup and IVR Incoming tabs |
| `/whatsapp` | ADMIN/USER | Scoped conversation list, messages, attachment rendering, compose actions, message state and CRM information panel |

The frontend redirects non-admin users away from the six administrator pages. Backend authorization is independent: some campaign/form read APIs permit assigned users even though the administration pages are not available to them.

### Campaign and form administration

Campaign creation adds default statuses: New, Contacted, Interested, Converted and Lost. Status labels, colors, order, legacy session text and approved-template configuration are campaign-specific. An active campaign must have active assigned `USER` accounts for round-robin intake. `managerId` is administrative responsibility; `Lead.doerId` is sales ownership.

Campaign deletion is deactivation (`isActive=false`). Lead deletion uses `isDeleted`/`deletedAt`. Bulk data deletion is a separate destructive administrative operation.

Form builder tabs are **Fields**, **Design**, **Messages** and **Page**. Fields and a reserved metadata object are stored together in `Form.fields` JSON. Metadata carries design, page configuration and communication configuration. Public rendering supports text-like inputs, textarea, email/phone/number, select, radio, checkbox, date/time, ratings/scales, grids and file values.

A file value contains `{name,size,type,dataUrl}`. There is no separate public attachment-upload endpoint. A single attachment is limited to 4 MiB; the complete JSON submission is limited to 8 MiB. Base64 values become part of enquiry data and lead custom data. They are not automatically public URLs suitable for a Gupshup media header.

Publishing validates enabled template configuration. Public reads/submissions also require an active campaign and a published form. Deleting a form detaches related `Lead.enquiryId` references before deleting its enquiries, preserving leads and their copied custom data.

### Sales work and reporting

A lead status transition uses `PUT /leads/:id/status`. It writes a follow-up and the lead status/DND change in one transaction and can persist a template-send request in that same transaction. A direct `POST /followups` appends history; it is a different API and should not be assumed to perform every lead-transition side effect.

Lead details combine current attributes, form/custom data, follow-ups, WhatsApp history, cross-campaign history and IVR calls. Sales access follows assigned ownership, with additional service-specific scope checks. A concurrent ownership-transfer defect remains open in audit F02.

Dashboard conversion classifications currently depend on text matches in status labels. The campaign report also has reproduced scope/date/lost-count defects. Do not use it as an authoritative reconciled sales ledger until F01/F07 are addressed.

## 4. API conventions and authorization

The normal API base is `/api/v1`. The development Vite server proxies `/api` to `http://localhost:3000`; production needs a reverse proxy that preserves the API path. Swagger is exposed at `/api/docs` only when `SWAGGER_ENABLED=true`.

Requests normally use JSON. CSV/logo uploads use multipart form data. Nest's global validation enables transformation, whitelisting and rejection of unexpected DTO properties. Dynamic form answers receive additional field-aware validation in `FormsService`. Some generic DTOs remain less strict than the specialized chat/IVR DTOs; F10 documents fractional pagination failure.

| Authorization layer | Behavior |
| --- | --- |
| Browser route guard | Hides/redirects pages according to the cached, server-validated profile |
| JWT guard/strategy | Reads bearer token or `auth_token` cookie; validates signature, expiry, access-token purpose, active account and live persisted session |
| Role guard | Uses current database role, with method-level role metadata overriding class metadata |
| Service checks | Enforce lead ownership, campaign membership, matching parent resource and integration-specific access |
| Provider callback authentication | Shared secret/header or query token; no interactive CRM login required |

Administrators can read global operational data and configure integrations. Sales users can read/message owned leads through scoped `/whatsapp/send/*` routes and send an administrator-configured status template. Low-level `/integrations/gupshup/*` sends, broadcasts, provider configuration and template synchronization are administrator-only. The template sender checks deleted/DND/changed-recipient/moved-campaign state before sending; direct session-message DND enforcement is inconsistent (F03).

### Authentication lifecycle

Login sets HttpOnly `auth_token` and `refresh_token` cookies. Cookies use `SameSite=Lax`, `Path=/` and `Secure` in production. Access lifetime defaults to 15 minutes and refresh lifetime to seven days. Access tokens include a session ID, token purpose and unique token ID. The refresh token is stored only as a SHA-256 hash in `RefreshSession`.

Refresh consumes the prior persisted token once and creates a replacement inside a transaction. Logout revokes the current session. Password, role and activity changes revoke relevant sessions. Last-administrator and acting-administrator protections are implemented by the user service and regression-tested.

The frontend stores a profile in session/local storage, not JWT credentials. Axios sends cookies and serializes refresh attempts after 401 responses; 429 responses are retried with bounded backoff. Browser profile storage is a convenience, not the backend permission authority.

### Response and pagination contracts

The codebase has multiple response shapes; consumers must use the contract for the particular endpoint.

| Family | Response/limit behavior |
| --- | --- |
| Lead campaign and DND lists | Plain arrays, `page`/`limit`; frontend `fetchAllPages` requests 500-row pages, up to 20 pages |
| Form submissions, IVR lists | `{data, pagination:{page,limit,total,totalPages,...}}` |
| Dashboard worklists | Raw SQL-backed page response, unwrapped by frontend; browser currently requests up to 20,000 leads and filters locally |
| Follow-up personal list | Cursor/keyset contract; see `FollowupsService.getMyFollowups` |
| WhatsApp chats/messages | Plain arrays with `limit`/`offset`; API maximum 500, current UI requests 200 chats and 100 messages |

A probe retrieved all 506 campaign leads over two pages. This disproved an initial hypothesis that the current plain-array campaign endpoint stops at 500. The helper's nested-metadata handling is not the contract used by that endpoint.

Typical errors are 400 for invalid input, 401 for missing/invalid authentication, 403 for denied scope, 404 for missing resources, 409 for conflicting maintenance operations, 429 for rate limits and 503 for disabled/unavailable features. Some invalid inputs still produce 500, as documented in F10.

## 5. Data dictionary and invariants

The [Drizzle schema](../backend/src/db/schema.ts) defines 20 application tables. pg-boss maintains additional queue tables in its own schema; Drizzle maintains migration history separately.

| Table | Purpose and important keys/relationships |
| --- | --- |
| `User` | Unique username, hashed password, ADMIN/USER role, activity and timestamps |
| `Campaign` | Name, description, activity, optional manager user |
| `CampaignUser` | Campaign/user membership; unique pair; independent active flag |
| `RoundRobinCursor` | One cursor per campaign; last selected sales user |
| `CampaignStatus` | Campaign-specific label/color/order and nullable WhatsApp template JSON |
| `Form` | Campaign, unique public slug, publication flag and JSON fields/metadata |
| `Enquiry` | Submitted form data, timestamp and submitting IP; references a form |
| `Lead` | Campaign, optional unique enquiry reference and IndiaMART query ID, contact details, custom JSON, owner, status, DND and soft-delete fields |
| `Followup` | Lead/user history, status text, remarks and optional next-call timestamp |
| `Notification` | User/follow-up pair is unique; read state and due/missed type |
| `Setting` | Unique key and encrypted text value; includes integration configurations |
| `SettingAuditLog` | Masked setting changes, actor identifier, reason and timestamp |
| `RefreshSession` | Unique token hash, user, expiry and revocation timestamp |
| `OutboxEvent` | Transactional intent, aggregate reference, payload, publication and retry state |
| `JobLog` | Execution attempt, payload/result/error and timestamps; job ID is not populated by the shared execution wrapper |
| `WhatsappMessage` | Phone, direction/type, rendered body, optional media/provider ID/lead/campaign/user, raw metadata; unique nullable automation key |
| `WhatsappContact` | Unique normalized phone, optional linked lead, name, opt-in flag and last-seen time |
| `IvrCall` | Unique provider-tenant/external-call pair; linked lead/campaign, lifecycle and receiving operator metadata |
| `IvrWebhookEvent` | Unique event hash, normalized payload, retry state and processing timestamps |
| `GupshupTemplate` | Unique app/template pair, normalized/full provider metadata and sync timestamp |

UUIDs are used for application primary keys. Most timestamps are PostgreSQL `timestamptz`. Date inputs, local-day boundaries and status-label-derived analytics need deliberate business-timezone treatment; there is no installation-wide business timezone setting.

The database enforces individual foreign keys but not every cross-table business invariant. In particular, `Lead.statusId` and `Lead.campaignId` are separate foreign keys; the database does not ensure that the referenced status belongs to the lead's campaign. F02 demonstrates the consequence under a transfer race.

Ownership allocation uses a campaign-scoped PostgreSQL advisory transaction lock and a persisted cursor. Active, assigned `USER` accounts are eligible; administrators and inactive users are excluded. Form intake, manual round-robin creation, bulk allocation and IVR intake use this service. The current IndiaMART importer does not (F04).

## 6. Integration contracts

### Gupshup / WhatsApp

| Operation | Provider endpoint/implementation |
| --- | --- |
| Session messages | `POST https://api.gupshup.io/wa/api/v1/msg` |
| Approved templates | `POST https://api.gupshup.io/wa/api/v1/template/msg` |
| Template sync | `GET https://api.gupshup.io/wa/app/{appId}/template` |
| Incoming/status callbacks | Both `/api/v1/whatsapp/webhook[/status]` and `/api/v1/integrations/gupshup/webhook[/status]` |

Credentials are the encrypted settings `gupshupApiKey`, `gupshupSource`, `gupshupAppName` and `gupshupAppId`. The API key is a provider header; outbound payloads are form-encoded. Template payloads contain `template={id,params}` plus a text/image/video/document envelope. Static approved buttons are supplied through the template ID, not reconstructed as plain text.

Synchronization preserves full provider metadata, `containerMeta`, approval, language, body, header media and buttons in the catalog. Only approved/supported templates can be configured through the shared editor. Positional variables are ordered strings. Named variables, dynamic text headers, dynamic URL buttons and specialized carousel/product/location formats require additional mappings and are excluded by the supported-format checks.

Form messages and configured status messages use durable outbox events. The API registers the automatic template consumer at bootstrap and republishes pending intents every three seconds. A separate worker can consume the same queue. It is not required for these two message flows.

Incoming callbacks require the stored `gupshupWebhookToken`, falling back to `GUPSHUP_WEBHOOK_TOKEN`. Send the token using `X-Webhook-Token` or the provider's callback query parameter. Application logs redact webhook queries; reverse-proxy logs need their own equivalent configuration. Parsed inbound messages are normalized, linked where possible, deduplicated and shown through polling. Unknown senders can create a lead if an auto-create campaign is configured and assignable.

Media rendering uses HTML images for image/sticker/template-image headers and direct links for other HTTP(S) attachments. URL validity checks do not prove that Gupshup can reach or download a supplied asset. Accepted, delivered, read and failed are distinct states.

### CloudConnect incoming IVR

The integration accepts GET, JSON POST and URL-encoded POST callbacks at `/api/v1/integrations/cloudconnect/webhook`. Authentication uses `X-CloudConnect-Token` or `?token=...`. Configuration and token rotation are administrator-only.

The configuration identifies one provider tenant, allowed incoming campaign IDs, a target active CRM campaign and an operator Agent ID/name directory. Incoming calls become durable normalized inbox records before processing. Outbound/unmapped calls do not create CRM enquiries. A new caller is assigned to an active sales user; repeat callers in that CRM campaign reuse a non-deleted lead without replacing its sales owner, DND or sales status. Operator/agent details remain on the call record.

Ringing/answered/ended state is monotonic; hangup-only missed calls retain a callback-needed flag. Event hashes and call-identity uniqueness prevent ordinary duplicate intake. The standalone worker retries pending inbox events every five seconds with capped backoff, up to five processing attempts. Administrators can inspect and retry failed events in Settings. Unlike template messaging, restart recovery of IVR events still needs that worker or a subsequent explicit drain/retry.

See [CloudConnect integration guide](../CLOUDCONNECT_INTEGRATION.md).

### IndiaMART

The provider Pull API is `https://mapi.indiamart.com/wservce/crm/crmListing/v2/`. Import deduplication uses unique `indiamartQueryId`. Credentials and campaign selection are saved in Settings; manual fetch/import APIs are administrator-only.

Current limitations are material: imported leads have no `doerId`, lead/follow-up writes are not one transaction, failed rows can leave persisted leads, and the saved Auto-fetch switch has no registered schedule. The code updates a last-fetch setting, but that is not proof of complete or scheduled import. See F04/F09 before relying on unattended intake.

### Process Sutra

The API forwards to `https://processsutra.com/api/integrations/start-flow` with provider key, system name, order number, description and initial form data. The connection-test API actually starts a synthetic provider flow; it is not a read-only connectivity check.

Global settings store the provider key/system name, but the Follow-ups action still reads legacy `localStorage.processSutraSettings`. A fresh browser does not expose the action solely because current Settings were saved (F08). No durable linked workflow-status synchronization is implemented.

## 7. Background jobs and notifications

The code declares 13 queue names and the standalone worker registers 10 handlers. These counts are intentionally different.

| Worker handler | Purpose |
| --- | --- |
| `whatsapp-send-message` | Explicit queued session send |
| `whatsapp-send-template` | Explicit queued provider-template send |
| `whatsapp-form-greeting` | Shared automated form/status template delivery; also consumed by API |
| `indiamart-fetch`, `indiamart-auto-import` | Provider fetch/import when jobs are explicitly enqueued |
| `bulk-allocate` | Round-robin reassignment |
| `notification-sync`, `notification-cleanup` | Notification maintenance jobs |
| `outbox-publish` | Publish eligible outbox records |
| `backup-database` | Backup execution when explicitly queued |

`bulk-import-csv`, `bulk-import-json` and `scheduled-followup-check` are declared queue names without registered handlers. Current bulk-import HTTP endpoints operate synchronously. Declaring a queue or saving an Auto-fetch flag does not install a recurring schedule. Backup scheduling is also external.

Notifications are derived from current eligible follow-ups and ownership. The browser polls/synchronizes roughly every 30 seconds; Follow-ups refreshes its list every 10 seconds while visible and not editing. WhatsApp refreshes conversations every 15 seconds and an active chat every 10 seconds. The delivery-status panel refreshes every 10 seconds while visible. There is no real-time socket transport.

pg-boss jobs support up to three retries by default. Successful automation keys are deduplicated in message history; see architecture's delivery-guarantee discussion. Failure attempts are visible in Communication Setup and administrator job APIs. There is no complete UI/API retry path joining every failed template attempt to its pg-boss job ID (F12).

## 8. Configuration and local development

### Supported prerequisites

Use Node.js **22.12 or newer** for this dependency set; pg-boss 12.26.0 requires it. The audit executed on Node 24.19.0. The checked-in Compose service specifies PostgreSQL 15; validation here used PostgreSQL 17.11. Compatibility on the exact VPS PostgreSQL 15 image was not tested in this audit.

Install `pg_dump`, `pg_restore` and `psql` matching the server major version for backup/restore. PostgreSQL must permit the application to create/use its public tables and pg-boss schema. The regression-test database role additionally needs permission to create/drop isolated databases.

### Environment variables actually used

| Name | Purpose/default |
| --- | --- |
| `DATABASE_URL` | Required PostgreSQL URI; for the provided Compose mapping on the host, use port **5433** |
| `JWT_SECRET` | Required high-entropy JWT signing secret |
| `APP_ENCRYPTION_KEY`, `ENCRYPTION_SALT` | Required setting-encryption inputs; retain unchanged across restarts and preserve separately for disaster recovery |
| `NODE_ENV` | `production` enables secure cookies and production seed safeguards |
| `PORT` | HTTP port, default `3000` |
| `CORS_ORIGIN` | Comma-separated browser origins; default `http://localhost:5173` |
| `DB_POOL_MAX` | Application `pg` pool maximum, default `5` per process; pg-boss has a separate pool |
| `ACCESS_TOKEN_EXPIRATION` | JWT/access-cookie lifetime, default `15m` |
| `REFRESH_TOKEN_EXPIRATION` | Refresh lifetime, default `7d` |
| `PUBLIC_FORMS_ENABLED` | String `true` enables public reads/submissions; default `true` |
| `SWAGGER_ENABLED` | String `true` enables Swagger; default disabled |
| `BACKUP_DIR`, `BACKUP_RETENTION_DAYS` | Writable private archive directory; default `/backups`, retention seven days |
| `GUPSHUP_WEBHOOK_TOKEN` | Optional fallback when no stored webhook token exists |
| `SEED_ADMIN_PASSWORD`, `SEED_USER_PASSWORD` | Required together for production seeding; email equivalents are optional |
| `CRM_PROCESS_ROLE` | Set internally by API/worker entry points; not a user feature toggle |

The application hardcodes a 30-second SQL statement timeout, five-second DB connection timeout, 30-second idle timeout and global throttle of 100 requests/minute with a five-second block. Login is 5/minute, public submission 10/minute, and CloudConnect callback routes 600/minute. The sample's `DATABASE_POOL_*`, `DATABASE_*_TIMEOUT` and `THROTTLE_*` names do not configure those implementations. Its encryption-key omissions and database port also need correction (F14). Redis-related comments in the sample do not represent an implemented cache.

Create `backend/.env` or inject variables through the process environment. Replace all placeholders with real installation values and exclude the file from Git; do not copy the current sample literally without correcting the issues above. Generate independent secret values, for example:

```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 32   # APP_ENCRYPTION_KEY
openssl rand -hex 16      # ENCRYPTION_SALT
```

Install/build using the two existing lockfiles:

```bash
npm ci --include=dev --prefix backend
npm ci --include=dev --prefix frontend
npm run build --prefix backend
npm run build --prefix frontend
```

Apply migrations from `backend` with the intended development database selected, then run API/UI in separate terminals:

```bash
cd backend
npm run db:migrate
npm run start:dev
```

```bash
cd frontend
npm run dev
```

Run `npm run start:worker:dev` from `backend` when validating IVR restart recovery or other standalone-worker jobs. Production entries are `npm run start:prod` and `npm run start:worker` after a build.

The optional seed script creates `admin` and `user1` only if absent. Set both seed-password variables and `NODE_ENV=production` for deployment seeding; development defaults must not become production account credentials. Routine user creation should use the administrator UI/API.

## 9. VPS deployment and migration procedure

The primary repository configuration is PostgreSQL in Docker Compose plus API, worker and static frontend under PM2. [The ecosystem file](../backend/ecosystem.config.cjs) assumes `/root/MuxroCRMCloud`, port 3000 for the API, port 8080 for the static frontend and `/var/log/pm2` for logs. Adjust paths/ownership for the actual installation. Caddy is mentioned in Compose comments, but its configuration is not included in this repository.

A reverse proxy must terminate HTTPS, preserve `/api/v1/...` paths, proxy API requests to port 3000 and serve/proxy the SPA with history fallback. Restrict direct backend/database exposure and set the proxy trust/origin policy for the actual network. Production cookies require HTTPS.

Recommended release order:

1. Record the deployed commit and take a validated database backup. Confirm separately retained encryption inputs and uploaded logos.
2. Fetch `main`, review the exact release and install from both lockfiles. Build both projects before restarting processes.
3. Run `npm run db:migrate` from `backend` against the deployment database. The current sequence is `0000` through `0006_famous_cardiac.sql`. `db:push --force` is not the controlled production migration procedure.
4. Restart API and frontend, and the standalone worker if installed. Use the ecosystem file to start a missing process; restarting an existing API does not create a worker process automatically.
5. Validate login, a scoped read, a public form, a status-template attempt and the delivery panel. Verify IVR worker recovery separately. Check provider acceptance and subsequent delivered/read callbacks separately.
6. If rollback is necessary, distinguish an application-code rollback from a database restore. Do not assume an older backend supports a newly migrated schema or newer queued payloads.

The current Dockerfiles are not an equivalent verified alternative. The backend uses an unsupported Node 20 image, copies a non-existent `backend/scripts` build-context path and omits the SQL migration directory from its runtime stage. See F06 before container-based deployment.

## 10. Backups, export and recovery

Database backups use PostgreSQL custom-format `.dump` archives, restrictive local filesystem permissions, archive checks and operation locks. The API supports create/list/download/delete/restore; root [backup](../scripts/backup.sh) and [restore](../scripts/restore.sh) scripts call the same built CLI. Automatic backup scheduling requires an external timer/cron/process-management arrangement; none is supplied as an active schedule.

A backup includes the `public` application schema and Drizzle migration history. It is not a complete filesystem or host backup. Uploaded logos, environment secrets, TLS/proxy/PM2 configuration and offsite archive replication require separate arrangements. Form file values stored in database JSON are included in the database backup.

Restore validates the archive, creates a recovery backup, checks that other database clients/workers are stopped, applies SQL transactionally, validates required tables/columns and requires an active administrator in the restored data. It revokes sessions and clears pending jobs/outbox replay state so restored communications are not automatically resent. The UI clears authentication cookies and requires sign-in with credentials from the selected backup.

For CLI restore, stop API and workers first, invoke `scripts/restore.sh <archive-name>`, explicitly type `RESTORE`, then restart and validate the application. Legacy `.sql.gz` imports require the CLI import procedure. Retain the matching encryption key/salt; a database archive alone cannot recover encrypted settings after losing those inputs.

Data Management export is different: it streams a ZIP containing `campaigns.csv`, `leads.csv`, `forms.csv`, `form_responses.csv`, `campaign_statuses.csv` and `followups.csv`, with CSV formula-prefix handling. It is not a full backup and excludes several integration/authentication tables. All rows and CSV strings are currently assembled in memory before archiving.

Campaign-data deletion requires the exact confirmation accepted by its DTO/service, maintenance locking and ordered dependent-record removal. It preserves user accounts/global settings, removes associated communication/IVR data and cancels queued greeting intents. This procedure was exercised only against disposable test databases in this audit.

## 11. Observability and troubleshooting

| Symptom | Inspect |
| --- | --- |
| Form/status message not sent | Settings → Communication Setup → Automatic WhatsApp delivery; sender registration, pending/queued/failed counts and provider errors; then template approval/params/media, phone and DND |
| API says accepted but customer has no message | Provider message ID, delivery callback configuration, WhatsApp history state and provider-side delivery error |
| IVR callback accepted but lead absent | Settings → IVR Incoming → inbox events; worker, active target campaign, eligible sales users and retry state |
| Imported IndiaMART lead absent from sales worklist | `Lead.doerId`, partial-import result and query ID; see F04 |
| Saved Process Sutra settings but no Follow-ups action | Current/legacy configuration mismatch in F08 |
| Backup unavailable | Utility/server major versions, directory permissions, disk space, active clients and maintenance state |
| Counts differ between lists/reports | Caller scope, soft-deleted leads, date range, client fetch caps and F01/F07 |

Operational APIs include `/health`, `/health/detailed`, `/admin/health`, `/admin/jobs`, `/admin/failed-jobs` and the template delivery endpoint. The basic health endpoint establishes database connectivity only. The general administrator health endpoint can report a worker as running even after queue inspection fails (F12); it is not a heartbeat.

HTTP logs record method, path, status, duration, IP, user agent, actor and supplied request ID. They do not create a full immutable business-change audit trail. Webhook query secrets are redacted at the application layer. Job logs may contain customer-derived payloads; no comprehensive automatic retention policy is registered for all history, job, IVR and session data.

## 12. Verification and maintenance

Existing suite results for this audit: **121 passed, 0 failed, 0 skipped**.

| Suite | Tests | Main coverage |
| --- | --- | --- |
| `security.test.ts` | 47 | Resource scope, input validation, dashboard filters, public forms, notification state, allocation, media/webhooks and exports |
| `user-management.test.ts` | 15 | Last-admin protection, session issuance/rotation/revocation, account changes and transactional failures |
| `backup.test.ts` | 18 | Backup/restore, tools, locking, archive/path validation, state cancellation and rollback |
| `cloudconnect.test.ts` | 21 | Authentication, call normalization, duplicate/order/concurrency behavior, ownership and worker recovery |
| `templates.test.ts` | 20 | Template sync/approval/payloads, outbox atomicity, deduplication, DND/campaign checks, sales access, diagnostics and API-only recovery |

Run `npm test` from `backend` with `TEST_DATABASE_URL` or `DATABASE_URL` pointing to a development PostgreSQL role allowed to create databases. Suites create and drop uniquely named disposable databases; they must not be pointed at a role/installation where such operations are inappropriate.

Both builds passed during this review. Browser checks, dependency scans and additional audit probes are summarized in [evidence](AUDIT_EVIDENCE.json). The audit probes deliberately demonstrated defects; they are not counted as passing regression tests. There is no checked-in frontend test command or CI pipeline enforcing these checks (F16).

For future changes, add regression coverage for the relevant audit acceptance criteria, preserve migrations/compatibility, keep credentials out of queued/public data, and verify the provider acceptance-to-delivery transition rather than only a successful HTTP response.
