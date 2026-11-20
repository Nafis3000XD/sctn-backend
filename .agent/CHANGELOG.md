# Change log

Append a dated entry for each durable change. Include affected areas, verification, and deployment or follow-up status.

## 2026-11-20

- Added backend architecture, durable agent memory, executable endpoint inventory and standalone ignore rules for the private source export. Runtime code and migrations are unchanged.

## 2026-11-20 Docker and Vercel packaging

- Root Dockerfile runs Express and Prisma migrations. Vercel runs Express as a function with a separately configured PostgreSQL database.
- The integration workflow includes a Docker stack smoke test. Vercel project creation is separate from this release.
