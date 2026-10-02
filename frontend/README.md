# MedTrack Hub Frontend

> Modern medical education platform frontend built with Next.js 14, TypeScript, and Tailwind CSS.

[![Next.js](https://img.shields.io/badge/Next.js-14+-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3+-cyan.svg)](https://tailwindcss.com/)
[![shadcn/ui](https://img.shields.io/badge/shadcn/ui-Latest-purple.svg)](https://ui.shadcn.com/)

## Quick Start

First, install dependencies:

```bash
pnpm install
```

Then, run the development server:

```bash
pnpm dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Features

For a comprehensive overview of the project's features, please refer to the [main README](../../README.md).

## Project Structure

```
frontend/
├── src/
│   ├── app/              # App Router pages
│   ├── core/             # Core layout elements and providers
│   ├── features/         # Domain-driven features (dashboards, etc.)
│   ├── shared/           # Generic reusable components and hooks
│   ├── types/           # TypeScript definitions
│   └── lib/             # Utilities and configurations
├── public/              # Static assets
└── styles/             # Global styles
```

## Naming Conventions

To maintain architectural consistency, the following naming standards are enforced:

- **Files & Directories**: Use `kebab-case` for all filenames (e.g., `medical-education-dashboard.tsx`, `study-session.tsx`).
- **Components**: Exported React components should use `PascalCase` matching their purpose.
- **Interfaces**: Domain interfaces should use `PascalCase` and reside in `shared/types` or local feature `types` directories.

## Development

```bash
# Run with hot reload
pnpm dev

# Run type checking
pnpm type-check

# Run tests
pnpm test

# Build for production
pnpm build
```

## Environment Variables

Create a `.env.local` file:

```bash
BACKEND_URL=http://localhost:3002
AUTH_BACKEND_TIMEOUT_MS=30000
NEXT_PUBLIC_ANALYTICS_URL=http://localhost:5000
NEXT_PUBLIC_CLAUDE_API_KEY=your_claude_api_key
```

The browser sends API requests to the same-origin `/api/backend` proxy. For Vercel, set the server-only backend URL to `https://medtrackhubackend.onrender.com` and redeploy. Do not expose this value as a `NEXT_PUBLIC_*` variable. Configure these NextAuth variables for the Production environment as well:

```bash
BACKEND_URL=https://medtrackhubbackend.onrender.com
NEXTAUTH_URL=https://medical-two-eosin.vercel.app
NEXTAUTH_SECRET=<stable-random-secret>
```

`NEXTAUTH_SECRET` must be the same stable value across deployments. Generate it
with a password manager or a cryptographically secure random generator, and
store it only in Vercel Environment Variables. Do not commit production values
to source files.

## Learn More

- [Project Documentation](../docs/)
- [API Documentation](../docs/api/)
- [Contributing Guide](../docs/CONTRIBUTING.md)
## Progressive Web App and offline behavior

The production service worker caches versioned Next.js static assets and selected
same-origin public image, icon, and font files. API routes, including `/api/auth`
and `/api/backend`, are network-only so authenticated responses and mutations are
not persisted in Cache Storage. On activation, the worker removes legacy runtime
caches that may have stored API responses. If a navigation cannot be loaded while offline,
the service worker serves `public/offline.html`.

Supported quiz submissions and progress updates are stored in the
`medical-education-db` IndexedDB `syncQueue` store and sent through the
same-origin `/api/backend` proxy when connectivity returns. Temporary failures
use bounded retries; failed records remain available for manual retry from the
connectivity indicator. Existing progress records in
`medtrackhub-offline-progress` are copied to the unified queue during app
startup, then removed from the legacy queue only after the copy succeeds.

This does not currently guarantee that course pages, PDFs, or all learning
materials can be opened offline. Users should open/download required materials
while connected until explicit course-download support is implemented.

The service worker is registered by the root application component. When a new
worker is waiting, the app shows an update prompt; accepting it activates the
new worker and reloads the page. Browser Background Sync is used when available,
with foreground online/visibility sync as the fallback.
