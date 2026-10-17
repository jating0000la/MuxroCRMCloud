# CloudConnect incoming enquiries

This integration implements incoming enquiries first. IVR reception operators answer calls; salespeople own enquiries and follow up in CRM. It does not place outgoing calls or embed the CloudConnect dialer.

## Activate

1. Deploy the backend and frontend together. Apply Drizzle migrations through `npm run db:migrate` in `backend` using the deployment database connection. The new migrations are `0004_open_titanium_man.sql` (call history/inbox) and `0005_clumsy_sunspot.sql` (encrypted configuration storage capacity). Take a database backup first, following your normal deployment procedure.
2. As an admin, open **Settings → IVR Incoming**. Select or create **IVR Enquiries**. On the campaign page assign active salespeople with USER roles. Reception operators do not have to be CRM users and should not be added to the sales rotation unless they also sell.
3. Enter your CloudConnect Tenant ID and incoming CloudConnect campaign IDs. These provider IDs are numeric and differ from the CRM campaign UUID. Optionally map incoming Agent IDs to operator names.
4. Generate a webhook token. Copy it immediately: the server retains only its hash, and it cannot be displayed again. Replacing it invalidates the previous token immediately.
5. Give CloudConnect the public HTTPS callback URL displayed in the UI: `/api/v1/integrations/cloudconnect/webhook`. Ask them to send `X-CloudConnect-Token: <token>`. If their callback configuration cannot send headers, use the generated URL containing `?token=...`. Treat that full URL as a secret. Application logs omit the callback query, but reverse proxy/access logs must also omit it. Never put the token into a ticket, committed file or frontend configuration.
6. Enable incoming enquiries and save. Ask CloudConnect to configure Ringing, Answered and Hangup events for your incoming campaigns. Run the API and the standalone worker; the worker recovers pending events every five seconds.
7. Test one answered incoming call, one unanswered call, a repeated call and a transfer. Confirm the enquiry, salesperson assignment and **Lead details → IVR Calls**. Check the Settings event list for processing errors and retry after correcting the campaign/sales assignments.

No real CloudConnect tenant or credentials are bundled or activated. Provider callbacks cannot reach a local development URL; configure the deployed HTTPS URL.

## Behavior

- Only authenticated INBOUND events for configured CloudConnect campaigns enter the selected CRM campaign. OUTBOUND and other campaigns are acknowledged and ignored.
- The sample payload from CloudConnect API document section 14 is supported over GET query, JSON POST or URL-encoded POST. Fields used: `call_uuid`, `callid`, `callernumber`, `status`, `campaignId`, `call_direction`, `agent_id`, `transfer_id`, `reason`. Optional `tenant_id` must match the configured tenant. Unknown provider fields are ignored; credentials and raw provider sessions are not persisted.
- `call_uuid` identifies a call; `callid` is the fallback when UUID is absent. Have the provider send consistent identifiers for every lifecycle event and confirm transfer behavior before enabling production intake. The webhook URL/token is scoped to one configured tenant.
- The first accepted event creates a durable inbox row before HTTP 202. Processing atomically creates or updates the call and the lead; callback retries cannot produce duplicate enquiries. Ringing, Answered and Hangup update the same call, and delayed events do not reopen an ended call. A delayed Answered event clears the callback flag.
- Indian local numbers (`9876543210`, `09876543210`, `+91 9876543210`, `919876543210`) match the same caller. Other international numbers must carry `+` or `00` country-code notation. Confirm the provider's caller formatting for your tenant.
- Different calls from the same phone reuse the latest non-deleted enquiry in the selected campaign, including enquiries originally created by other intake methods. Existing salesperson, status, source and DND are preserved. Another campaign or a soft-deleted lead is not reused. Closed statuses are not automatically reopened.
- New callers receive source `ivr`, the campaign's first status and a salesperson selected by the existing round-robin rules. IVR Agent IDs never determine sales ownership. Reception operator information belongs to the call record.
- **Callback needed** means Hangup arrived without an Answered event. It is a conservative follow-up flag, not proof that the caller was never answered. Call durations, recordings and provider dispositions are not inferred from these limited callbacks. Displayed times are CRM event-receipt times, not provider call-start times.
- Failed processing automatically retries up to five attempts with backoff. Exhausted events remain visible for manual retry in Settings. The worker must be running for background recovery after restarts; normal delivery also attempts processing immediately.
- Disabling intake blocks new callbacks. Previously accepted pending events continue processing. Inactive/deleted campaigns cannot accept new enquiries. Removing all sales users retains new events for retry; no enquiry is assigned to an IVR operator as a fallback.
- Call history is available to admins and the enquiry's current owner. Admin-only event lists omit raw payloads. Tokens are hashed and the configuration is encrypted with the application's existing encryption key.
- Bulk data deletion also clears IVR calls and inbox rows. Backup/restore and IVR processing use the same maintenance lock. Restored pending/failed events require explicit review/retry, preventing automatic replay. A dump predating the new tables cannot be restored into the upgraded schema through the app's strict restore validator; use a tested upgrade/recovery procedure for older snapshots.

## Provider confirmation before production

The supplied API document leaves webhook authentication setup, delivery/retry guarantees, request method, transfer identifier stability, and inbound calls that never reach an agent incompletely specified. Confirm these with CloudConnect and test them with your tenant. The webhook responds 202 only after durable acceptance and uses 400 for malformed payloads, 401 for an invalid token and 503 when intake is disabled or database maintenance blocks acceptance. Unknown campaigns and OUTBOUND calls return 202 with `ignored: true`.

This phase does not poll Get Call History or Get Call Details to discover calls whose callbacks were never delivered. Automatic CDR reconciliation, recordings, exact durations and integrated outgoing calling are separate follow-up work. Outgoing CRM calling would require each calling salesperson's CloudConnect Agent ID, an active agent session and the documented click-to-call setup.

## Validation

Regression tests use disposable PostgreSQL databases and synthetic callbacks, not real customer calls. Run `npm test` in `backend`, plus `npm run build` in both backend and frontend. Tests cover authentication, permissions, transport formats, assignment, concurrent deduplication, phone matching, repeated calls, transfers, event ordering, retries, secret handling, deletion and restore.

Verification on 16 October 2026: **87 backend tests passed**, including 21 CloudConnect scenarios; both production builds passed. Browser checks verified admin setup, simulated local callback intake and assigned salesperson call history. [Sanitized verification results](audits/2026-10-16/cloudconnect-verification.json). No real provider calls were made.
