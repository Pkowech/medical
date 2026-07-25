**Render / CI Build Instructions**

- **Goal:** Build `rust_analytics` and `backend` from small, per-service Docker build contexts while sharing `protos/` from the repo root.

1) Pre-build: sync protos into each service folder

 - Linux / macOS:
   ```bash
   ./scripts/sync-protos.sh
   ```

 - Windows (PowerShell):
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-protos.ps1
   ```

2) Render service settings (for each service)

 - `Dockerfile Path`:
   - rust_analytics: `rust_analytics/Dockerfile`
   - backend: `backend/Dockerfile`

 - `Docker Build Context Directory`:
   - rust_analytics: `rust_analytics`
   - backend: `backend`

 - Build Command (optional pre-build step): run the sync script before the build if Render does not expose the repo root as a multi-context build. Example (Unix):
   ```bash
   bash ./scripts/sync-protos.sh
   ```

 - Environment variables (set in Render dashboard):
   - `DATABASE_URL` — required if you want `prisma migrate deploy` to run during startup/build.

3) GitHub Actions (example) — runs sync then builds both images locally (useful for CI tasks):

```yaml
name: Build Services
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Sync protos
        run: |
          ./scripts/sync-protos.sh
      - name: Build rust_analytics image
        run: |
          docker build -t rust_analytics:ci -f rust_analytics/Dockerfile rust_analytics
      - name: Build backend image
        run: |
          docker build -t medtrack-backend:ci -f backend/Dockerfile backend

```

Notes
- The `sync-protos` scripts copy `protos/` into `rust_analytics/protos` and `backend/protos` temporarily — they do not commit anything.
- Prefer per-service build contexts (recommended) because they minimize upload size and avoid dangling image pulls.
- If you need fully reproducible Rust builds, add and commit `rust_analytics/Cargo.lock`.
