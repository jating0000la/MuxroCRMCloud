# System Architecture — MuxroUltimateCRM

## 1. Overview

MuxroUltimateCRM is a self-hosted, full-stack CRM platform for managing sales campaigns, leads, follow-ups, and team assignments. It is deployed as a Dockerized monorepo at `muxrocrm.cloud`.

```
┌──────────────────────────────────────────────────────────────────┐
│                         INTERNET                                  │
│                            │                                      │
│                    ┌───────▼────────┐                             │
│                    │  Caddy (SSL)   │  :80 / :443                 │
│                    │  Reverse Proxy │                             │
│                    └──┬─────────┬───┘                             │
│                       │         │                                 │
│          /api/*       │         │   /*                            │
│        ┌──────────────▼──┐  ┌──▼──────────────┐                  │
│        │  Backend (API)  │  │   Frontend (SPA)│                  │
│        │  NestJS :3000   │  │   React  :80    │                  │
│        └───┬──────┬──────┘  └─────────────────┘                  │
│            │      │                                               │
│  ┌─────────▼──┐ ┌─▼──────────────┐  ┌──────────────────────┐    │
│  │ PostgreSQL  │ │    Worker      │  │    Backup Cron       │    │
│  │    :5432    │ │  (pg-boss)     │  │  (daily 2 AM)        │    │
│  └────────────┘ └────────────────┘  └──────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Technology Stack

| Layer            | Technology                                    |
|------------------|-----------------------------------------------|
| Runtime          | Node.js 20 (Alpine)                          |
| Backend Framework| NestJS 11.x (TypeScript 5.3)                 |
| ORM              | Drizzle ORM 0.45                             |
| Database         | PostgreSQL 15 (Alpine)                       |
| Frontend         | React 18 + TypeScript + Vite 8               |
| Styling          | Tailwind CSS 3.4                             |
| Authentication   | Passport.js + JWT (httpOnly cookies)         |
| Job Queue        | pg-boss 12.x (PostgreSQL-native)             |
| Encryption       | AES-256-GCM (Node crypto, scrypt KDF)       |
| Containerization | Docker + Docker Compose (6 services)         |
| Reverse Proxy    | Caddy (auto Let's Encrypt SSL)               |
| Validation       | class-validator + Zod                         |
| HTTP Client      | Axios                                         |
| Password Hashing | bcryptjs                                     |

## 3. Project Structure

```
MUXROULTIMATECRM/
├── docker-compose.yml          # 6-service stack orchestration
├── Caddyfile                   # Reverse proxy config
├── .env / .env.production      # Environment variables
├── scripts/
│   ├── backup.sh               # pg_dump + gzip
│   └── restore.sh              # pg_restore
├── backend/                    # NestJS API
│   └── src/
│       ├── main.ts             # Bootstrap entry
│       ├── app.module.ts       # Root module
│       ├── worker.ts           # Background worker entry
│       ├── auth/               # Authentication & authorization
│       ├── users/              # User management
│       ├── campaigns/          # Campaign management
│       ├── leads/              # Lead management
│       ├── followups/          # Follow-up tracking
│       ├── forms/              # Form builder + public forms
│       ├── dashboard/          # Analytics endpoints
│       ├── notifications/      # Notification system
│       ├── settings/           # Encrypted settings + audit
│       ├── integrations/       # IndiaMART, Gupshup, Process Sutra
│       ├── bulk-import/        # CSV/JSON import
│       ├── jobs/               # pg-boss job processors
│       ├── common/             # Shared services
│       └── db/                 # Schema, seed, monitoring
└── frontend/                   # React SPA
    └── src/
        ├── App.tsx             # Root with routing
        ├── pages/              # Route-level components
        ├── components/         # Reusable UI components
        ├── services/           # API service layer (13 modules)
        ├── context/            # Auth, Notification, Theme
        ├── types/              # TypeScript types + permissions
        └── utils/              # Helpers
