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
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_ANALYTICS_URL=http://localhost:5000
NEXT_PUBLIC_CLAUDE_API_KEY=your_claude_api_key
```

## Learn More

- [Project Documentation](../docs/)
- [API Documentation](../docs/api/)
- [Contributing Guide](../docs/CONTRIBUTING.md)
