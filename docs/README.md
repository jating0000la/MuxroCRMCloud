# MuxroCRM Cloud documentation

**Audit date:** 17 October 2026 · **Application baseline:** [`c5de389`](https://github.com/jating0000la/MuxroCRMCloud/commit/c5de38928b20af2fb1ca81333a220f5f2d1df659) on `main`.

| Document | Audience | Contents |
| --- | --- | --- |
| [Technical documentation](TECHNICAL_DOCUMENTATION.md) | Developers, QA and operators | Features, page inventory, API conventions, data dictionary, configuration, integration contracts, deployment and recovery procedures |
| [Architecture](ARCHITECTURE.md) | Technical leads and maintainers | System context, containers, module boundaries, data relationships, sequence diagrams, security boundaries and architectural tradeoffs |
| [System audit](SYSTEM_AUDIT.md) | Product owners and engineers | Confirmed defects, dependency findings, evidence, severity, remediation priorities and acceptance criteria |
| [API reference](API_REFERENCE.md) | Backend and integration developers | All 138 HTTP method/path combinations, authorization requirements and implementation links |
| [Audit evidence](AUDIT_EVIDENCE.json) | QA and future reviewers | Sanitized test results, environment versions, functional probes and dependency inventory |

The documents describe the implemented system at the baseline commit. Recommendations in the audit are **open work**, not completed repairs. This documentation update does not change application code, dependencies, schema or production data.

The review covered 131 backend TypeScript files, 96 frontend TypeScript/TSX files, 12 UI routes, 20 application tables, seven SQL migrations and five regression suites. It combined source review, builds, the existing 121 tests, isolated functional probes and browser checks. Passing checks do not override the separately reproduced defects.

The live VPS, its reverse-proxy configuration, real provider accounts and production traffic were not accessible for this audit. External API requests in functional verification were mocked. The report does not certify live delivery, production capacity or the VPS deployment state.

For feature-specific procedures, also see [Gupshup templates](../backend/TEMPLATE_MESSAGES.md) and [CloudConnect incoming IVR](../CLOUDCONNECT_INTEGRATION.md).

When the application changes, update the affected workflow, API and data-model descriptions together. Keep the audit baseline and evidence date explicit; close findings only after the stated acceptance criteria have been verified.
