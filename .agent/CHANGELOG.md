# Change log

Append a dated entry for each durable change. Include affected areas, verification, and deployment or follow-up status.

## 2026-11-20

- Added backend architecture, durable agent memory, executable endpoint inventory and standalone ignore rules for the private source export. Runtime code and migrations are unchanged.

## 2026-11-20 Docker and Vercel packaging

- Root Dockerfile runs Express and Prisma migrations. Vercel runs Express as a function with a separately configured PostgreSQL database.
- The integration workflow includes a Docker stack smoke test. Vercel project creation is separate from this release.

## 2026-11-20 Backend health monitoring

- Added a Docker image health check and removed the duplicate Compose probe. Documented the existing public endpoint and its response codes. The Docker VM smoke job verifies stack startup and readiness.
- Verified the probe against a custom port, HTTP 200, HTTP 503, redirects, and connection refusal. The existing Render endpoint returned HTTP 200. This Docker-only release skips Render auto-deploy.
