# Frontend and backend functionality audit

Repair follow-up: [implementation and verification](PAGE_AUDIT_REPAIRS.md). The findings below describe the original audited revision.

Audit date: 16 October 2026. Reviewed commit: `32c7e76` on `work`.

**Result: 21 reproduced findings: 3 P1, 17 P2 and 1 P3.** Core workflows work, but the application does not pass a complete functional audit. Two additional cross-user data exposures and a broken ZIP export are the highest priorities. No application fixes were made during this audit.

## Coverage and evidence

All 12 routes in `frontend/src/App.tsx` were mapped and reviewed. Chromium 154 exercised the actual React frontend against the actual NestJS API, with separate admin, USER and anonymous sessions. Mutations, full deletion and restore used databases named `muxro_page_audit_*`, isolated from the existing development database. The desktop viewport was 1440 × 1000; nine authenticated routes received a 390 × 844 layout check, with an additional selected-chat check on mobile.

The audit included frontend page loads, role redirects, browser form submissions, backend CRUD, validation, ownership checks, response contracts, session refresh, backup/download/restore, and a destructive deletion/recovery check. The existing **51 backend tests passed with zero failures or skips**, and backend/frontend builds passed. Those checks do not cover the additional failures below.

Machine-readable observations are in [page-audit-evidence.json](audits/2026-10-16/page-audit-evidence.json). Screenshot/log artifacts and exploratory harnesses are retained outside the checkout in `/workspace/.cloud-setup/page-audit/`; auth storage and environment files are intentionally excluded from repository evidence. Early harness issues (working directory and selectors) were corrected and relevant checks repeated; they are not counted as application findings.

## Page-by-page result

“Passed” below means the listed scenarios succeeded; it does not certify every possible input or external integration.

| Page / route | Frontend and backend checks that passed | Confirmed gaps | Result |
| --- | --- | --- | --- |
| Login `/login` | Invalid credentials return 401; valid browser login redirects to dashboard; reload preserves login; removing the access cookie triggers a successful refresh; Sign out redirects to login and profile returns 401. | Shared notification ownership issue applies after login (F02). | Covered login flows passed |
| Dashboard `/dashboard` | Admin and USER render without JS crashes; overview/KPI/funnel/conversion/report APIs return 200 for normal fixture data; USER conversion data is scoped. | Missing leads destination (F10), shifted date range (F05), malformed dates cause 500 (F20), shared settings request (F18). | Issues |
| Campaigns `/campaigns` | Admin listing/search controls render; full browser wizard creates campaign, creates/publishes form and assigns selected user; create/update/assign/remove-member APIs work. USER route redirects to dashboard. | Skip All falsely reports creation (F06). | Issues |
| Campaign detail `/campaigns/:id` | Admin leads/forms/team/settings tabs render; manual lead create/edit, owner denial, CSV/import regression coverage and form publish/update/delete work. Browser form-builder Update persists. Deleting a form preserves its associated lead. USER route redirects. | Submission exposure (F01), submission pagination/count (F14/F15), wrong nested campaign path accepted (F21). | Issues |
| Follow-ups `/followups` | Both roles load; browser lead detail → Update Status → Converted persists through the API. Other-owner lead edits are rejected. | Filter resets on polling (F07), API query validation (F11), stale transfer notifications (F02), shared settings requests (F18). Source-only Process Sutra issue is noted separately. | Issues |
| DND `/dnd` | Scoped DND listing; browser Remove DND returns 200 and removes the row. Boolean `false` correctly clears DND. | String `"false"` silently sets DND true (F12), shared settings request (F18). | Issues |
| Users `/admin/users` | Admin listing and browser Add User work; API edit, password reset/new-password login, deactivate, reactivate, unused-user permanent delete work. USER route redirects and user-management endpoints return 403. Existing admin-lockout/session tests pass. | No additional failure reproduced in these covered user-management flows. Shared notification ownership after lead transfer remains F02. | Covered user-management flows passed |
| Backups `/admin/backups` | Capabilities/readiness, browser creation/listing, native custom archive download, size/magic checks, invalid-confirmation rejection, full restore, data recovery and old-session invalidation pass. USER access denied. | Existing production scheduling/provider/platform deployment was not exercised. | Covered backup flows passed |
| Data management `/admin/data-management` | Admin page renders; USER route redirects and actual download/delete APIs return 403. In disposable data, delete and restore recovery work. | ZIP export fails (F03); deletion retains WhatsApp data and has no backend confirmation gate (F17). | Issues |
| Settings `/settings` | Admin page renders; nonempty company name persists through reload; API settings read/audit-log work. USER route redirects and admin settings API rejects USER. | False save success on errors (F08), stale SVG guidance (F19), company branding unavailable to USER through the current shared request (F18). Live integration tests excluded. | Issues |
| WhatsApp `/whatsapp` | Scoped chat list/history/contacts/stats load for both roles; browser selects a conversation and renders messages. Prior cross-user read tests pass. | Mobile composer lies outside viewport (F04), Contact Info has no rendered panel (F13). External sends remain untested; service-contract gaps below. | Issues |
| Public form `/form/:slug` | Anonymous published form loads; unpublished form returns 404; required validation works; browser valid submission shows Thank You and creates an assigned lead; form builder changes can be loaded. | Upload limit mismatch (F09), inactive campaign still accepts submissions (F16). Stored submissions are exposed via F01. | Issues |

