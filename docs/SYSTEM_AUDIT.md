# MuxroCRM Cloud — system audit

**Date:** 17 October 2026 · **Application commit:** [`c5de389`](https://github.com/jating0000la/MuxroCRMCloud/commit/c5de38928b20af2fb1ca81333a220f5f2d1df659) · **Branch reviewed:** `main`.

## Audit result

The existing **121 regression tests pass**, both production builds pass, and the desktop/mobile route smoke checks pass. Additional targeted checks nevertheless reproduced defects in report scope, transfer concurrency, DND enforcement, IndiaMART intake, report semantics, input validation, campaign initialization, operational health and Process Sutra configuration.

The findings register contains **six High and ten Medium findings**. No new critical application exploit was demonstrated. Separately, npm's registry reported **one Critical package-level advisory in backend production dependencies**, together with other High/Moderate advisories. Dependency severity and demonstrated application exploitability are deliberately distinguished.

This is a repository and isolated-development-environment audit. It does not establish that the latest commit is deployed on the VPS, that its reverse proxy or database matches the examples, or that real Gupshup/CloudConnect/IndiaMART/Process Sutra accounts deliver correctly. No real customer messages, calls or provider workflows were initiated.

The application defects below remain open. This documentation update supplies evidence and implementation guidance; it does not silently repair code or upgrade dependencies.

## Scope and method

| Area | Evidence collected |
| --- | --- |
| Code inventory | 131 backend TypeScript files; 96 frontend TypeScript/TSX files |
| UI | 12 routes; administrator and sales access; desktop/mobile rendering; focused settings/campaign/form/lead tabs |
| HTTP surface | 135 controller-handler declarations, expanding to 138 method/path combinations; [API inventory](API_REFERENCE.md) |
| Persistence | 20 application tables, seven SQL migrations, foreign keys, indexes, JSON data and deletion/recovery paths |
| Security | Session/role checks, ownership, callback tokens, upload/input limits, secret storage and outbound contact paths |
| Reliability | Transactions, transfer races, outbox/queue processing, retries, duplicate handling and backup/restore behavior |
| Integrations | WhatsApp/Gupshup, approved templates, incoming CloudConnect, IndiaMART and Process Sutra |
| Operations | Node/database requirements, PM2/Compose/Docker artifacts, environment contract, logs, health and backup scope |
| Verification | Existing regression suites/builds; isolated failure/concurrency probes; browser smoke checks; full and production-only npm audits |

Runtime verification used Node **24.19.0**, PostgreSQL **17.11** and Chromium. The repository's PostgreSQL 15 Docker image, actual VPS, production load, offsite recovery and live provider delivery were not tested. Dockerfile findings were established from source/context/dependency requirements rather than a completed image build.

Functional probes used synthetic accounts and data in a uniquely named disposable database. Some probes injected a controlled database failure or gated an operation to produce a deterministic concurrency interleaving. Those results establish the observed behavior under that condition; they are not claims that a production incident was observed.

## Verification summary

| Check | Result | Interpretation |
| --- | --- | --- |
| Backend existing suites | 121 passed; 0 failed/skipped | Strong regression evidence for covered cases, not proof of all business invariants |
| Backend production build | Passed | NestJS/TypeScript compilation succeeded |
| Frontend production build | Passed | TypeScript and Vite build succeeded |
| Route/browser smoke | 46 checks passed across desktop/mobile and ADMIN/USER/public contexts | No observed page exception, unexpected failed API request or incorrect role redirect in that sweep |
| Focused UI tabs | 16 passed | Settings, campaign, form-builder and lead-detail tabs rendered without page exceptions |
| Targeted backend probes | 10 defect behaviors reproduced; one pagination hypothesis disproved | Details P01–P11 in [evidence](AUDIT_EVIDENCE.json) |
| Process Sutra browser probe | P12 reproduced | Saved server configuration did not enable the fresh-browser Follow-ups action |
| Dependency scans | Advisories present; commands returned nonzero as expected | Counts below are package-level npm results |

The focused tab-check result is also preserved in the evidence file. Browser smoke checks are narrower than complete action-by-action acceptance testing. Existing suites cover more mutations, maintenance and callback cases; live external delivery remains unverified.

### Dependency audit counts

| Project/scope | Critical | High | Moderate | Total package entries |
| --- | ---: | ---: | ---: | ---: |
| Backend, all dependencies | 1 | 8 | 8 | 17 |
| Backend, `--omit=dev` | 1 | 6 | 3 | 10 |
| Frontend, all dependencies | 0 | 9 | 5 | 14 |
| Frontend, `--omit=dev` | 0 | 1 | 2 | 3 |

These are not independent exploit counts: a transitive advisory can affect multiple package entries, and the same package can occur in both projects. Browser dependencies do not necessarily use their Node-specific vulnerable adapters. Production reachability needs triage in addition to lockfile remediation.

## Prioritized findings register

| ID | Severity | Finding | Evidence | Priority |
| --- | --- | --- | --- | --- |
| F01 | High | Campaign report leaks private campaign metadata/aggregate totals | P01 | Immediate |
| F02 | High | Lead status writes can survive an ownership/campaign transfer race | P06 | Immediate |
| F03 | High | Direct WhatsApp session messages bypass DND enforcement | P07 | Immediate |
| F04 | High | IndiaMART leads are unassigned and import failures can leave partial records | P04/P05 | Immediate |
| F05 | High | Production dependency advisories include a registry-Critical package | npm audits | Immediate triage/upgrade |
| F06 | High | Backend container deployment has a broken context and unsupported Node version | Dockerfile/lockfile inspection | Before container use |
| F07 | Medium | Campaign report ignores date totals and counts active leads as lost | P02/P03 | Next repair set |
| F08 | Medium | Process Sutra action reads legacy browser settings instead of saved server configuration | P12 | Next repair set |
| F09 | Medium | IndiaMART Auto-fetch setting has no scheduled execution | Producer/scheduler inspection | Before unattended intake |
| F10 | Medium | Generic pagination accepts fractions that cause HTTP 500 | P08 | Next repair set |
| F11 | Medium | Campaign initialization is not atomic | P11 | Next repair set |
| F12 | Medium | Health can be falsely green and failed-job recovery is incomplete | P10; log/API inspection | Next repair set |
| F13 | Medium | UI cannot navigate beyond fixed chat/history windows | Client/service inspection | Before larger histories |
| F14 | Medium | Environment sample disagrees with startup/runtime requirements | Config/source comparison | Before new deployment |
| F15 | Medium | Data buffering and inline files create unmeasured capacity risk | Data-path/config inspection | Measure before scaling |
| F16 | Medium | No checked-in CI or frontend regression command enforces the verified behavior | Repository/package inventory | Add with repair work |

### F01 — campaign report crosses the sales scope

**Source:** [campaign report](../backend/src/dashboard/dashboard.service.ts#L709).

The initial lead conditions include a sales-owner filter, but the report enumerates all active campaigns and later replaces scoped totals with a second all-owner aggregate. A sales user assigned to no leads in the private campaign received that campaign's name and a total of **1**. Other row APIs remained ownership-scoped in this audit; the reproduced exposure is campaign metadata/aggregates, not a demonstrated bulk contact-record dump.

**Reproduce:** Create campaigns A/B, assign Alice only to A, assign a lead in B to Bob, then request `/dashboard/campaign-report` as Alice. Observe B's metadata/count.

**Repair:** Scope the campaign set itself and reuse exactly the same caller/date/soft-delete conditions for every aggregate. Decide and enforce whether sales reporting is own-lead or permitted-team aggregate reporting; it must not enumerate private campaigns implicitly.

**Acceptance:** Alice cannot observe B or Bob's totals through any report; scoped report totals reconcile with scoped worklists, including date filters. Add an authenticated API regression, not only a service smoke test.

### F02 — status update and transfer can interleave incorrectly

**Source:** [lead update/status methods](../backend/src/leads/leads.service.ts#L199); [independent lead foreign keys](../backend/src/db/schema.ts#L137).

`updateStatus` reads and authorizes the lead before its transaction, validates the requested status against that old campaign, then updates by lead ID without locking/rechecking current ownership/campaign. The probe paused after status validation, performed an administrator transfer to another campaign/owner, then resumed the original sales update. The final lead belonged to the new campaign and Bob while referencing a status from the old campaign.

**Impact:** A previously authorized sales request can mutate a lead after reassignment; campaign/status integrity can be broken. Related generic lead-update paths also warrant the same transaction-boundary review.

**Repair:** Lock the current lead inside the mutation transaction, authorize that locked state, validate status against the current/effective campaign and write using the locked/conditional state. Apply a consistent lock order for transfers and status updates; consider a database constraint for campaign/status membership.

**Acceptance:** A deterministic transfer/status race either serializes safely or returns a conflict/denial. The prior owner cannot write after reassignment, and every non-null status belongs to the lead's campaign.

### F03 — DND policy differs between message paths

**Source:** [direct send access](../backend/src/whatsapp/whatsapp.service.ts#L122), [template lead-state check](../backend/src/integrations/templates/gupshup-templates.service.ts).

The shared template sender rejects DND leads, but direct WhatsApp session access checks owner/deleted/phone state without checking DND. A sales account posted a session text to its DND lead; the API returned **200** and made one **mocked** provider request. No real message was sent.

**Repair:** Define one outbound-contact policy and apply it to text/media/template/broadcast/queued/low-level sends, with any intentional administrator override made explicit. Enforce it near dispatch as well as in UI affordances so delayed jobs and direct API callers have the same protection.

**Acceptance:** A DND lead cannot reach the mocked provider through any prohibited outbound path, including a state change between enqueue and execution. Permitted non-DND owned-lead sends still work.

### F04 — IndiaMART intake is inconsistent and can be partial

**Source:** [IndiaMART importer](../backend/src/integrations/indiamart.service.ts#L97).

Normal import created a lead with `doerId=null` despite active sales members. It creates the initial follow-up under the campaign manager/admin, rather than using the normal sales allocation transaction. In a second probe, an injected follow-up failure returned `errors=1, imported=0` while one query-ID lead remained persisted. A later import sees that unique query ID as a duplicate and can skip the missing follow-up.

**Repair:** Validate campaign/eligible assignment, perform owner selection + lead + initial follow-up atomically for each import unit, and reconcile query-ID conflicts/retries. Advance the fetch checkpoint only under a documented complete/partial-import policy.

**Acceptance:** Imported leads appear in the assigned sales user's worklist; a follow-up failure leaves no incomplete lead or is explicitly recoverable; retry completes rather than silently discarding a partially imported query.

### F05 — runtime dependencies need security remediation

**Source:** audited [backend lockfile](../backend/package-lock.json), [frontend lockfile](../frontend/package-lock.json) and npm registry advisories recorded in [evidence](AUDIT_EVIDENCE.json).

The backend production scan reports `proxy-addr` **2.0.7** as Critical under [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h). Its stated condition involves IPv4-mapped IPv6 trusted-subnet behavior. This application configures numeric `trust proxy=1`, not an explicit subnet list; the audit did **not** demonstrate exploitation of that advisory through the current application topology. The installed vulnerable package is still confirmed and should be upgraded/triaged.

Other production entries include Axios **1.18.1**, Multer **2.2.0**, JS-YAML **4.3.0**, a nested brace-expansion **5.0.7**, CSV parser **5.6.0**, `qs` **6.15.3** and UUID **9.0.1**, plus affected NestJS parent packages. Frontend production entries are Axios and React Router/React Router DOM. Development/build advisories are additional findings in the full scans.

**Repair:** Prioritize compatible runtime patches and review the affected code paths/advisory conditions. Registry ranges identify patches such as proxy-addr 2.0.8+, Axios 1.20.0+, JS-YAML 4.3.2+ and the relevant patched Multer releases. Verify the resulting dependency tree and both application builds/suites. Review major-version changes separately; npm's suggested force fix includes a Drizzle Kit downgrade and Tailwind major migration and should not be applied blindly.

**Acceptance:** Regenerate/audit both lockfiles, establish which advisories remain and why, and verify uploads, authentication/proxy handling, imports, provider calls, frontend routing and migration generation. A lower audit count without application compatibility checks is insufficient.

### F06 — backend Docker deployment is not reproducible

**Source:** [backend Dockerfile](../backend/Dockerfile), [Drizzle configuration](../backend/drizzle.config.ts), root [scripts](../scripts/backup.sh), pg-boss engine requirement in the lockfile.

The backend's natural build context contains its package manifest, but no `backend/scripts` directory for `COPY scripts/ /app/scripts/`. Root-level scripts also assume the repository's `../backend` layout. The runtime stage does not copy the `drizzle` SQL migration directory. Both builder/runtime use Node 20 while pg-boss requires Node **>=22.12.0**.

**Repair:** Choose/document a correct build context and maintained Node version, provide usable backup entry points and migration assets in the image, and pin matching PostgreSQL client tools. Validate the frontend image/type-check path as part of the container release too.

**Acceptance:** A clean image build succeeds without undeclared host files; a disposable container can start API/worker, apply migrations and perform a matching-version backup/restore. This audit did not run that image-build acceptance test.

### F07 — campaign metrics misstate dates and outcomes

**Source:** [report aggregate/result mapping](../backend/src/dashboard/dashboard.service.ts#L771).

A report requested for 1–2 January 1900 still returned **4** present-day leads because replacement totals ignored the date predicates. In a campaign with **3 New leads** and no Lost leads, the report labeled all **3** lost using `lost = total - converted`. Conversion elsewhere is inferred from free-text label matches rather than explicit outcome metadata.

**Repair:** Reuse scoped/date-filtered aggregates, compute Lost from an agreed terminal-lost category and model/report outcomes consistently across renamed/custom statuses. State whether dates measure lead creation or actual outcome transitions.

**Acceptance:** An empty date range reports zero; New/Contacted/Interested do not become Lost; custom outcome labels have a documented result; per-user/campaign/overall reports reconcile on fixtures covering all outcomes.

### F08 — saved Process Sutra configuration does not drive Follow-ups

**Source:** [server-backed settings save](../frontend/src/pages/settings/SettingsPage.tsx#L205), [legacy browser read](../frontend/src/pages/dashboard/FollowupDashboardPage.tsx#L54), [integration controller](../backend/src/integrations/integrations.controller.ts#L22).

Settings saves the key/system name in encrypted server settings, while Follow-ups decides action availability and sends credentials from `localStorage.processSutraSettings`. A fresh authenticated administrator browser had a saved server system but **zero Start Process Sutra Flow buttons** and no legacy browser value.

**Repair:** Resolve provider configuration on the backend, expose an appropriate configured/capability indicator and have the action send business identifiers/data rather than a browser-stored key. Align action visibility with its administrator-only API or an explicit approved sales policy.

**Acceptance:** Saving current Settings enables the intended action in a new browser; no legacy storage is needed; authorization is consistent and a mocked start produces a recorded usable result.

### F09 — IndiaMART Auto-fetch is a saved flag only

**Source:** [settings flag](../frontend/src/pages/settings/SettingsPage.tsx#L205), [job declarations](../backend/src/jobs/job.types.ts), [registered processors](../backend/src/jobs/job-processors.service.ts).

The UI persists `indiamartAutoFetch`, but no backend code reads that setting to install a timer or pg-boss schedule. Fetch/import handlers run only when explicitly invoked/enqueued. The presence of queue names does not implement unattended polling.

**Repair:** Implement a supervised durable schedule with provider interval/rate-limit/checkpoint behavior, or remove/rename the misleading control until that feature exists.

**Acceptance:** Enabling/disabling has observable, restart-safe scheduling behavior and does not require an open browser or manual Fetch action; duplicate/partial responses reconcile correctly.

### F10 — generic fractional pagination becomes a server error

**Source:** [generic pagination DTO](../backend/src/common/pagination.dto.ts), [lead list](../backend/src/leads/leads.service.ts#L26).

`IsNumber` accepts a fractional limit; PostgreSQL then rejects the resulting LIMIT/OFFSET value. The authenticated request `/leads/campaign/:id?limit=1.5` returned **500**, rather than input-validation **400**. Specialized WhatsApp/IVR DTOs already validate integers more strictly.

**Repair:** Use integer/range-safe validation for page/limit/offset and calculate bounded safe offsets consistently. Review unvalidated identifier/date inputs in related list APIs.

**Acceptance:** Fractions, invalid strings, negative values and unsafe offsets return 400 before SQL execution; valid integer pagination still traverses all rows.

### F11 — campaign creation can leave incomplete setup

**Source:** [campaign creation](../backend/src/campaigns/campaigns.service.ts#L13).

Campaign insertion and default-status insertion are separate writes. An injected default-status write failure left **one campaign** behind after the create operation failed.

**Repair:** Create the campaign and its required default statuses in one transaction, or implement explicit resumable initialization with a visible state.

**Acceptance:** Failure of any required initial-status write leaves no partially initialized campaign; retry creates one valid campaign with the expected statuses.

### F12 — operational health and failed-job recovery are incomplete

**Source:** [queue-stat error handling](../backend/src/jobs/job.service.ts#L103), [administrator health](../backend/src/admin-dashboard.controller.ts#L80), [execution logging](../backend/src/jobs/job-execution.service.ts).

When queue inspection was forced to fail, the health API still returned `healthy`, worker `running`, and zero queue entries. Queue connectivity does not prove a standalone worker heartbeat. Job logs also omit the pg-boss job ID in the execution wrapper; the failed-job APIs list attempts but do not supply a complete administrative retry workflow for exhausted template jobs.

**Repair:** Propagate inspection errors, report API sender registration separately from worker liveness/lag, add a trustworthy heartbeat and retain job identity. Provide a scoped/admin recovery operation that revalidates lead/template state and preserves automation deduplication.

**Acceptance:** A queue outage produces degraded/error status, a stopped worker cannot appear healthy merely because queues exist, and a selected failed job can be retried safely with an observable final outcome.

### F13 — fixed UI history windows hide older data

**Source:** [WhatsApp page](../frontend/src/pages/whatsapp/WhatsAppPage.tsx#L39), [message list](../frontend/src/components/whatsapp/MessageList.tsx), [follow-up history](../backend/src/followups/followups.service.ts#L91).

The WhatsApp page requests the first **200 conversations** and **100 messages** and has no load-more/server-search traversal. Searching the loaded sidebar cannot discover an older conversation outside that window. Lead follow-up history is capped at 100 without exposing pagination to that history view. Data is hidden from these interfaces, not demonstrated deleted from the database.

**Repair:** Add server search and paginated/history traversal with stable ordering/cursors, preserving current ownership scope and correct scroll behavior.

**Acceptance:** The 201st conversation, 101st message and 101st follow-up can be reached through their intended UI without loading every record or losing scope isolation.

### F14 — sample configuration drifts from implementation

**Source:** [environment sample](../backend/.env.example), [bootstrap](../backend/src/main.ts#L15), [database pool](../backend/src/db/database.service.ts#L25), [Compose](../docker-compose.yml), [throttle configuration](../backend/src/app.module.ts).

The sample omits required `APP_ENCRYPTION_KEY`/`ENCRYPTION_SALT`, points to host port 5432 while Compose publishes 5433, names `DATABASE_POOL_MAX` while the code reads `DB_POOL_MAX`, and advertises timeout/throttle/cache values that do not control the current implementation. Literal shell-style variable placeholders are not an explicit tested environment-expansion contract.

**Repair:** Provide a minimal valid sample with correct ports/names/required secrets and distinguish implemented defaults from proposals. Make runtime configuration typed and fail clearly for invalid values. Correct or remove unsupported Redis/performance comments.

**Acceptance:** A fresh installation following the sample plus secure secret entry can migrate, start and authenticate; documented pool/throttle values demonstrably take effect or are clearly fixed constants.

### F15 — capacity risk is not bounded by current UI/deployment claims

**Source:** [dashboard client](../frontend/src/services/dashboard.ts), [inline upload](../frontend/src/pages/forms/public-form/components/fields/FileUploadField.tsx), [public intake](../backend/src/forms/forms.service.ts), [export buffering](../backend/src/data-export/data-export.service.ts#L293), [PM2 limits](../backend/ecosystem.config.cjs).

Follow-ups fetches up to 20,000 lead rows before local filtering/pagination. A form attachment is copied in enquiry/lead JSON. CSV uploads can reach 50 MiB and are parsed synchronously before the 5,000-row check. Export assembles complete row sets and CSV strings before ZIP streaming. Declared process restart thresholds plus PostgreSQL exceed the stated 2 GiB shared-host budget if reached together.

This is a **confirmed design exposure with unmeasured production impact**, not a reproduced production OOM or a quantified throughput limit. The 506-row browser exercise succeeded and is not a production load test.

**Repair:** Measure realistic large-field/history/import/export cases, use server-filtered incremental paging, stream large data paths and plan object storage/retention and process/pool budgets where measurements justify them.

**Acceptance:** Record response-size, latency, heap/RSS, connection and failure/recovery behavior under an agreed target workload on representative hardware; enforce bounds that meet that target.

### F16 — verification is not an enforced repository release gate

**Source:** [backend scripts](../backend/package.json), [frontend scripts](../frontend/package.json), repository workflow inventory.

There are five useful backend suites, but no checked-in `.github` workflow or frontend test command. The audit's browser/probe helpers ran outside the application checkout. Current tests passed while the newly reproduced defects remained, demonstrating specific coverage gaps rather than invalidating those existing tests.

**Repair:** Add focused persistent regressions for the confirmed defects, browser/service contract tests for the key UI flows and a CI build/test/dependency-review pipeline. Preserve underlying exit statuses and migration/tool requirements.

**Acceptance:** A change reintroducing the report leak, transfer race, DND bypass, partial import or fresh-browser configuration bug fails the relevant automated check before release. CI distinguishes unsupported/unrun checks from passed checks.

## Page-by-page assessment

| Page / area | Verification | Assessment and linked findings |
| --- | --- | --- |
| Login/session | Desktop/mobile login; existing auth/account suites | Current role/session checks and admin protections covered; dependency/proxy/config issues remain F05/F14 |
| Public form | Desktop/mobile rendering; existing submission/attachment/template suites | Atomic enquiry/greeting intent covered; inline payload/storage capacity risk F15 |
| Dashboard | Both roles/widths; direct report probes | F01/F07 confirmed despite route rendering successfully |
| Campaign list/wizard | Admin rendering; user redirect; setup failure injection | Default-status creation can leave a partial campaign F11 |
| Campaign detail — Leads | Rendering, both-page retrieval of 506 rows | Current campaign lead helper traversed pages correctly; transfer race F02; generic invalid pagination F10 |
| Campaign detail — Forms/builder | Source/API suite review and focused tab checks | Publication/parent-resource/submission paths covered by existing tests; JSON/storage limits apply |
| Campaign detail — Team Members | Source/allocation suite review and focused tab checks | Active USER eligibility and locked round-robin covered; IndiaMART does not share this assignment path F04 |
| Campaign detail — Settings | Source/status-template suite review and focused tab checks | Configured status-template path covered; report label semantics need F07 |
| Follow-ups / lead dialog | Both roles/widths; status/transfer probes; Process Sutra fresh-browser probe | F02/F08/F13/F15; template sends and direct session sends have differing DND handling F03 |
| DND | Scoped rendering and existing scope tests | DND list works; downstream send enforcement is inconsistent F03 |
| Users | Admin rendering, user redirect and 15 account tests | No new demonstrated last-admin/session-revocation defect |
| Backups | Admin rendering, user redirect and 18 backup tests | Database recovery tested in isolated environment; live scheduling/offsite/key/logo recovery not verified; F06/F14/F16 |
| Data Management | Admin rendering, user redirect and existing export/deletion tests | CSV formula handling/maintenance coordination covered; export buffering F15 |
| Settings — Profile | Source/browser tab review | Global branding and raster-logo validation present; logos need independent filesystem recovery |
| Settings — API & Webhook | Source/browser review and importer/Process Sutra probes | F04/F08/F09 |
| Settings — Communication | Template/webhook suites, diagnostic panel source and prior same-baseline flow checks | API sender registration and provider errors are exposed; DND/manual path F03, health/recovery F12 |
| Settings — IVR Incoming | 21 IVR tests and browser tab review | Tokens, deduplication, sales/operator separation and worker recovery covered; actual provider/VPS still unverified |
| WhatsApp inbox/chat | Both roles/widths, media/webhook/access suites and DND send probe | Owned-lead access covered; F03 direct-session policy and F13 fixed history windows remain |

## Recommended repair sequence

1. **Authorization and intake correctness:** F01–F04. Add failing regressions, repair transaction/policy boundaries and verify all related APIs/queue paths.
2. **Dependency/deployment baseline:** F05/F06/F14. Triage the Critical registry advisory, update compatible packages, make the documented runtime reproducible and validate actual VPS versions/proxy configuration.
3. **Business behavior and operations:** F07–F13. Reconcile reports, settings/scheduling, list validation, atomic initialization and health/retry/history workflows.
4. **Release and capacity confidence:** F15/F16. Commit meaningful regressions/CI and perform representative load/recovery verification.

Do not infer live delivery from credit balance, a successful submission, a published outbox row or an accepted provider message ID alone. The existing delivery panel and callbacks provide parts of that chain; the live VPS still needs deployment-specific verification.

## Evidence and reproducibility notes

[Audit evidence](AUDIT_EVIDENCE.json) contains sanitized versions/results. It excludes credentials, browser authentication state, real customer data and database connection strings. Runtime probes used the compiled baseline with provider calls mocked and fixtures confined to an isolated database.

P06 used an intentional pause after the original status/campaign check to force a real service transfer before the original update committed. P05/P11 used temporary triggers in that disposable database to reject the relevant dependent write. P09 used the actual frontend pagination function against the real plain-array lead endpoint and retrieved all 506 rows; no current 500-row campaign-list truncation was reported.

The audit database/processes were temporary. The application code and lockfiles were not changed by this documentation work. The root README and the existing template guide were updated to point to the documents and correct the description of owned-lead direct-session access.
