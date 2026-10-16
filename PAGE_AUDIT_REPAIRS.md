# Page audit repairs

Repair date: 16 October 2026. Branch: `work`, based on merge `405538c`.

The 21 reproduced findings in [the original audit](PAGE_BY_PAGE_AUDIT.md) have corresponding repairs below. The original report remains historical evidence of the pre-repair behavior.

| Finding | Repair |
| --- | --- |
| F01 | Raw form submissions require an administrator. |
| F02 | Notification reads enforce current ownership, DND and deletion rules; transfers and round-robin assignment clear old notifications; synchronization rebuilds visible reminders. |
| F03 | ZIP export uses the archiver 8 API and returns the stream before finalization, with disconnect/error handling. |
| F04 | Mobile WhatsApp switches between conversation list and conversation; composer controls fit the viewport. |
| F05 | Daily trends honor an explicit start date. |
| F06 | “Create campaign only” actually persists the campaign and reports failures. |
| F07 | Background lead refresh preserves the selected status filter. |
| F08 | Settings save failures propagate to the page; optional empty values can be persisted. |
| F09 | Public form JSON allows 8 MiB total with 4 MiB per file; client checks total size and server verifies attachment encoding and size. |
| F10 | Dashboard lead actions link to `/followups`. |
| F11 | Follow-up campaign and cursor parameters validate together with pagination. |
| F12 | Boolean fields reject JSON strings instead of converting `"false"` to true. |
| F13 | Contact Info displays actual linked CRM data and opens the lead dialog. |
| F14 | Submission pagination returns stable pages and metadata. |
| F15 | Form lists include real submission counts. |
| F16 | Public intake rejects inactive campaigns and unpublished forms, rechecking inside the submission transaction. |
| F17 | Bulk deletion requires `DELETE ALL`, clears WhatsApp data, shares the backup/restore exclusion lock, and counts deleted rows without returning all records. |
| F18 | User layout loads authenticated branding through a restricted endpoint rather than admin settings. |
| F19 | Logo chooser and help text match permitted PNG/JPEG/WebP formats and 2 MB size. |
| F20 | Invalid, impossible, reversed and excessively long trend date ranges return validation errors. |
| F21 | Every nested form operation verifies the campaign in its URL. |

A regression run also exposed a worker readiness/shutdown race. Shutdown handlers now register before readiness is announced.

## Validation

- Backend regression suite: **66 passed, 0 failed**, including 12 new repair scenarios against isolated PostgreSQL databases.
- Backend and frontend production builds pass.
- Real browser route sweep: admin and user dashboard, campaigns, campaign details, follow-ups, DND, users, backups, data management, settings and WhatsApp; anonymous public form. No browser exceptions or failed API requests. Unauthorized admin routes redirect users to their dashboard.
- Focused browser checks passed for campaign creation, 390 px mobile WhatsApp composer, real CRM contact details/open lead, filter persistence after polling, user branding, settings persistence/error handling and logo format selection. [Sanitized results](audits/2026-10-16/page-repair-evidence.json).
- HTTP ZIP regression checks all six CSV entries, decompression, sizes and CRCs using an archive larger than the stream buffer.
- Destructive deletion and restore checks use disposable databases, preserving development data.

## API changes and limits

Form submission responses now return `{ data, pagination }` and require ADMIN access. The frontend service reflects this contract. Bulk deletion requires JSON `{ "confirmation": "DELETE ALL" }`. Branding requires authentication and exposes only company/application names and logos. No database migration is needed.

External IndiaMART, ProcessSutra and outbound WhatsApp provider delivery were not exercised with real credentials or messages. These repairs do not establish production-scale load behavior or resolve every speculative concern in the original pasted source review.
