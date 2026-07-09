# Deploying MediCore HMS to Production

This covers taking the project from your local machine → GitHub → a real server.
Local development (`npm run dev`) is unaffected by anything here — read this when
you're ready to actually put it live.

## 1. Before you push to GitHub

- [ ] Confirm no `.env` file is tracked: `git status` should never show `.env`,
      only `.env.example`. It's already in `.gitignore`, but double-check with
      `git check-ignore -v backend/.env` (should print a match).
- [ ] Change every demo password before deploying anywhere reachable by the
      public: `admin@medicore.com / Admin@1234`, the doctor and front-office
      demo logins are **seed data for local testing only**. Either don't run
      `npm run seed` in production, or immediately change those passwords via
      the app after seeding.
- [ ] Generate fresh `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` for production
      — never reuse the ones from your local `.env`:
      `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- [ ] Decide on a license for the repo (this project ships without one, which
      by default means "all rights reserved" — add a `LICENSE` file if you
      intend this to be open source, or leave it out if it's a private/
      commercial product).

## 2. Running the full stack with Docker (recommended)

This repo now includes a `Dockerfile` for the backend, a `Dockerfile` for the
frontend (built + served via nginx), and a root `docker-compose.yml` that wires
them together with MySQL.

```bash
cp .env.example .env
# edit .env: set MYSQL_ROOT_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
# and CORS_ORIGIN to match wherever the frontend will actually be served from

docker compose up -d --build
```

This starts:
- `mysql` — persisted to a named volume (`mysql_data`), survives restarts
- `backend` — runs `prisma migrate deploy` automatically on every start (safe
  no-op if already up to date), then serves the API on port 5000
- `frontend` — built static assets served by nginx on port 8080, which also
  reverse-proxies `/api/*` to the backend container so everything is
  same-origin (no CORS configuration needed between them)

First run only — seed demo data (optional, skip in a real production deploy):
```bash
docker compose exec backend npm run seed
```

Visit `http://localhost:8080`.

### Deploying to a real server / cloud

The compose file works as-is on any VM with Docker installed (a $5-10/mo VPS
is enough to start). For managed platforms:
- **Backend**: any container host (Render, Railway, Fly.io, ECS, a plain VPS).
  Set the same env vars as in `backend/.env.example`. Point `DATABASE_URL` at
  a managed MySQL instance (PlanetScale, RDS, Railway MySQL, etc.) instead of
  the `mysql` container if you want managed backups/scaling.
- **Frontend**: can also be deployed separately as static files (Vercel,
  Netlify, S3+CloudFront) instead of the nginx container. If you do this, set
  `VITE_API_URL` at build time to the backend's public URL (see
  `frontend/.env.example`) since the two will no longer be same-origin.

## 3. CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main`/`master`/`develop`:
- Backend: installs deps, generates the Prisma client, validates the schema,
  syntax-checks every file
- Frontend: installs deps, lints (non-blocking), builds
- Both Docker images build cleanly

This catches the two most common "worked on my machine" failures — a bad
Prisma schema change, and a build-breaking frontend bug — before they reach
`main`. Add a deploy job to this workflow once you've picked a hosting target
(the exact steps depend on where you deploy, so it's left for you to wire in).

## 4. Security checklist already in place

These are already implemented — nothing to add, just confirming before you go
live:
- `helmet()` sets standard security headers
- `express-rate-limit` throttles repeated requests
- CORS is restricted to `CORS_ORIGIN`, not wide open
- JWT access + refresh token rotation, bcrypt password hashing
- Stack traces are never sent to the client in production (`NODE_ENV=production`
  suppresses them — confirm this is set in your deploy environment)
- RBAC permission checks on every route via `authorize(module, action)`
- Audit logging on mutations across modules

## 5. What's still on you

- **TLS/HTTPS** — this repo doesn't configure certificates. Put the frontend
  nginx (or your static host) behind HTTPS via your platform's built-in TLS
  (most managed hosts do this automatically) or a reverse proxy like Caddy/
  Traefik with Let's Encrypt if self-hosting.
- **Database backups** — the compose file's `mysql_data` volume persists data
  across restarts but isn't backed up anywhere. Set up scheduled `mysqldump`
  or use a managed MySQL provider with automated backups.
- **Monitoring/alerting** — the app logs to stdout (via `winston`); wire that
  into whatever log aggregation your host provides (most container platforms
  capture stdout automatically).
- **Third-party API keys** — WhatsApp/SMS reminders and real AI prescription
  suggestions need your own Twilio/MSG91/WhatsApp/OpenAI/Gemini credentials in
  production; both work with safe fallbacks if left unset.
