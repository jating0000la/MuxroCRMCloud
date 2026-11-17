Run `npm test` from `backend` with `TEST_DATABASE_URL` (or `DATABASE_URL`) pointing to a development PostgreSQL server whose role can create databases. Each run creates and drops its own uniquely named database; it does not change the configured database.

The regression suite exercises admin lockout prevention, acting-admin session preservation, user role/status changes, password resets, deletion with CRM references, unique tokens, atomic refresh rotation, legacy-session migration, concurrent admin changes, input validation, and rollback if session revocation fails.
