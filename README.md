# SCTN backend

Private Express/Prisma source export from [SCTN](https://github.com/Nafis3000XD/sctn-web). Read [AGENTS.md](AGENTS.md) and the [endpoint inventory](.agent/ENDPOINTS.md).

Use Node.js 24 and PostgreSQL. Copy `.env.example` to `.env` only when needed and set local configuration there. Run `npm ci`, `npm run build`, `npm run db:deploy`, and `npm run admin:bootstrap`. Use `npm run dev` for hot reload or `npm start` to serve the compiled app. The API defaults to port 3000. For the SPA in production mode, build the [frontend](https://github.com/Nafis3000XD/sctn-frontend) in a sibling directory named `frontend`.

Run `npm test` for backend checks. See the [integration runbook](https://github.com/Nafis3000XD/sctn-web/blob/main/.agent/RUNBOOK.md) for Render operations.
