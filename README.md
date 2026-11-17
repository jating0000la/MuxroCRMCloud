# MuxroCRM Cloud

Campaign and lead management with public enquiry forms, sales follow-ups, reporting, WhatsApp/Gupshup communication and CloudConnect incoming IVR integration.

The application uses a React/Vite frontend, a NestJS backend, Drizzle ORM, PostgreSQL and PostgreSQL-backed background jobs. The repository's primary VPS topology uses PM2 for the application processes and Docker Compose for PostgreSQL.

## Documentation

- [Technical documentation and operating procedures](docs/TECHNICAL_DOCUMENTATION.md)
- [Architecture and diagrams](docs/ARCHITECTURE.md)
- [System audit and prioritized findings](docs/SYSTEM_AUDIT.md)
- [API reference](docs/API_REFERENCE.md)
- [Documentation index and verification scope](docs/README.md)

Use the technical document's configuration instructions before starting the application. The current dependency set requires Node.js **22.12 or newer**; the existing backend Dockerfile still specifies Node 20 and has documented deployment defects. Production secrets and PostgreSQL credentials must be supplied outside Git.

For existing installations, review the audit findings before treating a passing build or a green health response as proof of production readiness.
