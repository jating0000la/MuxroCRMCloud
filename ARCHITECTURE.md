# MuxroUltimateCRM - System Architecture

## 1. Overview

MuxroUltimateCRM is a full-stack CRM application built with **NestJS** (backend), **React** (frontend), **PostgreSQL** (database), and **Docker** (deployment). It manages leads, campaigns, follow-ups, dynamic forms, and integrates with IndiaMART, Process Sutra, and Gupshup WhatsApp.

```
                         ┌──────────────────────────────────┐
                         │         CADDY (443/80)           │
                         │    Auto-SSL + Reverse Proxy      │
                         └───────┬──────────────────┬───────┘
                                 │ /api/*           │ /*
                                 ▼                  ▼
                         ┌─────────────┐   ┌────────────────┐
                         │   BACKEND   │   │    FRONTEND    │
                         │  NestJS:3000│   │  React SPA :80 │
                         │  13 Modules │   │  10 Pages      │
                         │  50+ Routes │   │  13 Services   │
                         └──────┬──────┘   └────────────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
              ┌──────────┐ ┌────────┐ ┌──────────┐
              │PostgreSQL│ │IndiaMART│ │ Gupshup  │
              │  15      │ │ API    │ │ WhatsApp │
              │ 10 Tables│ └────────┘ └──────────┘
              └──────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + TypeScript + Vite | 18 + 8 |
| CSS | Tailwind CSS | 3.4 |
| Backend | NestJS + TypeScript | 11 |
| ORM | Drizzle ORM | Latest |
| Database | PostgreSQL | 15 |
| Auth | JWT (httpOnly cookies) + Passport | - |
| Deployment | Docker Compose + Caddy | - |
| Process | PM2 (non-Docker) | - |

---

## 3. Project Structure

```
MUXROULTIMATECRM/
├── docker-compose.yml          # 4-service orchestration
├── Caddyfile                   # Reverse proxy + SSL
├── .env / .env.production      # Environment configs
│
├── backend/                    # NestJS API
│   ├── src/
│   │   ├── main.ts             # Bootstrap + middleware
│   │   ├── app.module.ts       # Root module
│   │   ├── db/                 # Schema, service, seed
│   │   ├── auth/               # JWT authentication
│   │   ├── users/              # User management
│   │   ├── campaigns/          # Campaigns + statuses
│   │   ├── leads/              # Lead CRUD + status
│   │   ├── followups/          # Follow-up tracking
│   │   ├── forms/              # Dynamic form builder
│   │   ├── bulk-import/        # CSV/JSON import
│   │   ├── dashboard/          # Analytics
│   │   ├── notifications/      # Alert system
│   │   ├── integrations/       # External APIs
│   │   ├── settings/           # Encrypted config
│   │   └── common/             # Shared utilities
│   ├── Dockerfile
│   └── drizzle.config.ts
│
└── frontend/                   # React SPA
    ├── src/
    │   ├── App.tsx             # Router
    │   ├── pages/              # 10 pages
    │   ├── components/         # 7 components
    │   ├── context/            # 3 contexts
    │   ├── services/           # 13 API services
    │   ├── types/              # TypeScript types
    │   └── utils/              # Helpers
    ├── Dockerfile
    ├── vite.config.ts
    └── tailwind.config.js
```

---

## 4. Database Schema

### Entity Relationship Diagram

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│   User   │────<│ CampaignUser │>────│  Campaign    │
└──────────┘     └──────────────┘     └──────┬───────┘
     │                                        │
     │  ┌──────────────┐              ┌───────┼────────┐
     │  │ Notification │              │       │        │
     │  └──────┬───────┘         ┌────▼──┐ ┌──▼─────┐ ┌▼────────┐
     │         │                 │Status │ │  Form  │ │Enquiry  │
     │  ┌──────▼───────┐        └───────┘ └──┬─────┘ └────┬─────┘
     └─>│  Followup    │                     │            │
        └──────┬───────┘                     │            │
               │                             │            │
               └─────────┐          ┌────────┘            │
                         ▼          ▼                     ▼
                   ┌──────────────────────────────────────┐
                   │               Lead                    │
                   │  campaignId, doerId, statusId,       │
                   │  enquiryId, indiamartQueryId         │
                   └──────────────────────────────────────┘

  ┌─────────┐     ┌──────────────────┐
  │ Setting │────<│ SettingAuditLog  │
  └─────────┘     └──────────────────┘
```

