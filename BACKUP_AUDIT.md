# Backup and restore audit

The backup API, admin page, job processor, and command-line scripts now use the same backup service. Restore tests run against disposable databases; this audit does not restore or deploy to the production VPS.

## Findings addressed

| Finding | Resulting behavior |
| --- | --- |
| Class-level `ADMIN` roles were ignored by the authorization guard. | Every backup endpoint checks the current authenticated administrator role. This also fixes other controllers using class-level role restrictions. |
| `pg_restore` exit code 1 was treated as success even after SQL errors. | Restore SQL and cleanup run in one PostgreSQL transaction with `ON_ERROR_STOP`; SQL failures roll back. A lost response after execution reports an uncertain outcome rather than claiming rollback. |
| Backups buffered the entire archive with a 50 MB limit. | `pg_dump` writes a private file directly; only a validated, complete archive enters the catalog. |
| Restore could resurrect authenticated sessions and queued external actions. | All restored sessions are deleted; pending outbox events are marked consumed, and pg-boss jobs, schedules, and subscriptions are cleared in the restore transaction. Workers must be stopped before restore and restarted afterward. |
| Backup, deletion, and restore could overlap. | A database advisory lock serializes these operations across processes. The API gates new requests and drains existing requests during restore. |
| Identifying processes only by PID could collide across containers. | Database connections carry a random process identifier; restore rejects other workers, API instances, and database clients. |
| Status checks could compete for the operation lock and falsely report busy. | Status reads observe `pg_locks` without acquiring the operation lock. |
| Backup catalog and downloads followed symlinks or exposed scratch files. | Only regular nonempty `.dump` files appear; download opens with `O_NOFOLLOW`. Scratch files remain hidden with mode `0600`. |
| Database URL credentials and connection options were parsed incompletely. | Native tools receive decoded credentials and PostgreSQL connection options through their environment, without credentials in command arguments. |
| Job stats returned the oldest backup job; retention relied on file birth time. | Stats return the newest job. Retention uses the generated backup timestamp, with modification time for imported legacy names. |
| The UI advertised an unconfigured nightly backup schedule. | The page states that automatic execution requires a server schedule and shows server-configured retention and restore availability. |
| UI errors, timeouts, confirmation, and session state differed from backend behavior. | The API requires exact `RESTORE` confirmation; the UI handles JSON blob errors, waits for the full restore workflow, clears local auth after success, and preserves a notice until the next successful login. |
| Shell restore dropped the database and swallowed errors; shell backups used a different format. | Both scripts invoke the shared CLI and propagate failures. Legacy gzip-wrapped custom archives can be imported without changing the source. |
| pg-boss rejected undefined job options and bulk settings were ignored. | Queues are created before use; supplied job options and bulk IDs are handled correctly. |
| Caddy checked a nonexistent health URL. | Health probes use `/api/v1/health`, which remains available during restore. |

## Backend/frontend contract

All routes below are authenticated and administrator-only, under `/api/v1/admin`.

| Request | Response or rule |
| --- | --- |
| `GET /backups` | Array of `{filename, size, created}` sorted newest first; `created` is an ISO timestamp. |
| `GET /backups/status` | `scope: "database"`, `scheduling: "external"`, retention days, busy state, creation/restore availability, and actionable reasons. This is advisory; mutations recheck prerequisites. |
| `POST /backups/trigger` | Optional `{retentionDays}` must be a JSON integer from 1 to 365. Omission uses `BACKUP_RETENTION_DAYS` or 7. Returns `{file, size, duration, warnings?}` after archive publication. |
| `GET /backups/:filename/download` | Binary archive with attachment filename, exact content length, and `Cache-Control: no-store`. |
| `DELETE /backups/:filename` | Returns success only after deletion completes. Shares the operation lock. |
| `POST /backups/:filename/restore` | Requires `{confirmation: "RESTORE"}`. Success returns `{filename, duration, recoveryBackup, requiresLogin: true}` and expires both authentication cookies. |

Invalid input or an invalid/incompatible archive returns `400`; unavailable files return `404`; concurrent operations or unsafe database clients return `409`; unavailable storage/tools and uncertain restore outcomes return `503`. The browser uses the server's error message and a 660-second timeout for backup, download, and restore. A browser/proxy timeout does not prove that the operation failed: inspect the database and catalog before retrying.

## Scope and prerequisites

