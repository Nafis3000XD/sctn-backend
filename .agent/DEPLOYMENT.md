# Backend deployment

## Docker on a VM

From the repository root, run `docker build -t sctn-backend .`. Use the [integration Compose runbook](https://github.com/Nafis3000XD/sctn-web/blob/main/.agent/RUNBOOK.md#docker-on-a-vm) to start all components. For a standalone API container, supply `DATABASE_URL`, `JWT_SECRET` and initial `ADMIN_EMAIL` and `ADMIN_PASSWORD` through a private runtime environment. The entrypoint runs Prisma migrations and administrator bootstrap before starting the API on port 3000. Set `SCTN_RUN_MIGRATIONS=0` on instances whose migrations and bootstrap run in a separate release job. Enable `SCTN_TRUST_PROXY=1` only behind a single trusted proxy.

## Vercel

Import this repo as an Express project with Root Directory at the repo root. Set `DATABASE_URL` to a PostgreSQL connection string reachable by Vercel. Set `JWT_SECRET` to a strong random secret. Use independent preview and production databases. Keep admin bootstrap credentials in a private operator environment.

From a trusted machine with DB access and the target environment configured, run `npm ci`, `npm run build`, `npm run db:deploy`, and `npm run admin:bootstrap`. The last command uses `ADMIN_EMAIL` and `ADMIN_PASSWORD` if an active administrator needs to be created. Run migrations once per release before sending traffic to the new app version.

Verify `/healthz`, login and private media through the frontend URL. Vercel Functions limit requests and responses to 4.5 MB including upload overhead. Docker and Render retain the existing application upload limits. See [Vercel Functions limits](https://vercel.com/docs/functions/limitations).