### Tables (10)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `User` | System users | id, username, password, role (ADMIN/USER), isActive |
| `Campaign` | Lead campaigns | id, name, managerId (FK->User) |
| `CampaignUser` | User-campaign assignment | campaignId, userId (unique pair) |
| `CampaignStatus` | Custom pipeline stages | campaignId, label, color, order, whatsappMessage |
| `Lead` | Individual leads | campaignId, doerId, statusId, name, phone, email, source, dnd |
| `Followup` | Call/activity records | leadId, userId, status, remarks, nextCallDate |
| `Form` | Dynamic forms | campaignId, title, fields (JSON), publicSlug |
| `Enquiry` | Form submissions | formId, data (JSON), ipAddress |
| `Notification` | Alert records | userId, followupId, type, isRead |
| `Setting` | Encrypted config | key, encryptedValue (AES-256-GCM) |

### Key Relations

- **User** 1:N **Campaign** (as manager)
- **User** N:M **Campaign** (via CampaignUser)
- **Campaign** 1:N **CampaignStatus**, **Lead**, **Form**
- **Lead** 1:N **Followup**
- **Followup** 1:N **Notification**
- **Form** 1:N **Enquiry**
- **Enquiry** 1:1 **Lead** (optional)
- **Setting** 1:N **SettingAuditLog**

---

## 5. Authentication & Security

### Auth Flow

```
Login Request
     │
     ▼
POST /api/auth/login { username, password }
     │
     ├── bcrypt.compare(password, hashedPassword)
     │
     ├── jwt.sign({ sub: userId, role }, JWT_SECRET, { expiresIn: '15m' })
     │
     ├── Set httpOnly cookie: access_token = JWT
     │
     └── Return { user: { id, username, name, role } }

Subsequent Requests
     │
     ├── Cookie sent automatically (withCredentials: true)
     │
     ├── JWT Strategy extracts from cookie OR Authorization header
     │
     ├── Token blacklist check (logout support)
     │
     └── RolesGuard checks role (ADMIN/USER)
```

### Security Features

| Feature | Implementation |
|---------|---------------|
| Password hashing | bcryptjs (10 rounds) |
| JWT tokens | httpOnly, secure, sameSite=strict cookies |
| Token expiry | 15 minutes |
| Token revocation | In-memory blacklist with TTL |
| Rate limiting | 100 req/min (default), 5 req/min (auth) |
| CORS | Configurable origins |
| Security headers | Helmet (HSTS, X-Frame-Options, etc.) |
| Input validation | class-validator + Zod schemas |
| SQL injection | Drizzle ORM parameterized queries |
| API key storage | AES-256-GCM encryption at rest |
| Webhook security | Timing-safe HMAC validation |
| DB connection | Pool limit 5, 30s statement timeout |

### Role-Based Access

| Resource | ADMIN | USER |
|----------|-------|------|
| Campaigns | CRUD + assign users | View assigned only |
| Leads | CRUD + view all | View assigned + update status |
| Forms | CRUD + publish | View only |
| Users | CRUD | - |
| Bulk Import | Execute | - |
| Settings | CRUD | - |
| Dashboard | Full stats | Own stats |
| Notifications | Own | Own |

---

## 6. API Endpoints

### Auth (`/api/auth`)
| Method | Path | Access |
|--------|------|--------|
| POST | `/login` | Public |
| POST | `/register` | ADMIN |
| GET | `/profile` | JWT |
| POST | `/logout` | JWT |

### Campaigns (`/api/campaigns`)
| Method | Path | Access |
|--------|------|--------|
| GET | `/` | JWT |
| GET | `/:id` | JWT |
| POST | `/` | ADMIN |
| PUT | `/:id` | ADMIN |
| DELETE | `/:id` | ADMIN |
| POST | `/:id/users` | ADMIN |
| DELETE | `/:id/users/:userId` | ADMIN |

### Campaign Statuses (`/api/campaigns/:id/statuses`)
| Method | Path | Access |
|--------|------|--------|
| GET | `/` | JWT |
| POST | `/` | ADMIN |
| PUT | `/:id` | ADMIN |
| DELETE | `/:id` | ADMIN |

### Leads (`/api/leads`)
| Method | Path | Access |
|--------|------|--------|
| GET | `/campaign/:campaignId` | JWT |
| GET | `/dnd` | JWT |
| GET | `/stats/:campaignId` | ADMIN |
| GET | `/:id` | JWT |
| POST | `/` | ADMIN |
| PUT | `/:id` | JWT |
| PUT | `/:id/status` | JWT |
| POST | `/bulk-allocate/:campaignId` | ADMIN |
| DELETE | `/:id` | ADMIN |