- Archives cover CRM tables in `public` and Drizzle migration metadata in `drizzle`. They exclude pg-boss runtime state, uploaded files, encryption keys, PostgreSQL roles, and other schemas.
- Preserve uploaded files and server configuration/keys separately. Encrypted integration settings require the same `APP_ENCRYPTION_KEY` and `ENCRYPTION_SALT` used when those records were written.
- Install `pg_dump`, `pg_restore`, and `psql` with the same PostgreSQL major version as the server. The checked-in database compose configuration uses PostgreSQL 15, so that deployment needs PostgreSQL 15 clients. Put their directory on the backend, worker, and CLI `PATH`.
- Configure `DATABASE_URL`, a `BACKUP_DIR` owned by the backend/CLI OS user, and optionally `BACKUP_RETENTION_DAYS` (1–365, default 7). The CLI reads `backend/.env` and the process environment, matching the API. The old scripts' standalone `POSTGRES_*` configuration is replaced by `DATABASE_URL`.
- The database role must be able to dump and restore CRM objects and clear pg-boss runtime tables. Keep sufficient free space for the selected archive, a recovery archive, and uncompressed SQL scratch file.
- A backup is trusted administrative input containing executable database definitions. Import only archives from trusted sources. Archive parsing verifies PostgreSQL format; it does not authenticate their origin.
- Restore requires a snapshot compatible with the deployed CRM schema and containing at least one active administrator. It restores that snapshot's account/password state, then signs out everyone.

## Operation

Build both applications and deploy them together. Restart the backend to activate the authorization and maintenance guards; restart workers to activate process identification and queue handling. Reload Caddy after applying its health-probe change.

From the repository root, create an on-demand backup:

```bash
cd backend
npm ci
npm run build
cd ..
bash scripts/backup.sh 7
```

Automatic backups require an external scheduler. For example, install a daily cron entry using the backend OS user, its configured PostgreSQL client `PATH`, and the repository's absolute path. Schedule creation only; retain/download copies off the VPS independently. No scheduler is silently installed by this change.

List backups or import a trusted archive:

```bash
cd backend
node dist/common/backup/backup.cli.js list
node dist/common/backup/backup.cli.js import /path/to/legacy.sql.gz
```

The import command also accepts native `.dump` and gzip-wrapped `.dump.gz` archives. The old script produced a PostgreSQL custom archive inside `.sql.gz`; plain SQL gzip files are rejected. Imported archives receive a unique `.dump` filename in `BACKUP_DIR` and appear in the admin page.

For a browser restore, stop all workers and other API instances, close database administration tools, and leave only the API serving the restore request. Refresh the backup page, select a backup, and type `RESTORE`. The API rejects other database clients, saves a recovery archive, and gates other requests until completion. After success, sign in with credentials from the snapshot and restart the stopped workers. Restarting workers recreates their queue registrations; externally managed schedules must be reapplied by their owner.

For a CLI restore, stop all API and worker processes, then run:

```bash
bash scripts/restore.sh crm_db_YYYY-MM-DDTHH-mm-ss-mmmZ-unique-id.dump
```

Use the actual filename returned by creation/import. The CLI requires typing `RESTORE`, creates a recovery backup, and uses the same transaction and checks as the browser. It never drops the database or terminates other clients. Restart the API/workers afterward.

Recovery archives appear in the same catalog and can be selected to restore the immediately preceding CRM data. They are subject to normal retention, so download a recovery archive promptly if it needs long-term preservation.

## Validation

Run `npm test` from `backend` with `TEST_DATABASE_URL` or `DATABASE_URL` pointing to a development PostgreSQL instance with `CREATE DATABASE` permission and matching native client tools on `PATH`. Both test files create unique disposable databases and remove only their own fixtures; they never restore the configured database.

The 18 backup tests cover all endpoint permissions, invalid input/confirmation, native archives and byte-exact downloads, private files/path handling, retention/stats, operation locks, interrupted dumps, worker conflicts, corrupt archives, full restore and recovery round trips, session/job/outbox cleanup, SQL rollback, missing admins, uncertain post-commit results, legacy import, schema mismatch, an archive exceeding 50 MB, maintenance health, and tool prerequisites. The existing 15 user-management regression tests also run.

Browser verification uses an isolated backend/database and Chromium to exercise real creation, download, restore, sign-out, re-login, and deletion. It additionally checks server error rendering, busy-state refresh, and persistent restore notices. Live VPS deployment and recovery are separate operations and were not executed during this audit.

The compiled CLI was also verified in a separate disposable database: creation from another working directory, shared catalog, correct/incorrect/EOF confirmation, native restore, recovery archive creation, and nonzero failure exit codes. Backend and frontend production builds pass. The combined PostgreSQL suite passes all 33 tests; Chromium passes eight workflow checks without browser errors.