## Reproduced findings

Priority means remediation order: P1 = high-impact exposure or blocked core feature; P2 = functional/validation/integrity issue; P3 = lower-impact consistency issue. Priorities are not CVSS scores.

### P1

**F01 — A campaign member can read another owner's public-form response.**

- Source: `backend/src/forms/forms.controller.ts:83`, `backend/src/forms/forms.service.ts:223`.
- Reproduction: assign Alice and Bob to one campaign, submit two public enquiries so each owns one lead. As Alice, request `GET /campaigns/:campaignId/forms/:formId/submissions`. It returns **200** including Bob's enquiry data, while `GET /leads/:bobLeadId` correctly returns **403**.
- Impact: lead-owner isolation can be bypassed to obtain customer-submitted contact/custom data. The UI's admin route restriction does not protect the backend.
- Fix direction: restrict raw submission listing to admins or join submissions to leads and apply current lead ownership for USER callers. Retain campaign authorization as an additional check.

**F02 — Transferring a lead leaves its data visible in the previous owner's notifications.**

- Source: `backend/src/notifications/notifications.service.ts:64`, `:140`, `:166`, `:186`.
- Reproduction: schedule a follow-up for Alice in five minutes, transfer the lead to Bob, then fetch Alice's `/notifications/pending`. The response remains **200** and includes the transferred lead and follow-up remarks. Direct lead access is **403**. Calling `/notifications/sync` does **not** remove it.
- Impact: stale notifications disclose lead names and follow-up content after ownership changes and can direct the old user into a forbidden detail view. This is separate from, and survives, the earlier lead-list access fix.
- Fix direction: apply current lead ownership/deletion/DND rules to notification reads/counts and sync; transactionally clean up or reassign notifications during transfers.

**F03 — Download CSV ZIP fails for the installed dependency version.**

- Source: `backend/src/data-export/data-export.service.ts:15`, `:299`.
- Reproduction: admin opens Data Management and clicks Download CSV ZIP. `GET /admin/data-export/download` returns **500**, no browser download starts, and the UI says Download failed. The backend log reports **`TypeError: archiver is not a function`**.
- Cause: the installed Archiver 8 module does not match the callable CommonJS import used by the service.
- Fix direction: use the installed package's supported export/API and add a real HTTP archive-generation/integrity test. The existing CSV escaping tests do not exercise archive creation.

### P2

