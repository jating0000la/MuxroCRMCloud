# CRM Audit Checklist

Audit date: 2026-07-06

## Completed in this pass

- Shared API client: added a 30-second timeout, session/local token lookup, and safer 401 cleanup.
- Login page: made `Remember me` control persistent login storage, added visible form errors, and hid demo credential buttons outside development builds.
- Dashboard: removed duplicate first-load analytics requests and now shows all-campaign funnel/conversion data by default.
- CSV exports: added a reusable CSV downloader that escapes commas, quotes, and newlines; wired it into DND, follow-ups, and the leads dashboard.
- DND page: added per-row pending state for DND removal and fixed manager scoping on the backend.
- Follow-ups page: refreshes loading state when campaign data changes.
- Campaign wizard: validates form field labels, duplicate field names, and dropdown options before creating forms.
- Campaign detail: removed mixed dynamic/static user-service import, switched user assignment to controlled React state, and made backend assignment replace the active team instead of only appending.
- Public forms: return proper HTTP errors when disabled and validate required fields, email, phone, number, options, and rating/scale ranges on the backend.
- Admin users: fixed reactivation by allowing `isActive` updates, added username conflict checks, pending states, retry UI, and deactivation confirmation.
- Backend bootstrap: enabled reverse-proxy trust and shutdown hooks for VPS/Nginx deployments.

## Page-by-page remaining work

### Login

- Add backend account lockout or stricter auth throttling for repeated failed login attempts.
- Consider short access-token lifetime plus refresh tokens before production with many users.

### Dashboard

- Add backend `limit` support for recent follow-ups instead of loading the full follow-up table just to show five rows.
- Replace user-conversion N+1 counts with aggregate/grouped queries.
- Add a visible analytics retry state if funnel/conversion loading fails.

### Campaigns

- Make campaign creation transactional or draft-based so a failed form/user step does not leave half-configured campaigns.
- Add server-side pagination/search as campaign count grows.

### Campaign Detail

- Add server-side pagination/search for campaign leads.
- Add validation and storage for form automation settings if WhatsApp/email config should be part of form setup.
- Add row-level pending state for form deletes and status deletes.

### Follow-ups

- Move search, source, DND, campaign, and sort filters server-side.
- Move Process Sutra secrets off browser `localStorage` and store them server-side.
- Normalize phone numbers instead of hard-coding country code `91`.

### DND

- Add server-side pagination/search/export for large DND lists.
- Add backend reporting for DND removal history.

### Admin Users

- Add server-side pagination/search and ordering.
- Prevent admins from deactivating their own active session unless another admin exists.

### Settings

- Replace browser-local settings with server-side persisted settings.
- Encrypt integration secrets at rest and expose only masked values to the frontend.
- Move integration calls so API keys never need to be sent from the browser.

### Public Forms

- Add file upload storage if file fields are required; the current UI records file names only.
- Add optional CAPTCHA or stronger public-submit throttling for high-spam environments.

## VPS and 500+ user readiness

- Add pagination and database indexes to every high-volume list before importing large lead volumes.
- Add monitoring for API latency, error rate, DB connections, and container restarts.
- Run `npm audit` remediation carefully; current backend install reports vulnerabilities, including high severity packages.
- Keep PostgreSQL, backend, and Nginx on separate resource budgets for production; consider managed Postgres or a tuned VPS database volume for real 500-user traffic.