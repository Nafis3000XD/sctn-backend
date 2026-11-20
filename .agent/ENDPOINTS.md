# SCTN HTTP endpoint inventory

Generated from Express router registrations by node .agent/generate-endpoints.cjs. Paths are relative to the same host.

## Platform and frontend

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /healthz | Public backend and PostgreSQL readiness. Returns HTTP 200 when ready and HTTP 503 when the database query fails. |
| GET | /assets/* | Production frontend assets |
| GET | /{*route} | SPA fallback after API and upload mounts |

## /uploads

Bearer session or scoped media cookie with file owner, authority or prescription consent checks.

Source: [route file](../src/routes/uploadRoutes.ts)

| Method | Path |
| --- | --- |
| GET | /uploads/:id |

## /api/auth

Registration and login are public and rate-limited. Logout clears the media cookie. Profile-picture requires a bearer session.

Source: [route file](../src/routes/authRoutes.ts)

| Method | Path |
| --- | --- |
| POST | /api/auth/register |
| POST | /api/auth/login |
| POST | /api/auth/logout |
| POST | /api/auth/profile-picture |

## /api/citizen

Citizen bearer session. Verification rechecks the password and binds a short-lived grant to the current session and IP. Lists and submissions are scoped to the caller.

Source: [route file](../src/routes/citizenRoutes.ts)

| Method | Path |
| --- | --- |
| GET | /api/citizen/profile |
| GET | /api/citizen/alerts |
| GET | /api/citizen/change-requests |
| POST | /api/citizen/change-requests/verify |
| POST | /api/citizen/change-requests |
| GET | /api/citizen/support-messages |
| POST | /api/citizen/support-messages |
| GET | /api/citizen/fines |
| GET | /api/citizen/crime-logs |

## /api/documents

Citizen bearer session. Upload accepts multipart field document and type metadata.

Source: [route file](../src/routes/documentRoutes.ts)

| Method | Path |
| --- | --- |
| POST | /api/documents/upload |
| GET | /api/documents |

## /api/consent

Citizen bearer session. Consent controllers enforce ownership.

Source: [route file](../src/routes/consentRoutes.ts)

| Method | Path |
| --- | --- |
| GET | /api/consent/requests |
| POST | /api/consent/respond |
| POST | /api/consent/revoke |
| GET | /api/consent/history |

## /api/verifier

Verifier or Admin bearer session. Individual routes and controllers enforce narrower role and consent rules.

Source: [route file](../src/routes/verifierRoutes.ts)

| Method | Path |
| --- | --- |
| POST | /api/verifier/request-access |
| POST | /api/verifier/evaluate-policy |
| GET | /api/verifier/consents |
| GET | /api/verifier/medical/visit-logs/:citizenId |
| POST | /api/verifier/medical/visit-logs |
| DELETE | /api/verifier/medical/visit-logs/:id |
| POST | /api/verifier/medical/emergency |
| GET | /api/verifier/crime/fines/:citizenId |
| POST | /api/verifier/crime/fines |
| PATCH | /api/verifier/crime/fines/:id |
| DELETE | /api/verifier/crime/fines/:id |
| GET | /api/verifier/crime/crime-logs/:citizenId |
| POST | /api/verifier/crime/crime-logs |
| PATCH | /api/verifier/crime/crime-logs/:id |
| DELETE | /api/verifier/crime/crime-logs/:id |
| GET | /api/verifier/citizen-profile/details/:citizenId |
| GET | /api/verifier/citizen-lookup/:citizenId |

## /api/admin

Admin bearer session. Admin decisions atomically apply approved corrections.

Source: [route file](../src/routes/adminRoutes.ts)

| Method | Path |
| --- | --- |
| GET | /api/admin/stats |
| GET | /api/admin/change-requests |
| GET | /api/admin/change-requests/pending-count |
| POST | /api/admin/change-requests/:id/decision |
| GET | /api/admin/fraud-alerts |
| POST | /api/admin/fraud-alerts/resolve |
| GET | /api/admin/users |
| POST | /api/admin/users |
| POST | /api/admin/users/toggle-status |
| GET | /api/admin/audit-logs |
| GET | /api/admin/consent-requests |
| GET | /api/admin/support-tickets |
| GET | /api/admin/support-tickets/:citizenId |
| POST | /api/admin/support-tickets/:citizenId |
| POST | /api/admin/support-tickets/:citizenId/status |