| ID | Page / source | Reproduction and observed behavior | Fix direction |
| --- | --- | --- | --- |
| F04 | WhatsApp; `frontend/src/pages/whatsapp/WhatsAppPage.tsx:166` | On a 390 px viewport, select a chat. Composer starts at **x=398**, Send at **x=596**; both are outside the viewport. A page-width-only check misses this clipped content. | Show a mobile conversation list/detail transition, collapse the sidebar when a chat opens, and keep composer/actions in the viewport. |
| F05 | Dashboard; `backend/src/dashboard/dashboard.service.ts:811` | `daily-trend?startDate=2026-10-01&endDate=2026-10-16` returns **46 rows beginning 2026-09-01**, rather than 16 beginning 1 October. The method always subtracts 30 days, including when a start date was supplied. | Subtract the default lookback only when no explicit start date exists; test exact date boundaries. |
| F06 | Campaign wizard; `frontend/src/pages/campaigns/CampaignsPage.tsx:239` | Enter a campaign name on step 1, click Skip All. A “Campaign created” toast appears, but campaign count stays **3 → 3** and no create POST occurs. | Create the campaign before skipping optional steps, or label the action Cancel and remove the success message. |
| F07 | Follow-ups; `frontend/src/pages/dashboard/FollowupDashboardPage.tsx:118` | Select New in the status filter. After the 10-second refresh, selection changes from `New` to the empty All Status value. The effect depends on `leads` and resets the filter on every reload. | Preserve a valid selected filter across refresh; reset only on explicit campaign/filter changes. |
| F08 | Settings; `frontend/src/pages/settings/SettingsPage.tsx:149`, `:204` | On a fresh database, save the profile with optional fields empty. Missing setting PUTs return 404, blank-value create POSTs return 400, retries return 404, but the browser shows **Profile saved successfully**. Subsequent GET of companyPhone remains 404. | Agree on empty optional-value handling, propagate save errors, and distinguish partial from complete success. |
| F09 | Public form; `frontend/src/pages/forms/public-form/constants.ts:36`, `backend/src/main.ts:52` | UI accepts a **1,228,800-byte** file and advertises 4 MB; base64 JSON submission returns **413 request entity too large** against the real server's 1 MB parser limit. | Align the total encoded-payload limit, or use a dedicated bounded file-upload endpoint. |
| F10 | Dashboard; `frontend/src/pages/dashboard/DashboardPage.tsx:632`, `frontend/src/App.tsx` | Click a link whose destination is `/leads`. No route exists, so the browser returns to `/dashboard`. | Point to a real listing, or implement a guarded leads route. |
| F11 | Follow-ups API; `backend/src/followups/followups.controller.ts:47` | `/followups/my?campaignId=...`, `/followups/my?cursor=...`, and `/followups/upcoming?campaignId=...` all return **400**, “property … should not exist”. | Declare filter/cursor fields in a query DTO. The current page loads through `/dashboard/leads`, so this is a broken API/service contract, not a claim that initial page rendering fails. |
| F12 | DND/status writes; `backend/src/main.ts:50`, `backend/src/leads/dto/update-status.dto.ts:28` | PUT a status update with `dnd: "false"`. It returns **200** and persists **`dnd: true`**. A real JSON boolean false works. | Reject non-boolean JSON values or use explicit raw-value transforms instead of implicit Boolean coercion. |
| F13 | WhatsApp; `frontend/src/pages/whatsapp/WhatsAppPage.tsx:182`, `:203` | Select a conversation and click Contact Info. The panel count stays **0**. The button toggles state, but the entire panel render block is commented out. | Restore the panel with functional data/actions or remove the inactive control. |
| F14 | Form submissions API; `backend/src/forms/forms.controller.ts:83`, `backend/src/forms/forms.service.ts:223` | With **54 enquiries**, requests for page 1 and page 2 each return the **same 50 rows**. Controller never binds/passes pagination. | Bind a validated query DTO, pass it to the service, and return a pagination contract. |
| F15 | Campaign Forms tab; `frontend/src/pages/campaigns/CampaignDetailPage.tsx:799`, `backend/src/forms/forms.service.ts:58` | Form list API has no `_count` field even with **54 stored submissions**. The UI falls back to **0 submissions**. | Return actual counts or stop displaying an unsupported count. |
| F16 | Public intake; `backend/src/forms/forms.service.ts:81` | Deactivate the campaign but retain its published form. Public GET still returns **200** and valid submission returns **201** with a newly created lead. | Define and enforce whether inactive campaigns may accept intake; if inactive means stopped, check campaign state in both public reads and submission transactions. |
| F17 | Data Management; `backend/src/data-export/data-export.controller.ts:55`, `backend/src/data-export/data-export.service.ts:319` | Admin DELETE `/admin/data-export/all` succeeds **without any confirmation body**. Counts change campaigns **5 → 0**, leads **11 → 0**, but messages **4 → 4** and contacts **4 → 4**. USER receives 403. The page describes removal of all CRM data. | Define deletion scope, require backend confirmation, coordinate with backup/restore, and include WhatsApp data or accurately describe retained history. |
| F18 | Shared layout; `frontend/src/components/layout/Layout.tsx:140` | Each fresh USER page mount makes `/settings?masked=true` requests that return **403**; the shared layout calls an admin-only endpoint. USER sessions retain fallback branding rather than loading the company profile. | Expose a minimal authenticated branding endpoint or restrict the request to the correct role. Do not expose integration settings to USER accounts. |
| F19 | Settings logo; `frontend/src/pages/settings/SettingsPage.tsx:418` | File picker and help text advertise SVG. A benign SVG selected through that picker is rejected with **400**, “Upload a PNG, JPEG, or WebP …”. | Update frontend accept/types/help/size guidance to match the hardened raster-only backend; do not re-enable unsafe SVG serving. |
| F20 | Dashboard filters; `backend/src/dashboard/dashboard.controller.ts`, `backend/src/dashboard/dashboard.service.ts:811` | `GET /dashboard/daily-trend?startDate=invalid-date` returns **500**; backend log shows an invalid timestamp passed to PostgreSQL. | Validate date syntax/range before querying and return a useful 400 response. |

