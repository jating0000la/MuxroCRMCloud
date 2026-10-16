# Audit verification and security remediation

Reviewed against the supplied audit on 2026-10-16. This change addresses the confirmed Critical/High security findings and the associated assignment/integrity problems. Lower-priority findings are recorded below, not presented as fixed. Verification distinguishes source inspection from executable regression coverage.

## Confirmed and addressed

| Finding | Result and evidence |
| --- | --- |
| Follow-up creation IDOR | Owner/admin authorization runs inside the insertion transaction after locking the lead. Foreign and deleted leads are rejected; HTTP regression coverage checks denied writes and permitted owner/admin writes. |
| WhatsApp cross-user inbox, history, contacts and stats | Every read uses the caller's identity. Linked messages follow lead ownership; legacy unlinked messages require an unambiguous owned phone. A record linked to another lead never becomes visible merely because the phone matches. Queries reject invalid pagination and cap the limit at 500. Admin access is retained. |
| Adjacent WhatsApp send authorization gap | User sends validate the destination and optional lead/campaign metadata before any provider call. Resolved ownership is recorded in outgoing messages. This prevents forged metadata from bypassing the new read isolation. |
| Dashboard cross-user data | USER conversion lists contain only the caller. Campaign/source/status counts and business alerts use assigned leads; funnel counts also exclude deleted/foreign leads and unrelated campaign status names. Admin totals remain available. |
| Logo active-content upload | PNG/JPEG/WebP only; extension, MIME and magic bytes must agree. Uploads are limited to 2 MiB. Serving uses an explicit image content type, `nosniff`, and a sandbox CSP; existing HTML/SVG extensions are rejected. HTTP tests include spoofed content, mismatched extensions, oversize files and a valid image round trip. |
| Backend CSV formulas | The shared backend CSV encoder prefixes `=`, `+`, `-`, `@`, tab, CR and LF with an apostrophe before normal CSV quoting. Tests parse generated lead, form-response and follow-up CSVs to verify the actual cell values. |
| Unauthenticated duplicate WhatsApp callbacks | One controller handles both existing URL families, with one constant-time token guard. All four callbacks require `X-Webhook-Token`; absent server configuration returns 503 and invalid/missing tokens return 401. Tests verify rejected requests do not mutate data and authenticated callbacks persist messages and delivery updates. |
| Inline-body validation and status mass assignment | Runtime DTO classes cover campaign statuses, public submission envelopes, JSON/CSV import options and bulk allocation. Services also whitelist status fields and scope update/delete by both campaign and status ID. Unknown fields, malformed bodies and cross-campaign targets are rejected in HTTP tests. Form data and import row custom fields remain intentionally flexible within their validated envelopes. |
| Inactive-user round-robin assignments | Eligibility requires both active campaign membership and an active USER account. Deactivation also disables campaign memberships in the user-management transaction. |
| Concurrent/cross-campaign allocations | A per-campaign advisory lock covers cursor selection and writes in the same transaction. A persisted cursor avoids timestamp ties and unrelated lead edits changing rotation. Foreign/deleted targets reject and roll back the entire allocation. Concurrent creation and form submissions exercise the real database pool. |
| Form transaction pool contention | Selection uses the caller's transaction rather than requesting a nested pool connection. Ten concurrent form submissions complete and allocate evenly on the standard five-connection pool. |
| Status integrity and empty lead update | Create/update/status writes reject statuses from another campaign. Status-only follow-up updates always write `updatedAt`, avoiding `set({})`. Transfers clear an invalid inherited status. |
| Partial bulk imports and CSV row cap | Both formats use the same transaction for batched lead inserts, allocation and initial follow-ups, and enforce 5,000 rows. Allocation failures roll back all writes. JSON and multipart literal `false` options are covered by positive HTTP tests. |
| PM2 worker omission and API heap flag | PM2 runs `dist/main.js` directly and adds `dist/worker.js`, with separate API/worker memory budgets. Both built processes are smoke-tested locally; production PM2/VPS operation is not claimed as tested. |

## Corrections to the supplied audit

- **Backup import does not stat a deleted scratch file.** `publish()` creates a hard link without deleting the scratch path; `finally` removes that path after `statSync`. The existing native/legacy import tests pass. Failed-import job logging is a separate, source-confirmed observability gap that remains.
- The layout settings failure is caught in `Layout.tsx`; it causes an unnecessary 403 request, not an unhandled promise rejection.
- The notifications parameter concern applies to the per-user follow-up ID list, not an unconditional load of the entire organization. That per-user list can still grow without a bound.