```

## 4. Database Architecture

### 4.1 Entity Relationship Diagram

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│    User      │────<│  CampaignUser    │>────│  Campaign    │
│─────────────│     │─────────────────│     │──────────────│
│ id (UUID)   │     │ campaignId      │     │ id (UUID)    │
│ username    │     │ userId          │     │ name         │
│ password    │     │ isActive        │     │ description  │
│ name        │     │ assignedAt      │     │ managerId    │
│ email       │     └─────────────────┘     │ isActive     │
│ role        │                              └──────┬───────┘
│ isActive    │                                     │
└──────┬──────┘                                     │
       │                                   ┌───────┼────────┐
       │                                   │       │        │
       │                          ┌────────▼┐ ┌────▼───┐ ┌──▼───────┐
       │                          │  Lead    │ │ Status │ │   Form   │
       │                          │──────────│ │────────│ │──────────│
       │                          │ id       │ │ id     │ │ id       │
       │                          │ campaignId│ │campaignId│ │campaignId│
       │                          │ name     │ │ label  │ │ title    │
       │                          │ email    │ │ color  │ │ fields   │
       │                          │ phone    │ │ order  │ │ isPubl.  │
       │                          │ doerId──>│ │whatsappMsg│ │publicSlug│
       │                          │ statusId─│─┘        │ └──────────┘
       │                          │ source   │          │
       │                          │ dnd      │          │
       │                          │ customData│         │
       │                          └────┬─────┘          │
       │                               │                │
       │                          ┌────▼─────┐    ┌─────▼──────┐
       │                          │ Followup  │    │  Enquiry   │
       │                          │───────────│    │────────────│
       │                          │ id        │    │ id         │
       │                          │ leadId    │    │ formId     │
       │                          │ userId    │    │ data (JSON)│
       │                          │ status    │    │ ipAddress  │
       │                          │ remarks   │    │ submittedAt│
       │                          │ nextCallDt│    └────────────┘
       │                          └─────┬─────┘
       │                                │
       │                          ┌─────▼──────┐
       │                          │Notification│
       │                          │────────────│
       │                          │ userId     │
       │                          │ followupId │
       │                          │ type       │
       │                          │ isRead     │
       │                          └────────────┘

┌─────────────┐  ┌────────────────┐  ┌───────────────┐
│   Setting    │  │OutboxEvent     │  │  JobLog       │
│─────────────│  │────────────────│  │───────────────│
│ key         │  │ aggregateType  │  │ jobType       │
│ encryptedVal│  │ aggregateId    │  │ jobId         │
│ isEncrypted │  │ eventType      │  │ status        │
│ lastTestedAt│  │ payload        │  │ payload       │
└──────┬──────┘  │ published      │  │ result        │
       │         │ retryCount     │  │ error         │
       │         └────────────────┘  │idempotencyKey │
       │                             └───────────────┘
┌──────▼──────────┐  ┌────────────────┐
│ SettingAuditLog │  │RefreshSession  │
│─────────────────│  │────────────────│
│ settingId       │  │ userId         │
│ action          │  │ tokenHash      │
│ changedBy       │  │ expiresAt      │
│ oldValue        │  │ revokedAt      │
│ newValue        │  └────────────────┘
│ reason          │
└─────────────────┘
```

### 4.2 Tables Summary

| Table              | Purpose                                           |
|--------------------|---------------------------------------------------|
| User               | System users (ADMIN / USER roles)                 |
| Campaign           | Sales campaigns with manager and statuses         |
| CampaignUser       | Many-to-many: users assigned to campaigns         |
| CampaignStatus     | Custom pipeline statuses per campaign             |
| Form               | Dynamic lead capture forms with JSON field schema |
| Enquiry            | Public form submissions                           |
| Lead               | Sales leads with custom data, source, DND flag    |
| Followup           | Lead follow-up records with scheduling            |
| Notification       | Pending follow-up reminders (overdue/today/upcoming) |
| Setting            | Encrypted key-value settings                      |
| SettingAuditLog    | Audit trail for settings changes                  |
| RefreshSession     | DB-backed JWT token revocation                    |
| OutboxEvent        | Transactional outbox events                       |
| JobLog             | Background job execution tracking                 |

## 5. Authentication & Authorization

### 5.1 Authentication Flow

```
┌────────┐         ┌────────────┐        ┌──────────────┐
│ Client │         │   Backend   │        │  PostgreSQL  │
└───┬────┘         └─────┬──────┘        └──────┬───────┘
    │   POST /auth/login │                      │
    │───────────────────>│  Validate credentials │
    │                    │─────────────────────>│
    │                    │<─────────────────────│
    │                    │  Generate JWT         │
    │                    │  Store token hash     │
    │                    │─────────────────────>│
    │   Set httpOnly     │                      │
    │   cookie           │                      │
    │<───────────────────│                      │
    │                    │                      │
    │   GET /api/*       │                      │
    │   (cookie sent)    │                      │
    │───────────────────>│  Validate JWT         │
    │                    │  Check session hash   │
    │                    │─────────────────────>│
    │                    │<─────────────────────│
    │   Authorized       │                      │
    │<───────────────────│                      │
```

