CI/CD Overview & Deployment Guidelines

This repository contains GitHub Actions workflows and Docker configuration to build container images for the backend, frontend, and rust_analytics services.

1. Single Source of Truth for Protobufs
- The protobuf definitions live exclusively in `./protos/analytics.proto` at the repository root.
- `rust_analytics/Dockerfile` dynamically inspects the build context and resolves `./protos` natively whether built from root repository context (`.`) or from subfolders (`rust_analytics/`). No duplicate proto files are needed or maintained.

2. Non-Root Docker Image Permissions
- Both `backend/Dockerfile` and `frontend/Dockerfile` use `COPY --chown=node:node` to set file ownership during copy, with `USER node` positioned after file placement for production security.

3. Dynamic Frontend Base URLs
- All frontend URL utilities ([frontend/src/lib/urls.ts](file:///c:/Users/user/medical/frontend/src/lib/urls.ts)) dynamically construct origins based on `window.location.origin` in the browser or environment variables (`NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_APP_URL`, `VERCEL_URL`) on the server.
- No static or unpurchased domain names are hardcoded.

4. Workflows: `.github/workflows/deploy.yml` and `.github/workflows/ci.yml`

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