### Forms (`/api/campaigns/:id/forms`)
| Method | Path | Access |
|--------|------|--------|
| GET | `/` | JWT |
| GET | `/:id` | JWT |
| POST | `/` | ADMIN |
| PUT | `/:id` | ADMIN |
| POST | `/:id/publish` | ADMIN |
| POST | `/:id/unpublish` | ADMIN |
| DELETE | `/:id` | ADMIN |
| GET | `/:id/submissions` | JWT |

### Public Forms (`/api/forms/public`)
| Method | Path | Access |
|--------|------|--------|
| GET | `/:slug` | Public |
| POST | `/:slug/submit` | Public (rate-limited: 10/min) |

### Followups (`/api/followups`)
| Method | Path | Access |
|--------|------|--------|
| GET | `/lead/:leadId` | JWT |
| GET | `/cross-campaign` | JWT |
| GET | `/my` | JWT |
| GET | `/upcoming` | JWT |
| POST | `/` | JWT |
| PUT | `/:id` | JWT |
| DELETE | `/:id` | JWT |

### Bulk Import (`/api/campaigns/:id/bulk-import`)
| Method | Path | Access |
|--------|------|--------|
| POST | `/csv` | ADMIN |
| POST | `/json` | ADMIN |

### Dashboard (`/api/dashboard`)
| Method | Path | Access |
|--------|------|--------|
| GET | `/overview` | JWT |
| GET | `/campaign-stats/:campaignId` | JWT |
| GET | `/followups` | JWT |
| GET | `/leads` | JWT |
| GET | `/sales-funnel` | JWT |
| GET | `/user-conversion` | JWT |

### Notifications (`/api/notifications`)
| Method | Path | Access |
|--------|------|--------|
| GET | `/pending` | JWT |
| GET | `/pending-count` | JWT |
| GET | `/` | JWT |
| PATCH | `/:id/read` | JWT |
| PATCH | `/read-all` | JWT |
| PATCH | `/sync` | JWT |

### Integrations (`/api/integrations`)
| Method | Path | Access |
|--------|------|--------|
| POST | `/indiamart/fetch-leads` | ADMIN |
| POST | `/indiamart/auto-import` | ADMIN |
| POST | `/indiamart/test-connection` | ADMIN |
| POST | `/process-sutra/start-flow` | ADMIN |
| POST | `/process-sutra/test-connection` | ADMIN |
| POST | `/gupshup/send-message` | ADMIN |
| POST | `/gupshup/send-template` | ADMIN |
| POST | `/gupshup/test-connection` | ADMIN |
| POST | `/gupshup/sync-templates` | JWT |
| POST | `/gupshup/webhook` | Public |

### Settings (`/api/settings`)
| Method | Path | Access |
|--------|------|--------|
| GET | `/` | ADMIN |
| GET | `/:key` | ADMIN |
| POST | `/` | ADMIN |
| PUT | `/:key` | ADMIN |
| GET | `/:key/audit-log` | ADMIN |
| POST | `/:key/test` | ADMIN |

### Health (`/api/health`)
| Method | Path | Access |
|--------|------|--------|
| GET | `/health` | Public |

---

## 7. Frontend Architecture

### Routing

```
/login              → LoginPage (Public)
/form/:slug         → PublicFormPage (Public)
/dashboard          → DashboardPage (Any authenticated user)
/campaigns          → CampaignsPage (ADMIN)
/campaigns/:id      → CampaignDetailPage (ADMIN)
/followups          → FollowupDashboardPage (Any)
/dnd                → DndPage (Any)
/admin/users        → AdminUsersPage (ADMIN)
/settings           → SettingsPage (ADMIN)
```

### Context Providers

| Context | State | Purpose |
|---------|-------|---------|
| `AuthContext` | user, login(), logout() | Authentication state + localStorage persistence |
| `NotificationContext` | notifications, unreadCount, playSound() | 10s polling, sound alerts, browser notifications |
| `ThemeContext` | theme, toggleTheme() | Light/dark mode with system preference detection |

### Component Tree

```
App
├── AuthProvider
│   ├── ThemeProvider
│   │   └── NotificationProvider
│   │       └── BrowserRouter
│   │           ├── /login → LoginPage
│   │           ├── /form/:slug → PublicFormPage
│   │           └── PrivateRoute
│   │               └── Layout (sidebar + header + notifications)
│   │                   ├── DashboardPage
│   │                   │   ├── SalesFunnel
│   │                   │   └── UserConversion
│   │                   ├── CampaignsPage
│   │                   ├── CampaignDetailPage
│   │                   │   └── FormBuilder
│   │                   ├── FollowupDashboardPage
│   │                   │   ├── StatusUpdateDialog
│   │                   │   └── LeadDetailDialog
│   │                   ├── DndPage
│   │                   ├── AdminUsersPage
│   │                   └── SettingsPage
```

