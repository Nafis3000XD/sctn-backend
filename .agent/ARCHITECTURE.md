# Backend architecture

The API uses Express 5 on Node.js 24, TypeScript, Prisma 5, PostgreSQL, Zod, bcrypt, JWT and Multer.

| Code | Responsibility |
| --- | --- |
| `src/index.ts`, `src/app.ts` | Boot, `PORT` binding, readiness, middleware, routers, SPA and assets, shutdown |
| `src/db.ts`, `src/bootstrapAdmin.ts` | Shared Prisma client and idempotent first-admin bootstrap |
| `src/routes` | Public auth and role-scoped API routes. See [complete endpoint inventory](ENDPOINTS.md) |
| `src/middlewares`, `src/validation` | Authentication, active account and role checks, rate limits, validation |
| `src/controllers/authController.ts`, `citizenController.ts` | Sign-in, registration, citizen profile reads, support and alerts |
| `src/controllers/changeRequestController.ts` | Re-verification grant, submissions, admin decisions and audit |
| `src/utils/changeRequestFields.ts` | Field catalog, intent matcher and validated correction values |
| `src/controllers/verifierController.ts`, `consentController.ts`, `src/utils/consentScopes.ts` | Consent, verifier scopes, medical and crime workflows |
| `src/controllers/adminController.ts` | Administration, account activation, fraud, logs and support threads |
| `src/utils/upload.ts`, `src/utils/mediaSession.ts`, `src/routes/uploadRoutes.ts` | File validation, PostgreSQL persistence and owner/authority/consent checks |
| `prisma/schema.prisma`, `prisma/migrations` | PostgreSQL data model and migration history |
| `tests/` | Vitest and Supertest |

## Data model

`User` is the account and role root. `CitizenProfile` owns Identity, Education, Financial, Medical and Crime records. Medical records own hospital visits. Crime records own fine and crime logs. `Document` stores document references. `UploadedFile` stores upload content and ownership. `ConsentRequest`, `AuditLog`, `FraudAlert`, `SupportMessage` and `ProfileChangeRequest` record application workflows.

For runtime variables, Render paths, safe release steps, and SSH limits, see the [integration runbook](https://github.com/Nafis3000XD/sctn-web/blob/main/.agent/RUNBOOK.md). Keep the API and the SPA same-origin in production. Database connections must remain private.

## Deployment entry points

Root Dockerfile runs Express and Prisma migrations. Vercel runs Express as a function with a separately configured PostgreSQL database. See [deployment setup](DEPLOYMENT.md).
