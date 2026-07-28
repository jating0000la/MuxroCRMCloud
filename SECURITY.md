# MuxroCRM Cloud — Security Document

> **Generated:** 2026-07-28  
> **Scope:** Full-stack security analysis — NestJS backend, React frontend, PostgreSQL, Caddy reverse proxy, PM2 deployment

---

## Table of Contents

1. [Security Posture Overview](#1-security-posture-overview)
2. [Authentication Architecture](#2-authentication-architecture)
3. [Authorization & Access Control](#3-authorization--access-control)
4. [API Security](#4-api-security)
5. [Data Security](#5-data-security)
6. [Transport Security](#6-transport-security)
7. [Infrastructure Security](#7-infrastructure-security)
8. [Secrets Management](#8-secrets-management)
9. [Integration Security](#9-integration-security)
10. [Monitoring & Incident Response](#10-monitoring--incident-response)
11. [Security Checklist & Recommendations](#11-security-checklist--recommendations)

---

## 1. Security Posture Overview

### 1.1 Security Principles Applied

| Principle | Implementation |
|-----------|---------------|
| **Defense in Depth** | TLS → Caddy headers → Helmet → JWT auth → Role guard → Resource guard → Input validation → DB-level constraints |
| **Least Privilege** | Two-tier RBAC (ADMIN/USER), resource-scoped access via campaign assignments |
| **Secure by Default** | Env vars required at startup, strict ValidationPipe, rate limiting globally enabled |
| **Fail Secure** | Startup exits on missing secrets, unhandled exceptions trigger PM2 restart |
| **Privacy by Design** | PII (phone, email) stored with indexes but encryption only for API keys |

### 1.2 Threat Model Summary

| Threat | Mitigation | Severity |
|--------|-----------|----------|
| Brute-force login | `@StrictThrottle()` — 5 req/min on login endpoint | 🟢 Mitigated |
| JWT theft / replay | Short-lived access tokens (15m), refresh token rotation, HttpOnly cookies | 🟢 Mitigated |
| CSRF / XSS via cookies | `sameSite: lax`, HttpOnly, Helmet headers | 🟢 Mitigated |
| SQL injection | Drizzle ORM parameterized queries, no raw SQL in user-facing code | 🟢 Mitigated |
| API key exposure | AES-256-GCM at rest, masked in API responses, scrypt key derivation | 🟢 Mitigated |
| SSRF | Outbound HTTP only to known 3rd-party APIs (Gupshup, IndiaMART, Process Sutra) | 🟢 Mitigated |
| Path traversal | `basename()` sanitization in logo serving, regex validation on backup filenames | 🟢 Mitigated |
| DoS — Rate limit | Global 100 req/min throttle, 1MB JSON body limit, 30s statement timeout | 🟢 Mitigated |
| DoS — Large uploads | Caddy 50MB limit on `/api/*`, `pg_dump` maxBuffer 50MB | 🟡 Partial |
| No CSP at proxy | Helmet CSP set behind proxy — never reaches browser clients | 🔴 Risk |
| No CSRF token | No anti-CSRF token mechanism for state-changing requests | 🟡 Partial (cookie samesite mitigates) |

---

## 2. Authentication Architecture

### 2.1 Authentication Flow

```
 Client                          Backend                          Database
   │                                │                                │
   │  POST /api/v1/auth/login       │                                │
   │  { username, password }        │                                │
   │ ─────────────────────────────►  │                                │
   │                                │  SELECT * FROM "User"          │
   │                                │  WHERE username = ? ──────────► │
   │                                │  ◄── user record ───────────── │
   │                                │                                │
   │                                │  bcrypt.compare(password,      │
   │                                │    user.password)               │
   │                                │                                │
   │                                │  JWT.sign({ sub, role })       │
   │                                │  (access token, 15m)           │
   │                                │                                │
   │                                │  JWT.sign({ sub, role })       │
   │                                │  (refresh token, 7d)           │
   │                                │                                │
   │                                │  INSERT RefreshSession ───────► │
   │                                │  (token HASHED via SHA-256)    │
   │                                │                                │
   │  Set-Cookie: auth_token=JWT    │                                │
   │  (HttpOnly, Secure, SameSite)  │                                │
   │  Set-Cookie: refresh_token=JWT │                                │
   │  (HttpOnly, Secure, SameSite)  │                                │
   │ ◄───────────────────────────── │                                │
   │                                │                                │
```

### 2.2 Token Architecture

| Property | Access Token | Refresh Token |
|----------|-------------|---------------|
| **Format** | JWT (signed) | JWT (signed) |
| **Lifetime** | 15 minutes (configurable via `ACCESS_TOKEN_EXPIRATION`) | 7 days (configurable via `REFRESH_TOKEN_EXPIRATION`) |
| **Storage (client)** | HttpOnly cookie (`auth_token`) | HttpOnly cookie (`refresh_token`) |
| **Storage (server)** | None (in-memory blacklist only) | Hashed (SHA-256) in `RefreshSession` table |
| **Revocation** | In-memory Map with 5-min cleanup interval | DB `revokedAt` timestamp |
| **Rotation** | N/A (new one issued on refresh) | Atomic rotation: new created BEFORE old revoked |

### 2.3 Cookie Security

```typescript
const COOKIE_OPTIONS = (maxAgeMs, isProduction) => ({
  httpOnly: true,           // Not accessible via JavaScript
  secure: isProduction,     // HTTPS only in production
  sameSite: 'lax',          // CSRF protection via SameSite
  maxAge: maxAgeMs,
  path: '/',
});
```

- **`httpOnly: true`** — prevents XSS-based token theft
- **`secure: true`** (production) — prevents MitM on non-HTTPS connections
- **`sameSite: 'lax'`** — prevents CSRF for top-level navigations; allows GET but blocks state-changing cross-origin requests
- **No CSRF token** — reliance on SameSite alone; acceptable for SPA-with-API architecture but not comprehensive

### 2.4 Token Revocation

**Access tokens** (in-memory blacklist):
```typescript
const accessTokenBlacklist = new Map<string, number>();
// Cleanup every 5 minutes to prevent memory leak
setInterval(() => { /* delete expired entries */ }, 300_000);
// Max 1000 entries — trims oldest half if exceeded
```

**Refresh tokens** (DB-backed):
```typescript
// Hash token before storage — raw JWT never persisted
hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
// Revocation sets revokedAt timestamp
revokeSession(token): void {
  UPDATE "RefreshSession" SET "revokedAt" = NOW()
  WHERE "tokenHash" = ? AND "revokedAt" IS NULL
}
```

**Revocation triggers:**
- Explicit logout (revokes both access + refresh)
- Password change (revokes all user sessions)
- Token refresh (atomic rotation: new session created → old session revoked)

### 2.5 Password Security

```typescript
// Registration / password change
const hashedPassword = await bcrypt.hash(password, 10);

// Login verification
const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
```

- **Algorithm:** bcryptjs
- **Salt rounds:** 10 (~10 hashes/second on modern hardware)
- **Minimum length:** 6 characters (validated in DTO)
- **No password recovery** — admin-only reset via `/users/:id/reset-password`

---

## 3. Authorization & Access Control

### 3.1 Role-Based Access Control (RBAC)

Two roles defined via `pgEnum('Role', ['ADMIN', 'USER'])`:

| Role | Capabilities |
|------|-------------|
| **ADMIN** | Full system access: create/manage campaigns, users, settings, integrations, bulk operations, admin dashboard |
| **USER** | Scoped access: view/manage leads assigned to them, create follow-ups, access WhatsApp, view dashboard |

**Implementation:**
```typescript
// Guard chain on controllers
@UseGuards(JwtAuthGuard, RolesGuard)

// Role enforcement via decorator
@Roles('ADMIN')
```

**Role guard logic:**
```typescript
canActivate(context): boolean {
  const requiredRoles = this.reflector.get<Role[]>('roles', context.getHandler());
  if (!requiredRoles) return true;  // No @Roles() = any authenticated user
  const { user } = context.switchToHttp().getRequest();
  return requiredRoles.some((role) => user.role === role);
}
```

### 3.2 Resource-Level Authorization

The `AuthorizationService` provides fine-grained access control:

| Method | Logic |
|--------|-------|
| `ensureCampaignAccess(campaignId, userId, role)` | ADMIN bypasses; USER must have active `CampaignUser` record |
| `ensureLeadAccess(leadId, userId, role)` | ADMIN bypasses; USER must be assigned doer OR have campaign access |
| `ensureLeadWriteAccess(leadId, userId, role)` | ADMIN bypasses; USER must be the assigned doer |
| `ensureFollowupAccess(followupId, userId, role)` | ADMIN bypasses; USER must own the followup |
| `ensureUserModifyAccess(targetUserId, callerId, role)` | ADMIN bypasses; USER cannot modify other users |

**Resource guard** — decorator-driven protection:
```typescript
@RequireResource('lead', 'leadId')  // Auto-checks lead access from route param
```

### 3.3 Authorization Matrix

| Endpoint | Auth | Role | Resource Check |
|----------|------|------|---------------|
| `POST /auth/login` | Public | — | — |
| `POST /auth/register` | JWT | ADMIN | — |
| `GET /auth/profile` | JWT | Any | — |
| `GET /campaigns` | JWT | ADMIN | — |
| `GET /leads/campaign/:id` | JWT | Any | Campaign access |
| `PUT /leads/:id/status` | JWT | Any | Lead write access |
| `POST /settings` | JWT | ADMIN | — |
| `POST /integrations/*` | JWT | ADMIN | — |
| `GET /forms/public/:slug` | Public | — | — |

---

## 4. API Security

### 4.1 Input Validation

**Global ValidationPipe:**
```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,              // Strip unknown properties
  transform: true,              // Auto-transform types
  forbidNonWhitelisted: true,   // Reject unknown properties (400)
  transformOptions: { enableImplicitConversion: true },
}));
```

**DTO examples:**
```typescript
// Login
class LoginDto {
  @IsString() @IsNotEmpty() username: string;
  @IsString() @MinLength(6) password: string;
}

// Registration
class RegisterDto {
  @IsString() @IsNotEmpty() username: string;
  @IsString() @MinLength(6) password: string;
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsEmail() email?: string;
}
```

### 4.2 Rate Limiting

| Scope | Limit | Endpoints |
|-------|-------|-----------|
| **Global** | 100 req / 60s window | All authenticated endpoints |
| **Login** | 5 req / 60s | `POST /auth/login` |
| **Public form submit** | 10 req / 60s | `POST /forms/public/:slug/submit` |
| **Block duration** | 5 seconds | HTTP 429 with `Retry-After` header |

**Implementation:**
```typescript
// Global (app.module.ts)
ThrottlerModule.forRoot([{ ttl: 60000, limit: 100, blockDuration: 5000 }])

// Strict throttle decorator
export const StrictThrottle = () => Throttle({ default: { limit: 5, ttl: 60000 } });
```

**Client-side retry:** Axios interceptor handles 429 with exponential backoff:
```typescript
// Max 3 retries, base delay 1s, doubles each attempt
const RETRY_BASE_DELAY_MS = 1000;
const MAX_429_RETRIES = 3;
```

### 4.3 Auto-Refresh Interceptor

The frontend Axios interceptor provides transparent token refresh:

```typescript
// On 401 response:
1. Check: not already refreshing, not /auth/refresh or /auth/login
2. Queue concurrent requests while refresh is in-flight
3. POST /auth/refresh (cookie-based, no manual token handling)
4. On success → retry original request
5. On failure → clear storage, redirect to /login
```

**Security properties:**
- Refresh endpoint uses HttpOnly cookies — no token exposure to JS
- Failed refresh clears `localStorage` and `sessionStorage`
- Prevents infinite refresh loops by skipping `/auth/refresh` itself

### 4.4 Swagger Security

```typescript
// Only enabled in non-production or explicit opt-in
if (process.env.SWAGGER_ENABLED === 'true') {
  // Swagger UI at /api/docs
  config.addBearerAuth() // JWT bearer token support
}
```

- **Default:** DISABLED in production
- **Auth:** Bearer token via Swagger UI "Authorize" button
- **Risk:** If accidentally enabled in production, exposes full API surface

### 4.5 Request Size Limits

| Layer | Limit | Path |
|-------|-------|------|
| Express JSON body | 1 MB | All `/api/v1/*` |
| Caddy reverse proxy | 50 MB | `/api/*` (for CSV imports) |

### 4.6 Request Validation Patterns

```typescript
// Zod schemas (common/validation.ts)
export const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sanitization
export const sanitizeString = (value: string): string => {
  return value.trim().replace(/[<>]/g, '');  // Strip HTML tags
};
```

---

## 5. Data Security

### 5.1 Encryption at Rest

**Settings (API keys, secrets):**
```typescript
Algorithm: AES-256-GCM
Key derivation: scrypt(APP_ENCRYPTION_KEY, ENCRYPTION_SALT, 32 bytes)
IV: 16 random bytes per encryption
Auth tag: GCM authentication tag (integrity verification)
Storage format: ivHex:authTagHex:ciphertextHex
```

**Encryption flow:**
```
plaintext → AES-256-GCM encrypt → iv:authTag:ciphertext → DB
DB → iv:authTag:ciphertext → AES-256-GCM decrypt → plaintext
```

**Key requirements:**
```typescript
// Both are MANDATORY — app exits at startup if missing
APP_ENCRYPTION_KEY  // Generate: openssl rand -base64 32
ENCRYPTION_SALT     // Generate: openssl rand -hex 16
```

### 5.2 Password Storage

```typescript
const hashedPassword = await bcrypt.hash(password, 10);
// Salt rounds = 10, stored as part of bcrypt hash string
```

### 5.3 Refresh Token Storage

```typescript
// Raw JWT NEVER stored — only SHA-256 hash
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
// DB: RefreshSession { tokenHash, expiresAt, revokedAt, ... }
```

### 5.4 Sensitive Data Masking

Settings API returns masked values for sensitive keys:
```typescript
private shouldMaskKey(key: string): boolean {
  return /(apikey|api_key|token|secret|password|passphrase|privatekey|private_key)/i.test(key);
}

maskValue(value: string, showChars: number = 4): string {
  // "sk-abc123...XYZ" → "••••••••••XYZ"
}
```

### 5.5 Database Security

```typescript
// Connection hardening
const pool = new Pool({
  connectionString: databaseUrl,
  max: 5,                     // Limited connection pool
  idleTimeoutMillis: 30000,   // Close idle connections
  connectionTimeoutMillis: 5000,
  options: '-c statement_timeout=30000',  // 30s query timeout
});
```

- **PostgreSQL:** Binds to `127.0.0.1:5433` (localhost only, not exposed)
- **Connection limit:** Max 5 concurrent connections
- **Statement timeout:** 30 seconds on ALL queries
- **No raw SQL:** All queries via Drizzle ORM parameterized queries

---

## 6. Transport Security

### 6.1 TLS Termination (Caddy)

```caddyfile
{$DOMAIN:muxrocrm.cloud}, www.{$DOMAIN:muxrocrm.cloud} {
    email {$ACME_EMAIL:admin@muxrocrm.cloud}  # Let's Encrypt registration
    encode zstd gzip
    
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
        -Server  # Hide server version
    }
}
```

### 6.2 Security Headers

| Header | Value | Source | Purpose |
|--------|-------|--------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Caddy | Enforce HTTPS for 1 year |
| `X-Content-Type-Options` | `nosniff` | Caddy | Prevent MIME type sniffing |
| `X-Frame-Options` | `SAMEORIGIN` | Caddy | Prevent clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Caddy | Limited referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Caddy | Block sensitive browser APIs |
| `Content-Security-Policy` | NOT SET at proxy layer | **Missing** | Risk: no XSS containment at browser level |
| `X-XSS-Protection` | Set by Helmet (behind proxy) | Backend | Legacy — not effective in modern browsers |

### 6.3 CSP Gap Analysis

**Current state:**
- Helmet sets CSP `default-src 'self'` on backend responses
- Caddy proxies frontend traffic directly to port 8080 (static files)
- Caddy does NOT forward backend headers for frontend routes
- Caddy does NOT set its own CSP
- **Result: No Content Security Policy reaches browser clients**

**Recommended CSP:**
```caddyfile
header {
    Content-Security-Policy "
        default-src 'self';
        script-src 'self' 'unsafe-inline';  # React needs inline scripts
        style-src 'self' 'unsafe-inline';   # Tailwind needs inline styles
        img-src 'self' data: https:;
        font-src 'self' data:;
        connect-src 'self' https://api.gupshup.io https://mapi.indiamart.com;
        frame-src 'none';
        object-src 'none';
        base-uri 'self';
        form-action 'self';
    "
}
```

### 6.4 CORS Configuration

```typescript
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.enableCors({
  origin: corsOrigin.split(','),   // Explicit allowlist
  credentials: true,                // Required for cookie-based auth
});
```

- **Production:** Set `CORS_ORIGIN=https://muxrocrm.cloud` (single origin)
- **Development:** Defaults to `http://localhost:5173` (Vite dev server)
- **Credentials:** Enabled (necessary for HttpOnly cookies)

---

## 7. Infrastructure Security

### 7.1 Deployment Topology

```
Internet
    │
    ▼
  Caddy (Port 443)
    │
    ├── /api/* ──────────────────► localhost:3000 (NestJS, PM2)
    │                                │
    │                                └── PostgreSQL (127.0.0.1:5433, Docker)
    │
    └── /* ────────────────────────► localhost:8080 (React SPA, serve, PM2)
```

### 7.2 PM2 Security Configuration

```javascript
{
  name: "muxro-crm-backend",
  instances: 1,
  exec_mode: "fork",
  node_args: "--max-old-space-size=1536",   // Heap limit: 1.5GB
  max_memory_restart: "2048M",              // Auto-restart at 2GB
  autorestart: true,
  max_restarts: 10,
  restart_delay: 3000,
  exp_backoff_restart_delay: 200,           // Backoff to prevent crash loops
  env: { NODE_ENV: "production" },
}
```

### 7.3 Docker Security

```yaml
services:
  postgres:
    image: postgres:15-alpine
    ports:
      - "127.0.0.1:5433:5432"      # Localhost-only binding
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M              # Memory limit
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres}"]
```

- **Port binding:** `127.0.0.1:5433` — NOT exposed to network
- **Memory limit:** 512MB container limit
- **Health check:** pg_isready for container orchestration
- **No root volumes:** Uses Docker volume `postgres_data`

### 7.4 Process Isolation

- Backend and frontend run as **separate PM2 processes**
- Worker process (`worker.ts`) runs as a **separate NestJS application context** — no HTTP listener
- Single instance (fork mode) due to 1 CPU core constraint

### 7.5 Startup Security Checks

```typescript
// main.ts — exits if critical env vars missing
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'APP_ENCRYPTION_KEY', 'ENCRYPTION_SALT'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}
```

---

## 8. Secrets Management

### 8.1 Environment Variables

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ Yes | — |
| `JWT_SECRET` | JWT signing key | ✅ Yes | — |
| `APP_ENCRYPTION_KEY` | AES-256-GCM encryption key (32-byte base64) | ✅ Yes | — |
| `ENCRYPTION_SALT` | scrypt salt for key derivation (hex) | ✅ Yes | — |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | ❌ No | `http://localhost:5173` |
| `ACCESS_TOKEN_EXPIRATION` | JWT access token TTL | ❌ No | `15m` |
| `REFRESH_TOKEN_EXPIRATION` | JWT refresh token TTL | ❌ No | `7d` |
| `THROTTLE_LIMIT` | Global rate limit count | ❌ No | `100` |
| `THROTTLE_TTL` | Global rate limit window (ms) | ❌ No | `60000` |
| `SWAGGER_ENABLED` | Enable Swagger docs | ❌ No | `false` |
| `PUBLIC_FORMS_ENABLED` | Enable public form submissions | ❌ No | `true` |
| `DB_POOL_MAX` | Max database connections | ❌ No | `5` |
| `BACKUP_DIR` | Backup file storage path | ❌ No | `/backups` |
| `SEED_ADMIN_PASSWORD` | Seed script admin password | ❌ No | `admin123` |
| `SEED_USER_PASSWORD` | Seed script user password | ❌ No | `user123` |

### 8.2 Seed Script Security

```typescript
// Production guard — refuses to run with default passwords in production
if (process.env.NODE_ENV === 'production' && (!process.env.SEED_ADMIN_PASSWORD || !process.env.SEED_USER_PASSWORD)) {
  console.error('SEED_ADMIN_PASSWORD and SEED_USER_PASSWORD must both be set in production');
  process.exit(1);
}
```

### 8.3 .gitignore Coverage

```
.env
.env.local
.env.production
backend/.env
frontend/.env
nginx/ssl/
postgres_data/
node_modules/
dist/
build/
*.log
```

- ✅ All `.env` variants ignored at all levels
- ✅ SSL certificates excluded
- ⚠️ `.env.example` IS committed (safe — contains no secrets)

### 8.4 Gupshup Google Apps Script (gupshup.gs)

- API keys stored in **Script Properties** (not hardcoded): `PropertiesService.getScriptProperties()`
- Comment explicitly warns: *"Keep GUPSHUP_API_KEY in Script Properties, not directly in this file"*
- Good practice: secrets retrieved from secure runtime properties store

---

## 9. Integration Security

### 9.1 Gupshup (WhatsApp API)

```typescript
// API key resolved at runtime from encrypted settings
private async resolveConfigValue(key: string, override: string | undefined, user): Promise<string> {
  if (user?.role === 'ADMIN' && override?.trim()) {
    return override.trim();  // Admin can override for testing
  }
  // Fall back to encrypted stored value
  return this.settingsService.getSettingForUse(key);
}
```

**Webhook security:**
```typescript
@Post('webhook')
@Public()  // No JWT auth — called by Gupshup's servers
@HttpCode(HttpStatus.OK)
```

- ⚠️ Gupshup webhooks use `@Public()` decorator — no authentication on incoming webhooks
- **Mitigation:** Webhooks are idempotent (dedup by message ID), limited to creating followup records
- **Recommendation:** Implement IP allowlisting or webhook signature verification if Gupshup supports it

### 9.2 IndiaMART

```typescript
// API key passed per-request (from encrypted settings or admin override)
const params = { glusr_crm_key: crmKey };
// Outbound HTTPS only, timeout 30s
```

- CRM Key retrieved from encrypted settings at runtime
- Outbound connection only — no inbound webhooks
- 30s timeout prevents hanging connections

### 9.3 Process Sutra

```typescript
const headers = {
  'x-api-key': apiKey,
  'x-actor-email': actorEmail,
  'x-source': 'muxro-crm',
};
```

- Custom headers for origin identification
- API key from encrypted settings
- Outbound HTTPS only
- 30s timeout

### 9.4 Payload Verification

```typescript
// Backup filename sanitization — path traversal protection
const SAFE_BACKUP_FILENAME = /^[A-Za-z0-9._-]+\.dump$/;

getBackupFilePath(filename: string): string {
  if (!SAFE_BACKUP_FILENAME.test(filename) || filename.includes('..')) {
    throw new BadRequestException('Invalid backup filename');
  }
}

// Logo file serving — path traversal protection
const safeName = basename(filename);  // Strips any directory components
```

---

## 10. Monitoring & Incident Response

### 10.1 Request Logging

**StructuredLoggingMiddleware** — captures per-request audit trail:

```typescript
const logEntry = {
  timestamp: new Date().toISOString(),
  method, url, status,
  duration: `${duration}ms`,
  ip: ip || req.socket.remoteAddress,
  userAgent,
  userId: req.user?.id,        // Authenticated user ID (if available)
  requestId: req.headers['x-request-id'],
};

// Severity-based logging
if (statusCode >= 500) logger.error(JSON.stringify(logEntry));
if (statusCode >= 400) logger.warn(JSON.stringify(logEntry));
else logger.log(JSON.stringify(logEntry));
```

**Logged events:**
- All HTTP requests with method, URL, status, duration
- Authenticated user ID (for audit trail)
- Client IP and user agent
- Request ID for distributed tracing

### 10.2 Database Monitoring

```typescript
// Slow query detection (>500ms)
if (stat.avgExecutionMs > 500) {
  this.logger.warn(`Slow query (${stat.avgExecutionMs}ms): ${query.substring(0, 80)}...`);
}

// Connection count alert (>15 connections)
if (stat.activeConnections > 15) {
  this.logger.warn(`High connection count for ${database}: ${stat.activeConnections}`);
}

// Database size tracking
// Requires: pg_stat_statements extension
```

### 10.3 Job Monitoring

```typescript
// All background jobs logged to JobLog table
interface JobLog {
  jobType, status, payload, result, error,
  retryCount, maxRetries, startedAt, completedAt
}
```

**Admin dashboard** (`/api/v1/admin/health`):
- Database status and response time
- Database size (total, data, index)
- Memory usage (heap, RSS)
- Uptime and CPU load
- Job queue stats (pg-boss)

### 10.4 Error Handling

```typescript
// Worker process — prevent silent death
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, err.stack);
  process.exit(1);  // Exit to let PM2 restart
});

process.on('unhandledRejection', (reason: any) => {
  logger.error(`Unhandled Rejection: ${reason?.message || reason}`);
});

// Main process — shutdown hooks
app.enableShutdownHooks();  // Graceful shutdown on SIGTERM/SIGINT
```

### 10.5 Audit Trail

**Setting changes** — `SettingAuditLog` table:
```typescript
interface SettingAuditLog {
  settingId, action, changedBy,
  oldValue, newValue (encrypted),
  reason, createdAt
}
```

---

## 11. Security Checklist & Recommendations

### 11.1 Current Security Posture ✅

| Category | Status |
|----------|--------|
| TLS / HTTPS | ✅ Fully implemented via Caddy + Let's Encrypt |
| HSTS | ✅ 1-year, includeSubDomains, preload |
| Security Headers | ✅ X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy |
| JWT Auth | ✅ Access + Refresh tokens with rotation |
| Password Hashing | ✅ bcryptjs (10 rounds) |
| Input Validation | ✅ Global ValidationPipe with whitelist |
| Rate Limiting | ✅ Global + strict per-endpoint |
| SQL Injection Protection | ✅ Drizzle ORM parameterized queries |
| API Key Encryption | ✅ AES-256-GCM at rest |
| Path Traversal Protection | ✅ basename() + regex validation |
| CORS | ✅ Configurable origin allowlist |
| Cookie Security | ✅ HttpOnly, Secure, SameSite |
| Secret Rotation | ✅ Refresh token rotation on every use |
| Startup Validation | ✅ Missing env vars cause exit |

### 11.2 Identified Risks 🔴

| # | Risk | Severity | Recommendation |
|---|------|----------|---------------|
| 1 | **No Content Security Policy at proxy layer** | High | Add CSP header in Caddyfile (see §6.3 for recommended policy) |
| 2 | **No CSRF token** | Medium | Add CSRF token for state-changing operations (complementary to SameSite) |
| 3 | **Gupshup webhook unauthenticated** | Medium | Implement IP allowlisting or HMAC signature verification |
| 4 | **Login rate limit still allows 5 req/min** | Low | Consider account lockout after N failed attempts (e.g., 10) |
| 5 | **Password minimum length only 6 chars** | Low | Increase to 8+ characters with complexity requirements |
| 6 | **No brute-force monitoring** | Low | Add alerting on repeated 401s from same IP |
| 7 | **Seed defaults** | Low | Ensure seed scripts never run in production with defaults (already guarded) |

### 11.3 Recommended Improvements

**Immediate (High Priority):**
```caddyfile
# Add to Caddyfile header block
Content-Security-Policy "
    default-src 'self';
    script-src 'self' 'unsafe-inline';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self' data:;
    connect-src 'self' https://api.gupshup.io https://mapi.indiamart.com;
    frame-src 'none';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
"
```

**Short-term (Medium Priority):**
- Implement CSRF token pattern for POST/PUT/DELETE endpoints
- Add IP allowlisting for Gupshup webhook endpoint
- Increase minimum password length to 8 characters
- Add failed-login tracking and account lockout after 10 attempts

**Long-term (Low Priority):**
- Implement API key rotation policy (auto-expire unused keys)
- Add audit logging for lead/followup read access
- Consider rate limiting per-user (not just global)
- Implement database query logging (via `log_statement = 'mod'` in PostgreSQL)
- Add security headers to frontend build (via Vite plugin or meta tags)

### 11.4 Security Contacts & Procedures

- **Environment variables:** Managed via `.env` file (gitignored), backed up separately
- **Secret rotation:** `JWT_SECRET` and `APP_ENCRYPTION_KEY` can be rotated by updating `.env` and restarting PM2 processes
- **Incident response:** PM2 auto-restarts crashed processes; logs in `/var/log/pm2/` and `/var/log/caddy/`
- **Backup recovery:** `pg_dump` custom format backups stored in `BACKUP_DIR`, auto-cleaned after retention period

---

*End of Security Document*