### API Communication

```
Frontend Service → axios (withCredentials: true) → /api/* → Backend
                                              ↑
                                    Cookie sent automatically
                                    (httpOnly access_token)
```

---

## 8. Integrations

### IndiaMART
- **Purpose:** Pull leads from IndiaMART marketplace
- **API:** Pull API v2
- **Flow:** Fetch leads → Parse email bodies → Deduplicate by `indiamartQueryId` → Create leads with `source: 'indiamart'`
- **Auto-import:** Scheduled or manual fetch to campaign

### Process Sutra
- **Purpose:** Workflow automation
- **API:** REST API with API key auth
- **Flow:** Start flow with payload → Process Sutra executes workflow

### Gupshup WhatsApp
- **Purpose:** WhatsApp messaging for lead communication
- **Features:**
  - Session messages (free within 24h window)
  - Template messages (HSM, outside 24h window)
  - Inbound webhook for receiving messages
  - Auto-creates followup from inbound WhatsApp
  - Template sync from approved templates
- **Webhook:** Public endpoint with HMAC secret validation

---

## 9. Deployment

### Docker Compose Services

| Service | Image | Port | Memory | Depends On |
|---------|-------|------|--------|------------|
| `postgres` | postgres:15-alpine | 5432 | 512M | - |
| `backend` | Custom build | 3000 | 512M | postgres |
| `frontend` | Custom build | 80 | 128M | backend |
| `caddy` | caddy:alpine | 80, 443 | 128M | frontend |

### Network & Volumes

```
Network: crm-network (bridge)
Volumes:
  - postgres_data    (database persistence)
  - caddy_data       (SSL certificates)
  - caddy_config     (Caddy configuration)
```

### Caddy (Reverse Proxy)

```
api.muxrocrm.cloud/* → backend:3000
muxrocrm.cloud/*     → frontend:80

Features:
  - Auto-SSL via Let's Encrypt
  - HSTS + security headers
  - zstd + gzip compression
  - X-Real-IP forwarding
```

### Health Checks

| Service | Command | Interval |
|---------|---------|----------|
| postgres | `pg_isready -U postgres` | 10s |
| backend | `wget -q --spider http://localhost:3000/api/health` | 30s |

---

## 10. Encryption System

**Algorithm:** AES-256-GCM (Authenticated Encryption)

```
Setting Table
┌──────────────────────────────────────────────┐
│ key: "gupshup_api_key"                       │
│ encryptedValue: "iv_hex:authTag_hex:data_hex"│
│ isEncrypted: true                            │
└──────────────────────────────────────────────┘

Encryption Flow:
  plaintext → scryptSync(password, salt) → AES-256-GCM(key, iv) → ciphertext
                                                              ↓
                                              "iv_hex:authTag_hex:ciphertext_hex"

Decryption Flow:
  "iv_hex:authTag_hex:ciphertext_hex" → split → AES-256-GCM.decrypt(key, iv, authTag, ciphertext) → plaintext
```

**Features:**
- All API keys, tokens, secrets encrypted at rest
- Automatic masking of sensitive values in API responses
- Audit trail for all setting changes (SettingAuditLog)
- Timing-safe comparison for webhook secrets

---

## 11. Key Features

| Feature | Description |
|---------|-------------|
| **Campaign Management** | Create campaigns with custom pipeline statuses, assign telecallers |
| **Lead Management** | CRUD with round-robin assignment, DND flag, multiple sources |
| **Dynamic Form Builder** | Configurable fields, public shareable URLs, auto-lead creation |
| **Follow-up System** | Schedule calls, cross-campaign search, automatic notifications |
| **Notification System** | 10s polling, sound alerts, browser notifications, overdue/today/tomorrow |
| **Bulk Import** | CSV/JSON import with validation and round-robin allocation |
| **Dashboard Analytics** | Sales funnel, user conversion, campaign stats, CSV export |
| **WhatsApp Integration** | Session + template messages, inbound webhook, auto-followup |
| **IndiaMART Integration** | Pull leads, auto-import, duplicate detection |
| **Encrypted Settings** | AES-256-GCM encryption, audit logging, value masking |
| **Dark Mode** | System-wide light/dark theme with user toggle |
| **Responsive Design** | Mobile-friendly layout with collapsible sidebar |
