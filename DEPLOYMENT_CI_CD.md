CI/CD overview

This repository contains a GitHub Actions workflow to build Docker images for the backend and rust_analytics service, push them to GitHub Container Registry (GHCR), create Koyeb apps if missing, trigger Koyeb deployments, and optionally run smoke tests.

The Rust analytics image is built from `rust_analytics/` with `protos/` supplied as an additional build context, so local `docker compose up --build` and the GitHub Actions workflows use the same layout.

Workflow: `.github/workflows/deploy-to-koyeb.yml`

Required GitHub secrets

- `CR_PAT` — Personal Access Token for GHCR (scopes: `write:packages`, `read:packages`, `delete:packages` if you plan to delete images)
- `KOYEB_API_TOKEN` — Koyeb API token (used to create apps and trigger deployments)
- `KOYEB_APP_BACKEND` — (optional) existing Koyeb app id for backend; if omitted the workflow will create a new app
- `KOYEB_APP_RUST` — (optional) existing Koyeb app id for rust service; if omitted the workflow will create a new app
- `NEON_DATABASE_URL` — Neon Postgres connection string (set as `DATABASE_URL` in Koyeb app)
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis REST credentials
- `CLOUDINARY_URL` or `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` — Cloudinary credentials
- Cloudflare R2 (if used): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
- `JWT_SECRET`, `NEXTAUTH_SECRET` — application secrets
- `BACKEND_HEALTH_URL` and `RUST_HEALTH_URL` — (optional) URLs used by smoke tests after deployment

How it works

- On push to `main`, the workflow builds two images using `docker/build-push-action` and pushes them to GHCR using `CR_PAT`.
- The `ensure-koyeb-apps` job creates Koyeb apps via the Koyeb REST API if `KOYEB_APP_BACKEND`/`KOYEB_APP_RUST` are not provided.
- The `deploy-to-koyeb` job triggers new deployments for each app by posting a deployment with the new image.
- The `smoke-tests` job runs optional health checks against provided health-check URLs.

Notes

- The workflow requires `jq` and `curl` on the runner.
- If you prefer Docker Hub instead of GHCR, update the login and push steps accordingly.
- For Neon, create a database and set `NEON_DATABASE_URL` in GitHub secrets; set `DATABASE_URL` in the Koyeb app environment variables to this value.

Usage

1. Add required secrets in the GitHub repository settings.
2. Optionally add existing Koyeb app ids to `KOYEB_APP_BACKEND` and `KOYEB_APP_RUST`.
3. Push to `main` or open a PR to test the build steps.

If you want, I can:
- Add a step to register environment variables on created Koyeb apps automatically
- Replace GHCR with Docker Hub or another registry
- Add a post-deploy migration step for Prisma/Neon