### P3

**F21 — Nested form routes ignore the campaign ID in the URL.** At `backend/src/forms/forms.controller.ts:39`, retrieving a form through another campaign's URL returns **200** with the form's real, different campaign ID. Authorization still checks the actual form campaign; the reproduced admin request does not demonstrate a new privilege bypass. Bind and verify the URL campaign ID consistently for read/update/publish/delete/submission operations.

## Additional source-level risks and external checks

These are not included in the 21 reproduced findings unless explicitly referenced above.

- **IndiaMART:** settings write `indiamartApiKey`, but `backend/src/jobs/job-processors.service.ts:48` reads `indiamartCrmKey`; imported leads lack round-robin doers; encrypted last-fetch values are not decrypted. Provider requests and background import execution were not run without a real configured account.
- **Process Sutra:** Follow-ups reads `processSutraSettings` from localStorage, while Settings persists server-side settings and no code writes that localStorage key. The start-flow button therefore stays hidden in a normally configured fresh browser. No real flow was started.
- **WhatsApp service contracts:** frontend quick-reply/list helpers declare arrays but the backend accepts strings. Reproducing those declared payloads yields 400 before provider access. Location numbers pass implicit conversion and then fail only because provider settings are absent; that is not a proven location DTO defect. Stats fields `incomingMessages/outgoingMessages` and chat fields `lastMessageType/totalMessages` also differ from the actual response. The current rendered sidebar uses the working `uniqueChats` field; unused fields are not presented as a current visible-counter failure.
- **Large datasets:** backend KPI/notification follow-up lists and export queries can still grow without bounds; frontend all-lead fetches have safety caps. This audit used representative synthetic records and did not load-test production-scale data or prove latency/memory exhaustion.
- **Deployment:** production Caddy, PM2 restart behavior, Docker images, secret injection, scheduled jobs and live TLS/domain behavior were not exercised in this local page audit. The separate remediation report records known deployment configuration gaps.
- **Browser scope:** Chromium only; no Safari/Firefox, assistive-technology, offline/network-loss or full accessibility certification. Mobile outer layout checks found no document overflow, but the dedicated composer check found F04.

## Recommended order

1. Close F01/F02 together with transfer, reassignment, soft-delete and DND notification regression tests.
2. Repair F03 and validate the entire downloaded ZIP, not just CSV cell escaping.
3. Address mobile messaging, date-range correctness, false-success flows, form upload limits and polling/filter stability.
4. Align query/response contracts and administrative deletion scope; then exercise external integrations in a controlled provider account.

The audit-only API/frontend processes were stopped and both disposable audit databases removed after validation. The existing development API, frontend and database remained available. Audit reports and sanitized evidence are the only repository additions from this task. Application code, dependencies and lockfiles were left unchanged. No fixes were deployed or pushed as part of this audit.