## Confirmed findings left for a separate lower-priority pass

These were checked in source; they have not all been reproduced with production-scale data or external services.

| Area | Remaining finding |
| --- | --- |
| Authentication | bcrypt comparison still runs under the login row lock; moving it requires preserving the existing password-change/session concurrency guarantees. Global implicit Boolean conversion remains in existing DTOs (for example `UpdateStatusDto.dnd` and `UpdateUserDto.isActive`); the new import options explicitly avoid it. |
| Follow-up listing | `my`/`upcoming` still validate the whole query against `PaginationDto` without declaring campaign/cursor keys; frontend `getMyFollowups` still types a paginated response as an array. |
| Lead statistics | Admin `LeadsService.getStats().byStatus` still includes soft-deleted rows. Dashboard counts touched by the access-control fix have been corrected. |
| IndiaMART | Background configuration reads `indiamartCrmKey` while settings write `indiamartApiKey`; imports do not allocate a doer; encrypted last-fetch settings are not decrypted. External IndiaMART calls were not exercised. |
| Query volume | Lead listing still retrieves all follow-ups before deduplicating. KPI/business-alert and notification queries still build potentially large ID arrays. |
| Full data deletion | The existing admin-only endpoint lacks a backend confirmation DTO and coordination with backup operations, retains WhatsApp rows, and uses unbounded `returning()` to count deletions. It remains a destructive admin operation requiring a separate design/test pass. |
| Backup observability | Failed archive imports do not record a failed job. Scratch-file cleanup itself is correct as described above. |
| WhatsApp unread state | Incoming `received` messages now count as unread, and tied chat timestamps no longer duplicate a conversation. There is still no explicit inbox mark-read mechanism; delivery state is not a full read-state model. |
| Admin health | Disk usage is calculated from RAM and then omitted from the returned payload. |
| Configuration/build | `.env.example` still omits application encryption keys, uses the wrong Compose port/pool option name, and contains shell-style placeholders; throttling is still hardcoded. The backend Dockerfile references a nonexistent backend-local `scripts/` directory. Docker image builds remain blocked by that existing defect. |
| Frontend | USER layout still requests admin-only settings; Process Sutra checks unwritten localStorage settings; dashboard links point to missing `/leads`; inbound remark parsing still requires a `wamid.` ID. |

## Deployment and compatibility

1. Before deploying, retain a normal pre-deployment database backup. With the backend environment loaded, run `cd backend && npm run db:migrate` and `npm run build` before starting the updated API/worker. Migration `0003_round_robin_cursor.sql` creates the allocation cursor. Existing idempotent WhatsApp/index migrations are now registered in the Drizzle journal as well; previously unregistered deployments will apply those migrations once.
2. The added table changes backup schema validation. Keep older archives for recovery with the matching prior application version, and create a fresh backup after migration. Do not bypass the existing incompatible-schema restore rejection.
3. Generate a random `GUPSHUP_WEBHOOK_TOKEN` securely (for example `openssl rand -hex 32`), set it in the backend/worker runtime environment, and configure the callback sender to provide that same value as `X-Webhook-Token` for message and status events. The supported callback paths remain `/api/v1/whatsapp/webhook`, `/api/v1/whatsapp/webhook/status`, `/api/v1/integrations/gupshup/webhook` and `/api/v1/integrations/gupshup/webhook/status`. Tokens in query strings are deliberately unsupported to avoid logging them in URLs. Existing senders without the header must be updated before enabling callbacks on the new version.
4. Existing SVG/HTML company logos need re-uploading as PNG/JPEG/WebP. Users with shared phone numbers may see fewer legacy unlinked messages; admins retain organization-wide access.
5. PM2 paths remain the repository's existing VPS paths. Production resource sizing and provider delivery require deployment-specific verification.

## Validation

- `cd backend && npm run build`
- With a disposable development PostgreSQL service: `cd backend && npm test`
- `cd frontend && npm run build`
- Run/re-run registered migrations, start the built API/worker, and check API/database health, frontend proxy health and worker processor registration.

The regression suites create and drop isolated databases; they must never target a production server. No real outbound messaging is needed for these tests. Validated locally: all 51 backend tests passed (33 existing plus 18 security regressions), both builds passed, migrations reran successfully, and API/proxy health and worker startup passed. A final shared-phone predicate hardening also passed its targeted regression rerun. Production deployment and live provider delivery were not performed.
