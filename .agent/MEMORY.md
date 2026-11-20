# Backend memory

- The integrated repo is [sctn-web](https://github.com/Nafis3000XD/sctn-web). This repo exports `backend/`. Render deploys the integrated repo and uses private PostgreSQL.
- The runtime binds `0.0.0.0` to `PORT`. `/healthz` performs a database query. Express expects integrated frontend build output in sibling `frontend/dist`.
- Production configuration: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, plus `NODE_ENV` and Render-provided `PORT`/`RENDER`. The local `.env` and database files are ignored.
- Verification grants expire after 15 minutes and are scoped to the bearer session and observed IP. Requests store a masked network label. Admin review applies approved values and status atomically and rejects stale comparisons on changed fields.
- Database startup uses `prisma migrate deploy`, never a reset. Current migrations are `0_init` and `1_profile_change_requests`. Preserve applied migration files and add successors for new changes.
- All uploads use access checks and database persistence. Free hosting's ephemeral filesystem is not used for long-lived records.