- **JWT**: Signed with `JWT_SECRET`, delivered via `httpOnly` cookie (`auth_token`)
- **Session tracking**: SHA-256 token hashes stored in `RefreshSession` table
- **Token revocation**: On logout (single session) or password change (all sessions)
- **In-memory cache**: 1-minute TTL reduces DB hits per request
- **Password policy**: Min 8 chars, must include uppercase, lowercase, digit

### 5.2 Authorization Model

| Role   | Capabilities                                                        |
|--------|---------------------------------------------------------------------|
| ADMIN  | Full access: CRUD campaigns, leads, forms, users, settings, bulk import, integrations |
| USER   | View assigned leads only, update lead status, view own followups, submit enquiries    |

Resource-level authorization:
- **Campaign access**: ADMIN sees all; USER must be assigned via `CampaignUser`
- **Lead access**: ADMIN sees all; USER sees only assigned leads
- **Lead write**: USER can only modify their own leads
- **User management**: Only ADMIN; admins cannot modify other admin accounts

## 6. API Architecture

All endpoints are prefixed with `/api/v1/` and follow RESTful conventions.

### 6.1 Endpoint Groups

| Group            | Prefix                           | Key Operations                              |
|------------------|----------------------------------|---------------------------------------------|
| Auth             | `/api/v1/auth`                   | Login, logout, register, profile, change-password |
| Users            | `/api/v1/users`                  | CRUD, password reset, permanent delete       |
| Campaigns        | `/api/v1/campaigns`              | CRUD, user assignment, statuses              |
| Leads            | `/api/v1/leads`                  | CRUD, status update, bulk allocate, DND      |
| Follow-ups       | `/api/v1/followups`              | CRUD, cross-campaign search, upcoming        |
| Forms            | `/api/v1/campaigns/:id/forms`    | CRUD, publish/unpublish, submissions         |
| Public Forms     | `/api/v1/forms/public`           | Get form by slug, submit (no auth)           |
| Dashboard        | `/api/v1/dashboard`              | Overview, campaign stats, funnel, conversion |
| Notifications    | `/api/v1/notifications`          | Pending, mark read, sync                     |
| Settings         | `/api/v1/settings`               | CRUD, audit log, test connection             |
| Integrations     | `/api/v1/integrations`           | IndiaMART, Gupshup WhatsApp, Process Sutra   |
| Bulk Import      | `/api/v1/campaigns/:id/bulk-import` | CSV/JSON import                          |
| Health           | `/health`, `/admin/health`       | Basic + detailed health, system overview     |

### 6.2 Rate Limiting

| Scope            | Limit              |
|------------------|--------------------|
| Global           | 100 req/min        |
| Auth endpoints   | Configurable (stricter) |
| Public form submission | 10/min per IP |

### 6.3 Validation

- Request validation via `class-validator` decorators on DTOs
- Schema validation via Zod for complex structures
- Password validation: minimum 8 chars, uppercase, lowercase, digit required

## 7. Background Job System

### 7.1 Architecture

```
┌──────────────────┐      ┌──────────────┐      ┌──────────────────┐
│  API Server      │      │  PostgreSQL   │      │    Worker         │
│  (transactions)  │─────>│  OutboxEvent  │─────>│  (pg-boss)        │
│                  │      │  JobLog       │      │                   │
│  Writes events   │      │  job queue    │      │  Processes jobs   │
│  in same TX      │      │              │      │  Updates JobLog   │
└──────────────────┘      └──────────────┘      └──────────────────┘
```

### 7.2 Job Types

| Job Type             | Description                                    |
|----------------------|------------------------------------------------|
| `whatsapp-message`   | Send WhatsApp session/template messages        |
| `indiamart-fetch`    | Fetch leads from IndiaMART Pull API            |
| `indiamart-import`   | Auto-import IndiaMART leads into campaigns     |
| `bulk-allocation`    | Round-robin distribute leads among users       |
| `notification-sync`  | Generate follow-up reminders                   |
| `outbox-publish`     | Publish pending outbox events                  |
| `database-backup`    | Automated PostgreSQL backup                    |

### 7.3 Transactional Outbox Pattern

Ensures reliable event publishing without distributed transactions:

1. Business data and outbox event written in the **same DB transaction**
2. Worker polls `OutboxEvent` table for unpublished events
3. Events are processed and marked as published
4. Retry logic with configurable max retries and error tracking
5. Automatic cleanup of published events after retention period

## 8. Integration Architecture

### 8.1 IndiaMART

