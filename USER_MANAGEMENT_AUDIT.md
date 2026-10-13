# User management audit

The reported symptom was that the acting admin could not log in after deleting a user or changing a role. The repository exposed several account and authentication defects. The exact cause of an incident in another deployment still depends on its account state and error logs.

## Findings and fixes

| Finding | Previous behavior | Fixed behavior |
| --- | --- | --- |
| Admin lockout | An admin could demote, deactivate, or delete their own account; the final active admin could be removed. | The API and UI protect the acting admin. A transaction lock and an active-admin check prevent concurrent account changes from removing all admins. |
| Stale authorization | Access tokens trusted their saved role and remained usable after deactivation or a password reset. Refresh also reused the old role. | Access checks the current active account and its database session. Role, status, username, and password changes revoke only the affected user's sessions. Refresh reads the current account. |
| Repeated login failures | JWTs for the same account issued within one second were identical. The unique refresh-token hash could then reject login or refresh. | Each token and session has a unique ID. Immediate login, refresh, logout, and re-login work without a delay. |
| Registration replaced admin login | The admin-only registration endpoint set cookies belonging to the newly created account. | Registration creates the account and preserves the acting admin's cookies. |
| Partial deletion | Permanent deletion first hid assigned leads, then could fail because leads or campaigns still referenced the user. | The operation is transactional. Assigned leads and managed campaigns must be reassigned before deletion; a rejected deletion leaves records unchanged. Deactivation remains available. |
| Password-change failures revoked access | The controller revoked access before checking the existing password. | Validation occurs before any session revocation. Successful password changes revoke all sessions for that account atomically. |
| Generic update accepted passwords | The DTO accepted a password that the service silently ignored; null access fields could reach the database. | Password updates use the dedicated endpoint. Invalid update fields are rejected. |

## Validation

- Both backend and frontend production builds passed.
- All 15 PostgreSQL regression tests passed, including concurrent admin changes, concurrent refresh, and rollback when session revocation fails.
- All 14 application smoke checks passed.
- Chromium verified role changes, deactivation/reactivation, permanent deletion, self-protection, registration, and subsequent admin login through the running application.
- Disposable test databases and browser-created accounts were removed.

Run the regression suite with `npm test` in `backend`; see [test instructions](backend/test/README.md).

## Applying the change

No database migration is required; the existing refresh-session table supplies session IDs and revocation state. Existing browser sessions can upgrade through refresh. Clients holding only legacy bearer tokens must sign in again to obtain the new token format.

The changes are verified locally and have not been deployed. They prevent new lockouts but do not reactivate an account already disabled or demoted, or restore an account already deleted. Account recovery requires inspecting the affected deployment's records.
