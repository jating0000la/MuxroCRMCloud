# MuxroCRM Cloud — Architecture Document

> **Generated:** 2026-07-28  
> **Stack:** NestJS (Backend) + React/Vite (Frontend) + PostgreSQL  
> **Domain:** muxrocrm.cloud  
> **Deployment:** PM2 on single VPS, Docker for PostgreSQL only, Caddy reverse proxy

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Deployment Architecture](#3-deployment-architecture)
4. [Backend Architecture (NestJS)](#4-backend-architecture-nestjs)
   - 4.1 Module Map
   - 4.2 API Layer
   - 4.3 Auth & Security
   - 4.4 Database Layer
   - 4.5 Background Jobs
   - 4.6 Integrations
   - 4.7 Common / Shared Modules
5. [Frontend Architecture (React)](#5-frontend-architecture-react)
   - 5.1 Application Shell
   - 5.2 Routing & Code Splitting
   - 5.3 State Management
   - 5.4 API Layer
   - 5.5 Key Pages
6. [Database Schema](#6-database-schema)
7. [Data Flow](#7-data-flow)
8. [Security Model](#8-security-model)
9. [Performance Considerations](#9-performance-considerations)

---

## 1. System Overview

MuxroCRM Cloud is a **lead management CRM** with:

- **Campaign management** — organize leads into campaigns with custom status pipelines
- **Lead tracking** — capture, assign (round-robin), and track leads through sales stages
- **Follow-up system** — scheduled follow-ups with notifications and WhatsApp integration
- **Public forms** — embeddable web forms that auto-create leads on submission
- **WhatsApp messaging** — two-way WhatsApp communication via Gupshup API
- **Integrations** — IndiaMART lead import, Process Sutra workflow automation
- **DND management** — Do-Not-Disturb lead filtering
- **Dashboard & Analytics** — stats, sales funnel, user-wise conversion, KPIs
- **Admin tools** — user management, settings (encrypted), backups, data import/export

---

## 2. Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Backend Framework** | NestJS 11 | Modular, decorator-driven |
| **Runtime** | Node.js (TypeScript) | Heap limited to 1.5GB via PM2 |
| **ORM** | Drizzle ORM 0.45 | Type-safe SQL for PostgreSQL |
| **Database** | PostgreSQL 15 (Alpine) | Docker container, port 5433 |
| **Job Queue** | pg-boss 12 | PostgreSQL-based job queue |
| **Auth** | Passport.js + JWT | Access + Refresh token pattern |
| **API Docs** | Swagger (NestJS/Swagger) | `/api/docs` when enabled |
| **Validation** | class-validator + class-transformer | Global ValidationPipe |
| **Encryption** | AES-256-GCM (Node crypto) | For stored API keys/secrets |
| **Frontend** | React 18 + Vite 8 | TypeScript |
| **UI** | Tailwind CSS 3 | Dark mode support |
| **Charts** | Recharts | Dashboard visualizations |
| **Animations** | Framer Motion | UI transitions |
| **Icons** | Lucide React | Icon library |
| **Notifications** | react-hot-toast | In-app toasts |
| **Reverse Proxy** | Caddy 2 | Auto TLS, request body 50MB |
| **Process Manager** | PM2 | Runs backend + frontend |
| **Container** | Docker | PostgreSQL only |

---

## 3. Deployment Architecture

```
Internet
    │
    ▼
  Caddy (Port 443/80) ─── Auto TLS via Let's Encrypt
    │
    ├── /api/* ──────────────────► localhost:3000 (NestJS Backend via PM2)
    │                                │
    │                                └── PostgreSQL (127.0.0.1:5433, Docker)
    │
    └── /* (Frontend SPA) ────────► localhost:8080 (Built React app via `serve` via PM2)
```

**Key deployment characteristics:**
- **Single VPS** shared with "ProcessSutra" — resource capped at 2GB RAM, 1 CPU core
- **Docker runs only PostgreSQL** — backend & frontend run natively via PM2
- **PM2 Ecosystem** (`ecosystem.config.cjs`): 1 backend instance (fork mode), heap limited to 1.5GB, auto-restart on crash/memory threshold
- **Caddy** handles TLS termination, request body limit (50MB for CSV imports), security headers, and URL rewriting
- **No clustering** — single instance due to CPU core limit

---

## 4. Backend Architecture (NestJS)

### 4.1 Module Map

```
src/
├── app.module.ts                  # Root module — imports all feature modules
├── main.ts                        # Entry point — NestFactory bootstrap (API server)
├── worker.ts                      # Worker entry point — standalone NestJS app context for bg jobs
│
├── db/                            # Database Layer
│   ├── database.module.ts         #   Global DB module (Pool + Drizzle instance)
│   ├── database.service.ts        #   PG Pool management, drizzle() instantiation
│   ├── database-monitoring.service.ts #   pg_stat_statements monitoring
│   ├── schema.ts                  #   All table definitions (Drizzle ORM)
│   └── seed.ts                    #   Seeder (admin + user1 accounts)
│
├── auth/                          # Authentication & Authorization
│   ├── auth.module.ts
│   ├── auth.controller.ts         #   /api/v1/auth/* endpoints
│   ├── auth.service.ts            #   Login, register, refresh, validate logic
│   ├── strategies/
│   │   └── jwt.strategy.ts        #   Passport JWT strategy w/ in-memory blacklist
│   ├── guards/
│   │   ├── jwt-auth.guard.ts      #   JWT validation guard
│   │   └── roles.guard.ts         #   Role-based access (ADMIN/USER)
│   ├── decorators/                #   @Roles(), @Public(), @CurrentUser()
│   ├── dto/                       #   LoginDto, RegisterDto
│   └── services/
│       ├── token-blacklist.service.ts  # In-memory + DB refresh token revocation
│       └── refresh-session.service.ts  # DB-backed refresh session management
│
├── campaigns/                     # Campaign Management
│   ├── campaigns.module.ts
│   ├── campaigns.controller.ts    #   CRUD + user assignment
│   ├── campaigns.service.ts       #   Business logic, default statuses on create
│   ├── campaign-statuses.controller.ts
│   ├── campaign-statuses.service.ts
│   └── dto/
│
├── leads/                         # Lead Management
│   ├── leads.module.ts
│   ├── leads.controller.ts        #   CRUD, status updates, round-robin allocation
│   ├── leads.service.ts           #   Business logic, auto-followup on create
│   ├── transfer.utils.ts
│   └── dto/
│
├── forms/                         # Public & Admin Forms
│   ├── forms.module.ts
│   ├── forms.controller.ts        #   Admin CRUD (nested under campaigns)
│   ├── public-forms.controller.ts #   Public endpoints (no auth) — get by slug, submit
│   ├── forms.service.ts           #   Form CRUD, public submission → lead creation
│   └── dto/
│
├── followups/                     # Follow-Up Management
│   ├── followups.module.ts
│   ├── followups.controller.ts    #   CRUD, cross-campaign search, keyset pagination
│   ├── followups.service.ts
│   └── dto/
│
├── notifications/                 # In-App Notifications
│   ├── notifications.module.ts
│   ├── notifications.controller.ts
│   └── notifications.service.ts   #   Sync, cleanup, poll-based
│
├── dashboard/                     # Dashboard & Analytics
│   ├── dashboard.module.ts
│   ├── dashboard.controller.ts    #   Overview, campaign stats, sales funnel, conversion, KPI
│   └── dashboard.service.ts
│
├── users/                         # User Management (Admin)
│   ├── users.module.ts
│   ├── users.controller.ts        #   CRUD, password reset, permanent delete
│   └── users.service.ts
│
├── settings/                      # Encrypted Settings Store
│   ├── settings.module.ts
│   ├── settings.controller.ts     #   CRUD, logo upload, audit log, connection test
│   ├── settings.service.ts
│   ├── encryption.service.ts      #   AES-256-GCM encrypt/decrypt
│   └── dto/
│
├── whatsapp/                      # WhatsApp Messaging
│   ├── whatsapp.module.ts
│   ├── whatsapp.controller.ts     #   Send messages, manage contacts
│   ├── whatsapp-webhook.controller.ts  # Meta/Guphsup webhooks for inbound
│   └── whatsapp.service.ts        #   Message sending, status tracking, contact management
│
├── integrations/                  # Third-Party Integrations
│   ├── integrations.module.ts
│   ├── integrations.controller.ts #   Process Sutra, IndiaMART endpoints
│   ├── gupshup.controller.ts      #   Gupshup WhatsApp API (send, templates, test)
│   ├── gupshup-webhook.controller.ts  # Gupshup inbound + status webhooks
│   ├── gupshup.service.ts         #   Gupshup HTTP client (session + template messages)
│   ├── indiamart.service.ts       #   IndiaMART Pull API v2 client
│   ├── process-sutra.service.ts   #   ProcessSutra flow trigger client
│   └── dto/
│
├── bulk-import/                   # Bulk Data Import
│   ├── bulk-import.module.ts
│   ├── bulk-import.controller.ts
│   ├── bulk-import.service.ts     #   CSV/JSON parsing, lead creation in batches
│   └── types/
│
├── data-export/                   # Data Export
│   ├── data-export.module.ts
│   ├── data-export.controller.ts
│   └── data-export.service.ts     #   CSV/JSON export
│
├── jobs/                          # Background Job Infrastructure
│   ├── job.module.ts              #   Global module
│   ├── job.service.ts             #   pg-boss wrapper (addJob, work, stats)
│   ├── job-processors.service.ts  #   Registers all job handlers with logging
│   └── job.types.ts               #   Job type constants + payload interfaces
│
├── common/                        # Shared Infrastructure
│   ├── common.module.ts           #   RoundRobinModule
│   ├── pagination.dto.ts          #   Shared pagination DTO
│   ├── pagination.ts              #   Pagination helper
│   ├── validation.ts
│   ├── authorization/
│   │   ├── authorization.module.ts    # Global module
│   │   ├── authorization.service.ts   # ensureCampaignAccess()
│   │   └── resource.guard.ts          # Resource-level guard
│   ├── backup/
│   │   ├── backup.module.ts           # Global module
│   │   └── backup.service.ts          # pg_dump wrapper, retention management
│   ├── outbox/
│   │   ├── outbox.module.ts           # Global module
│   │   └── outbox.service.ts          # Transactional outbox pattern
│   ├── services/
│   │   └── round-robin.service.ts     # Round-robin lead assignment
│   ├── logging/
│   │   └── structured-logging.middleware.ts
│   └── decorators/
│       └── strict-throttle.decorator.ts
│
├── health.controller.ts          # Public health check endpoints
├── admin-dashboard.controller.ts # Admin system health, stats, DB info
└── logo.controller.ts            # Public logo file serving
```

### 4.2 API Layer

- **Global prefix:** `/api`
- **Versioning:** URI-based, default `v1` → `/api/v1/*`
- **Validation:** Global `ValidationPipe` with whitelist + transform + forbidNonWhitelisted
- **Rate limiting:** `@nestjs/throttler` — 100 requests per 60s, 5s block
- **Swagger:** Enabled via `SWAGGER_ENABLED=true` env var at `/api/docs`
- **CORS:** Configurable via `CORS_ORIGIN` env var (default `http://localhost:5173`)
- **Security:** Helmet middleware, cookie-parser, `trust proxy` enabled

**API endpoint groups:**

| Group | Prefix | Auth | Description |
|-------|--------|------|-------------|
| Auth | `/api/v1/auth` | Mixed | Login (public), register (admin), refresh, logout, profile, change-password |
| Users | `/api/v1/users` | Admin | Full CRUD, password reset, permanent delete |
| Campaigns | `/api/v1/campaigns` | Auth+Role | CRUD, user assignment, status management |
| Leads | `/api/v1/leads` | Auth+Role | CRUD, status updates, round-robin allocation, DND |
| Forms | `/api/v1/campaigns/:id/forms` | Auth+Role | Admin form CRUD |
| Public Forms | `/api/forms/public` | Public | Get form by slug, submit form (rate-limited) |
| Followups | `/api/v1/followups` | Auth+Role | CRUD, cross-campaign search, keyset pagination |
| Notifications | `/api/v1/notifications` | Auth+Role | CRUD, mark read, sync |
| Dashboard | `/api/v1/dashboard` | Auth+Role | Overview, campaign stats, funnel, conversion, KPI |
| Settings | `/api/v1/settings` | Admin | CRUD, logo upload, audit log, test connections |
| WhatsApp | `/api/v1/whatsapp/*` | Auth+Role | Send messages, manage contacts, templates |
| Integrations | `/api/v1/integrations/*` | Admin | IndiaMART fetch/import, Process Sutra, Gupshup |
| Bulk Import | `/api/v1/bulk-import` | Admin | CSV/JSON upload, validation, job dispatch |
| Data Export | `/api/v1/data-export` | Auth+Role | CSV/JSON export of leads |
| Health | `/api/health` | Public (basic), Admin (detailed) | Liveness check |
| Admin | `/api/v1/admin` | Admin | System health, job stats, DB info |
| Logo | `/api/v1/logo/:filename` | Public | Static file serving |

### 4.3 Auth & Security

**Authentication Flow:**
1. **Login:** POST `/api/v1/auth/login` → validates credentials → issues JWT access token (short-lived, default 15m) + refresh token (long-lived, default 7d)
2. **Cookies:** Both tokens set as `httpOnly`, `secure` (production), `sameSite: lax` cookies
3. **Refresh:** POST `/api/v1/auth/refresh` → cookie-based refresh token rotation (old revoked, new issued)
4. **Logout:** Revokes both access (in-memory blacklist) and refresh (DB) tokens

**Token Security:**
- Access tokens: JWT signed with `JWT_SECRET`, short TTL
- Refresh tokens: Stored hashed in `RefreshSession` table with expiry and revocation support
- Token rotation: Old refresh token revoked only AFTER new one is persisted (atomic rotation)
- In-memory blacklist via `revokeAccessToken()` global map (module-scoped)

**Authorization:**
- **Roles:** `ADMIN` and `USER`
- **Guards:** `JwtAuthGuard` (validates JWT) + `RolesGuard` (checks role)
- **Resource-level:** `AuthorizationService.ensureCampaignAccess()` — verifies USER is assigned to campaign
- **Public decorator:** `@Public()` bypasses JWT auth for webhook endpoints
- **Password hashing:** bcryptjs with salt rounds = 10

**Rate Limiting:**
- Global: 100 req/60s window with 5s block
- Login: Strict throttle via `@StrictThrottle()` decorator
- Public form submission: 10 req/60s via `@Throttle()`

### 4.4 Database Layer

**ORM:** Drizzle ORM with `node-postgres` driver

**Connection:**
- `DatabaseService` manages a `pg.Pool` (max 5 connections, 30s idle timeout)
- `statement_timeout=30000` applied to all connections
- On-module-init connection test + health check

**Monitoring:**
- `DatabaseMonitoringService` queries `pg_stat_statements` for slow queries
- Tracks connection counts, database size, and index sizes
- Logs warnings for queries >500ms and connections >15

### 4.5 Background Jobs

**Infrastructure:** pg-boss (PostgreSQL-based job queue)

**Two runtime processes:**
- **`main.ts`** — NestJS HTTP server (handles API requests)
- **`worker.ts`** — Standalone NestJS `ApplicationContext` (no HTTP), registers job processors

**Job Types (from `job.types.ts`):**

| Job Type | Purpose | Handler |
|----------|---------|---------|
| `bulk-import-csv` | Process CSV import | `BulkImportService` |
| `bulk-import-json` | Process JSON import | `BulkImportService` |
| `bulk-allocate` | Round-robin allocation | `RoundRobinService` |
| `whatsapp-send-message` | Send WhatsApp session message | `GupshupService` |
| `whatsapp-send-template` | Send WhatsApp template | `GupshupService` |
| `whatsapp-form-greeting` | Send form greeting via WhatsApp | `GupshupService` |
| `indiamart-fetch` | Fetch IndiaMART leads | `IndiamartService` |
| `indiamart-auto-import` | Auto-import IndiaMART leads | `IndiamartService` |
| `notification-sync` | Sync user notifications | `NotificationsService` |
| `notification-cleanup` | Clean old notifications | `NotificationsService` |
| `scheduled-followup-check` | Check scheduled follow-ups | (defined) |
| `outbox-publish` | Publish pending outbox events | `OutboxService` |
| `backup-database` | Create DB backup | `BackupService` |

**Job Logging:** Each job execution is logged to `JobLog` table with status, payload, result, error tracking, and retry counts.

### 4.6 Integrations

#### Gupshup (WhatsApp Business API)
- **Session messages** — free-form text within 24h window
- **Template messages** — pre-approved templates for out-of-window sends
- **Media messages** — image, video, document, audio
- **Webhooks** — inbound message + delivery status (sent, delivered, read, failed)
- **Auto-followup** — inbound WhatsApp messages auto-create followup entries linked to matching leads
- **Templates sync** — fetch approved templates from Gupshup

#### IndiaMART (B2B Lead Generation)
- **Pull API v2** — fetch leads with date range filtering
- **Auto-import** — deduplicates by `UNIQUE_QUERY_ID`, creates leads + initial followups
- **Batch processing** — processes leads individually with error tolerance
- **Last-fetch tracking** — stores timestamp for incremental pulls

#### Process Sutra (Workflow Automation)
- **REST API** — triggers workflow flows with order data and form fields
- **Configurable** — system name, API key, actor email all configurable

### 4.7 Common / Shared Modules

| Module | Scope | Purpose |
|--------|-------|---------|
| `DatabaseModule` | Global | Single DB pool + Drizzle instance |
| `JobModule` | Global | pg-boss queue manager |
| `OutboxModule` | Global | Transactional outbox pattern for reliable event publishing |
| `BackupModule` | Global | pg_dump-based backup with retention |
| `AuthorizationModule` | Global | Campaign access verification + resource guard |
| `RoundRobinModule` | Shared | Round-robin lead-to-user assignment with advisory locks |
| `LoggingMiddleware` | Global | Structured request logging |

**Transactional Outbox Pattern** (`OutboxService`):
- Events inserted atomically with DB transaction
- `processPendingEvents()` picks up unpublished events, publishes via pg-boss
- Retry tracking with configurable max retries
- Idempotency key support

---

## 5. Frontend Architecture (React)

### 5.1 Application Shell

```
App.tsx
├── ErrorBoundary
├── ThemeProvider (ThemeContext)
├── AuthProvider (AuthContext)
├── NotificationProvider (NotificationContext)
├── BrowserRouter
│   ├── Toaster (react-hot-toast, theme-aware)
│   └── Suspense (code-split lazy loading)
│       └── Routes
│           ├── /login → LoginPage (public)
│           ├── /form/:slug → PublicFormPage (public)
│           ├── /dashboard → DashboardPage (private)
│           ├── /campaigns → CampaignsPage (admin)
│           ├── /campaigns/:id → CampaignDetailPage (admin)
│           ├── /followups → FollowupDashboardPage (private)
│           ├── /dnd → DndPage (private)
│           ├── /admin/users → AdminUsersPage (admin)
│           ├── /admin/backups → BackupsPage (admin)
│           ├── /admin/data-management → DataManagementPage (admin)
│           ├── /settings → SettingsPage (admin)
│           ├── /whatsapp → WhatsAppPage (private)
│           └── * → redirect to /dashboard
```

### 5.2 Routing & Code Splitting

- **`react-router-dom` v6** with lazy-loaded route components
- All page components use `React.lazy()` + `Suspense` with a spinner fallback
- **`PrivateRoute`** — checks `useAuth()` context, redirects to `/login` if unauthenticated
- **`AdminRoute`** — checks for `ADMIN` role, redirects non-admins to `/dashboard`

### 5.3 State Management

No external state library — uses React Context + hooks:

| Context | File | State |
|---------|------|-------|
| `AuthContext` | `context/AuthContext.tsx` | User object, login/logout functions, loading states, remember-me |
| `ThemeContext` | `context/ThemeContext.tsx` | Dark/light mode toggle |
| `NotificationContext` | `context/NotificationContext.tsx` | Notification list, pending count, sound effects, sync/poll logic |

**Auth persistence:** User object saved to `localStorage` (remember-me) or `sessionStorage`, validated on mount via `/api/v1/auth/profile` endpoint.

**Notification polling:** Periodic sync with delay, Web Audio API for alert sounds, known-ID deduplication.

### 5.4 API Layer

**`services/api.ts`** — Axios instance configured with:
- Base URL: `/api/v1` (proxied to backend in dev via Vite)
- Timeout: 30s
- Credentials: `withCredentials: true` (for HttpOnly cookies)
- **Auto-refresh interceptor:** On 401 responses, automatically calls `/auth/refresh` to rotate tokens, queues concurrent requests during refresh, redirects to `/login` on failure
- **429 retry:** Exponential backoff for rate-limited requests (max 3 retries)

**Service files:** Each domain has a dedicated service file in `services/`:

| Service | Endpoints |
|---------|-----------|
| `auth.ts` | login, logout, getProfile, changePassword |
| `campaigns.ts` | CRUD, user assignment, statuses |
| `leads.ts` | CRUD, status update, round-robin, stats, DND |
| `forms.ts` | CRUD, publish, submissions |
| `followups.ts` | CRUD, cross-campaign, upcoming, keyset cursor |
| `dashboard.ts` | overview, campaign-stats, funnel, conversion, KPI |
| `notifications.ts` | CRUD, mark read, sync |
| `settings.ts` | CRUD, logo upload, audit log |
| `users.ts` | CRUD, password reset |
| `whatsapp.ts` | send message, contacts, templates |
| `integrations.ts` | IndiaMART, Process Sutra, Gupshup |
| `bulkImport.ts` | CSV/JSON upload |
| `dataExport.ts` | Export triggers |
| `admin.ts` | System health, job stats |
| `pagination.ts` | Pagination response type |

### 5.5 Key Pages

| Page | Path | Role | Description |
|------|------|------|-------------|
| `LoginPage` | `/login` | Public | Username/password form, remember-me toggle |
| `DashboardPage` | `/dashboard` | All | Overview stats, lead/followup tables, funnel chart, conversion |
| `CampaignsPage` | `/campaigns` | Admin | Campaign list with stats, create/edit |
| `CampaignDetailPage` | `/campaigns/:id` | Admin | Campaign detail, leads, forms, statuses, users |
| `FollowupDashboardPage` | `/followups` | All | Follow-ups with filtering, cross-campaign view |
| `DndPage` | `/dnd` | All | Do-Not-Disturb leads list |
| `AdminUsersPage` | `/admin/users` | Admin | User CRUD, role management, password reset |
| `BackupsPage` | `/admin/backups` | Admin | DB backup management |
| `DataManagementPage` | `/admin/data-management` | Admin | Bulk import, data export |
| `SettingsPage` | `/settings` | Admin | Encrypted settings, logo upload, test connections |
| `WhatsAppPage` | `/whatsapp` | All | WhatsApp chat interface, contacts, templates |
| `PublicFormPage` | `/form/:slug` | Public | Renders published form for public submission |

**Layout component** (`components/layout/Layout.tsx`):
- Role-aware navigation (ADMIN sees campaigns, users; USERS see dashboard, followups, DND, WhatsApp)
- Bottom bar navigation (mobile-first responsive)
- User menu with logout, theme toggle, density toggle
- Notification bell with real-time count
- Branding (logo + app name from settings)
- Top accent gradient bar

---

## 6. Database Schema

**15 tables** defined in `backend/src/db/schema.ts`:

### Core Tables

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `User` | System users (ADMIN/USER) | → CampaignUser, Lead.doerId, Followup.userId |
| `Campaign` | Marketing campaigns | → CampaignUser, CampaignStatus, Lead, Form |
| `CampaignUser` | User-campaign assignments | → User, Campaign (unique constraint on pair) |
| `CampaignStatus` | Custom status pipeline per campaign | → Campaign, Lead.statusId |
| `Lead` | Sales leads | → Campaign, User(doer), CampaignStatus, Form |
| `Followup` | Follow-up activities on leads | → Lead, User |
| `Form` | Public web forms | → Campaign |
| `Enquiry` | Public form submissions | → Form (leads to Lead creation) |

### Infrastructure Tables

| Table | Purpose |
|-------|---------|
| `RefreshSession` | DB-backed JWT refresh token sessions with revocation |
| `Notification` | In-app notifications linked to follow-ups |
| `Setting` | Encrypted key-value settings store |
| `SettingAuditLog` | Audit trail for setting changes |
| `OutboxEvent` | Transactional outbox for reliable async event publishing |
| `JobLog` | Background job execution logs with status/error tracking |
| `WhatsappMessage` | WhatsApp message history (inbound + outbound) |
| `WhatsappContact` | Unified WhatsApp contacts with opt-in tracking |

### Key Indexes

- Extensive composite indexes on `Lead` for common query patterns (campaign+doer, campaign+status, doer+dnd, isDeleted+doer)
- `Followup` indexes for user+date queries (keyset pagination support)
- Unique constraints: `CampaignUser(campaignId, userId)`, `Notification(userId, followupId)`, `Setting(key)`
- Partial index on `Lead(isDeleted, doerId)` WHERE isDeleted = false

---

## 7. Data Flow

### Lead Creation Flow

```
[Manual Entry]    [Bulk Import]    [Public Form]    [IndiaMART]
      │                │                │                │
      ▼                ▼                ▼                ▼
  ┌─────────────────────────────────────────────────────────┐
  │                  LeadsService.create()                   │
  │  1. Validate campaign access                             │
  │  2. Auto-assign doerId via RoundRobinService            │
  │  3. Auto-assign first campaign status                    │
  │  4. Create Lead + initial Followup in DB transaction     │
  └─────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Lead assigned to USER
                    with initial status "New"
```

### Follow-up Flow

```
[USER updates status]    [WhatsApp inbound]    [Scheduled check]
        │                       │                     │
        ▼                       ▼                     ▼
  ┌──────────────────────────────────────────────────────┐
  │              FollowupsService.create()                │
  │  1. Create followup record with status + remarks      │
  │  2. Optionally set nextCallDate for scheduling        │
  │  3. Create Notification for the user                  │
  └──────────────────────────────────────────────────────┘
                              │
                              ▼
                  USER sees notification
                  in header bell + followup
                  dashboard
```

### WhatsApp Message Flow

```
[ADMIN sends via UI]    [Auto-greeting on form submit]
        │                         │
        ▼                         ▼
  ┌──────────────────────────────────────┐
  │   GupshupController.sendMessage()    │
  │    → Resolve API key from settings    │
  │    → Call GupshupService              │
  │    → POST to Gupshup API              │
  │    → Save to WhatsappMessage table     │
  │    → Optionally queue via pg-boss     │
  └──────────────────────────────────────┘
              │                      ▲
              │                      │
              ▼                      │
    [Gupshup Webhook] ───────────────┘
    (delivery status + inbound msgs)
              │
              ▼
    Update message status
    Auto-create Followup for inbound
```

### Transactional Outbox Flow

```
[Any Service] → outboxService.publishEvent()
       │
       ▼
  Insert into OutboxEvent table
       │
       ▼ (via scheduled job)
  outboxService.processPendingEvents()
       │
       ▼
  Add job to pg-boss queue
       │
       ▼ (via worker)
  JobProcessors.handler()
       │
       ▼
  Log result to JobLog table
```

---

## 8. Security Model

| Layer | Measure |
|-------|---------|
| **Transport** | TLS via Caddy (Let's Encrypt auto), HSTS preload |
| **Headers** | X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy via Helmet |
| **Authentication** | JWT access token (15m) + refresh token (7d), HttpOnly cookies |
| **Token Rotation** | Atomic refresh token rotation (new created before old revoked) |
| **Session Revocation** | DB-backed RefreshSession table with expiry + explicit revoke |
| **Password Storage** | bcryptjs (10 salt rounds) |
| **API Keys** | AES-256-GCM encrypted at rest in `Setting` table |
| **Encryption Key** | Derived via scrypt from `APP_ENCRYPTION_KEY` + `ENCRYPTION_SALT` |
| **Rate Limiting** | Global 100 req/min + strict login throttle + form submission throttle |
| **Validation** | Global ValidationPipe (whitelist, forbidNonWhitelisted) |
| **CORS** | Configurable origins, credentials enabled |
| **DB Security** | PostgreSQL bound to 127.0.0.1:5433, connection pooling, statement timeout |
| **Input Sanitization** | class-validator DTOs, Drizzle ORM parameterized queries |
| **File Upload** | Logo upload restricted to image types, stored outside webroot |

---

## 9. Performance Considerations

### Database
- **Connection pool:** Max 5 connections, 30s idle timeout
- **Statement timeout:** 30s on all connections
- **Indexes:** Extensive composite indexes on high-query tables (Lead has 14 indexes)
- **Partial index:** `Lead(isDeleted, doerId)` WHERE isDeleted = false for active lead queries
- **Monitoring:** `pg_stat_statements` slow query tracking with >500ms warning threshold
- **Connection monitoring:** Warning at >15 connections per database

### API
- **Rate limiting:** Prevents abuse at 100 req/min
- **Pagination:** Standard offset pagination + keyset pagination for follow-ups (cursor-based)
- **Validation:** Early rejection via ValidationPipe before business logic

### Frontend
- **Code splitting:** All route components lazy-loaded
- **UI density:** Compact/comfortable mode persisted in localStorage
- **Theme:** Dark/light mode CSS with Tailwind
- **Notification polling:** Debounced sync with known ID deduplication

### Deployment
- **Heap limit:** Node.js capped at 1.5GB (`--max-old-space-size=1536`)
- **Memory restart:** PM2 auto-restart if RSS exceeds 2GB
- **Auto-restart:** Backoff restart delay (200ms base, up to 10 retries)
- **Log rotation:** PM2 log files + Caddy log rotation (50MB, keep 3)
- **Single instance:** Fork mode, 1 instance (1 CPU constraint)

---

*End of Architecture Document*