```
┌──────────┐    Pull API v2    ┌──────────────┐
│ IndiaMART│──────────────────>│   Backend     │
│  (CRM)   │                   │               │
└──────────┘                   │  Decrypt keys │
                               │  Parse leads  │
                               │  Dedup by     │
                               │  QUERY_ID     │
                               │  Create leads │
                               └───────────────┘
```

- **Endpoint**: `https://mapi.indiamart.com/wservce/crm/crmListing/v2/`
- Fetch buyer leads with time range
- Auto-import into campaigns with deduplication
- Email body HTML parsing for lead extraction
- Encrypted credential storage (`indiamartCrmKey`, `indiamartApiKey`)

### 8.2 Gupshup WhatsApp

```
┌──────────┐  REST API   ┌──────────────┐   pg-boss   ┌──────────┐
│ Gupshup  │<───────────│   Worker      │<────────────│  Backend  │
│  (WA)    │            │  (async send) │             │  (queue)  │
└──────────┘            └──────────────┘             └──────────┘
```

- **Session messages**: Within 24h conversational window
- **Template messages**: HSM/notification outside 24h window
- **Template sync**: Fetch approved templates from Gupshup
- **Webhook**: Inbound message handling
- **Media support**: Image, video, document attachments

### 8.3 Process Sutra

- Trigger workflow automations via `POST /api/integrations/start-flow`
- Send system name, order data, or form data to initiate flows

## 9. Security Architecture

### 9.1 Encryption at Rest

```
┌─────────────────────────────────────────────┐
│  AES-256-GCM Encryption                     │
│                                             │
│  Input: plaintext (API key, secret)         │
│  Key: scrypt(APP_ENCRYPTION_KEY, salt)      │
│  Output: { iv, authTag, ciphertext }        │
│  Stored in: Setting.encryptedValue          │
└─────────────────────────────────────────────┘
```

- All sensitive settings encrypted with AES-256-GCM
- Key derived via scrypt from `APP_ENCRYPTION_KEY` + `ENCRYPTION_SALT`
- IV (16 bytes) + authTag (16 bytes) + ciphertext stored together
- Settings viewable masked or unmasked (admin only)

### 9.2 Security Layers

| Layer              | Implementation                                     |
|--------------------|----------------------------------------------------|
| Transport          | HTTPS (Caddy auto-SSL via Let's Encrypt)          |
| HTTP Headers       | Helmet.js (HSTS, X-Content-Type, X-Frame-Options) |
| Authentication     | JWT in httpOnly cookie (sameSite: lax)            |
| Password Storage   | bcryptjs (salted hashing)                          |
| Rate Limiting      | @nestjs/throttler (100/min global, stricter auth) |
| Input Validation   | class-validator + Zod                              |
| CORS               | Configurable allowed origins                       |
| CSRF               | httpOnly cookies (not JS-accessible)              |
| Audit Trail        | SettingAuditLog tracks all config changes          |
| Data Isolation     | Role-based + resource-level authorization          |

## 10. Frontend Architecture

### 10.1 Component Hierarchy

```
App.tsx
├── AuthProvider (AuthContext)
│   ├── NotificationProvider (NotificationContext)
│   │   ├── ThemeProvider (ThemeContext)
│   │   │   └── Layout
│   │   │       ├── Header (user menu, notification bell, theme toggle)
│   │   │       ├── <Outlet /> (routed page)
│   │   │       └── BottomNav (mobile navigation)
│   │   │
│   │   ├── LoginPage
│   │   ├── PublicFormPage
│   │   ├── DashboardPage
│   │   ├── CampaignsPage
│   │   ├── CampaignDetailPage
│   │   ├── FollowupDashboardPage
│   │   ├── DndPage
│   │   ├── AdminUsersPage
│   │   └── SettingsPage
```

### 10.2 State Management

| Context            | Scope                  | Persistence          |
|--------------------|------------------------|----------------------|
| AuthContext        | User state, login/logout | JWT: httpOnly cookie; User info: localStorage/sessionStorage |
| NotificationContext | Real-time notifications | Polling every 10s; Browser Notification API; Web Audio alerts |
| ThemeContext       | Dark/light mode         | localStorage; Respects `prefers-color-scheme`                |

### 10.3 Service Layer

13 service modules mirror backend API routes:

| Service         | Responsibility                              |
|-----------------|---------------------------------------------|
| `api.ts`        | Axios instance, `/api/v1` base, 401 redirect |
| `auth.ts`       | Login, logout, register, profile            |
| `campaigns.ts`  | Campaign CRUD, user assignment              |
| `leads.ts`      | Lead CRUD, status updates, bulk allocation  |
| `followups.ts`  | Follow-up CRUD, cross-campaign search       |
| `forms.ts`      | Form CRUD, publish, submissions             |
| `dashboard.ts`  | Stats, funnel, conversion                   |
| `notifications.ts` | Pending, mark read, sync                 |
| `users.ts`      | User management                             |
| `settings.ts`   | Encrypted settings, audit log               |
| `integrations.ts` | IndiaMART, Gupshup, Process Sutra         |
| `bulkImport.ts` | CSV/JSON import                             |
| `statuses.ts`   | Campaign status management                  |

## 11. Deployment Architecture

### 11.1 Docker Compose Stack (6 Services)

| Service        | Build/Image          | Port  | Memory   | Purpose                    |
|----------------|---------------------|-------|----------|----------------------------|
| `postgres`     | postgres:15-alpine   | 5432  | 512MB    | Database                   |
| `backend`      | ./backend/Dockerfile | 3000  | 512MB    | NestJS API                 |
| `worker`       | ./backend/Dockerfile | —     | 384MB    | Background job processor   |
| `backup-cron`  | ./backend/Dockerfile | —     | 128MB    | Daily backup (2 AM)        |
| `frontend`     | ./frontend/Dockerfile| 80    | 128MB    | React SPA (serve)          |
| `caddy`        | caddy:alpine         | 80,443| 128MB    | Reverse proxy + auto-SSL   |

### 11.2 Caddy Routing

```
muxrocrm.cloud/api/*  →  backend:3000
muxrocrm.cloud/*      →  frontend:80
```

### 11.3 Backup Strategy

- **Automated**: Daily `pg_dump` at 2 AM via backup-cron container
- **Format**: Custom PostgreSQL format + gzip compression
- **Retention**: Configurable (default 7 days)
- **Restore**: Interactive script with safety confirmation (drops and recreates DB)
- **Volume**: Shared `backup_data` volume across backend, worker, backup-cron

## 12. Key Design Patterns

| Pattern                    | Application                                              |
|----------------------------|----------------------------------------------------------|
| NestJS Modular Architecture | Self-contained modules per domain (auth, leads, etc.)   |
| Transactional Outbox       | Reliable event publishing without distributed TX         |
| Separate Worker Process    | Background jobs in isolated container                    |
| DB-backed Sessions         | JWT revocation via stored token hashes                   |
| Encrypted Settings         | AES-256-GCM at rest for all secrets                     |
| Resource-level AuthZ       | Fine-grained access beyond role checks                   |
| Soft Deletes               | `isDeleted` flag on leads for data preservation          |
| Advisory Locking           | PostgreSQL locks for concurrent round-robin safety       |
| Structured Logging         | HTTP request/response middleware, JSON format            |
| Connection Pool Monitoring | Real-time PostgreSQL stats and slow query detection      |

## 13. Environment Variables

| Variable                 | Purpose                         | Default              |
|--------------------------|---------------------------------|----------------------|
| `NODE_ENV`               | Environment mode                | `development`        |
| `POSTGRES_USER`          | Database user                   | `postgres`           |
| `POSTGRES_PASSWORD`      | Database password               | `postgres`           |
| `POSTGRES_DB`            | Database name                   | `crm_db`             |
| `JWT_SECRET`             | JWT signing secret              | (dev placeholder)    |
| `JWT_EXPIRATION`         | Token lifetime                  | `15m` (prod)         |
| `APP_ENCRYPTION_KEY`     | AES-256-GCM key                | (dev placeholder)    |
| `ENCRYPTION_SALT`        | Key derivation salt             | (dev placeholder)    |
| `CORS_ORIGIN`            | Allowed origins                 | `localhost:5173`     |
| `SWAGGER_ENABLED`        | Enable API docs                 | `false`              |
| `PUBLIC_FORMS_ENABLED`   | Enable public forms             | `true`               |
| `DOMAIN`                 | Production domain               | `muxrocrm.cloud`     |
| `ACME_EMAIL`             | Let's Encrypt email             | —                    |
| `SEED_ADMIN_PASSWORD`    | Initial admin password          | `admin123`           |
| `SEED_USER_PASSWORD`     | Initial user password           | `user123`            |
| `BACKUP_RETENTION_DAYS`  | Backup cleanup window           | `7`                  |

## 14. Seed Data

On first run, the database is seeded with:

| Username | Password   | Role  |
|----------|------------|-------|
| admin    | admin123   | ADMIN |
| user1    | user123    | USER  |

Passwords are configurable via `SEED_ADMIN_PASSWORD` and `SEED_USER_PASSWORD`.

---

*Generated for MuxroUltimateCRM — Architecture Reference*
