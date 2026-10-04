# MedTrack Hub Backend

> Secure, scalable backend for medical education platform built with NestJS

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11+-red.svg)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7+-red.svg)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Features

For a comprehensive overview of the project's features, please refer to the [main README](../../README.md).

## 🛠️ Tech Stack

- **Framework**: NestJS (Node.js)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma
- **Cache**: Redis with ioredis
- **Authentication**: JWT with Passport
- **Password Hashing**: Argon2
- **2FA**: Speakeasy (TOTP)
- **File Storage**: AWS S3
- **AI**: Anthropic Claude API
- **Testing**: Jest (Unit, Integration, E2E)
- **Documentation**: Swagger/OpenAPI
- **Validation**: class-validator & class-transformer
- **Rate Limiting**: @nestjs/throttler
- **Health Checks**: @nestjs/terminus
- **Containerization**: Docker

## System architecture

- **Frontend**: Next.js with TypeScript and Tailwind CSS, deployed separately
  from the API.
- **Backend**: NestJS with TypeScript; it serves the versioned `/v1` API and
  owns authentication, application logic, and database access.
- **Analytics**: Rust service, deployed alongside the backend and connected
  privately over gRPC.
- **Database**: PostgreSQL, accessed by the backend through Prisma and by the
  analytics service through SQLx.
- **Authentication**: NextAuth handles the frontend session; the backend
  verifies Google ID tokens and issues the app's access and refresh tokens.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env
# Edit .env with your configuration
```

### Development

```bash
# Start in development mode
pnpm run start:dev

# Start with debug mode
pnpm run start:debug

# Build for production
pnpm run build

# Start production server
pnpm run start:prod
```

### Testing

```bash
# Run unit tests
pnpm run test

# Run e2e tests
pnpm run test:e2e

# Run integration tests
pnpm run test:integration

# Run all tests
pnpm run test:all

# Generate test coverage
pnpm run test:cov
```

## Deployment

### Deploy backend and Rust analytics together on Render

The [backend Dockerfile](./Dockerfile) builds both services into one image. Configure the Render web service with the repository root (`.`) as its root directory and `backend/Dockerfile` as its Dockerfile path. Set the service environment variables required by the backend and Rust analytics, including `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `RUST_ANALYTICS_API_KEY`.

Keep `ENABLE_GRPC=true`. The image starts Rust analytics first and configures the backend to call it at `127.0.0.1:50051`; do not expose port `50051` publicly. Render should route HTTP to the backend on its `PORT`. The frontend can remain on Vercel, and managed database, Redis, and file-storage services can remain external.

The Node backend uses up to 3 PostgreSQL connections by default, and Rust analytics uses up to 2. Set `DATABASE_POOL_MAX` and `RUST_ANALYTICS_DB_MAX_CONNECTIONS` to lower or raise these per-process limits according to the database plan's connection cap and the number of running instances. The maximum across this combined service is 5 connections per instance, so account for every running instance and any other app using the same database.

### Production smoke checklist

- Open the signed-out landing page and use the Features and Courses navigation
  links; both should reach their landing-page sections without requiring login.
- Open a protected app page while signed out; confirm it redirects to login and
  returns to the requested page after authentication.
- Check `GET /health` for the backend liveness response and `GET /health/full`
  for database, Redis, memory, and disk status.
- Confirm Google sign-in is configured in both deployments. Test existing-user
  sign-in and new student signup with a verified Google email; new signup must
  require accepting the Terms of Service.
- Check the landing page and chat at 320, 375, 768, and 1280 CSS pixels. In
  chat, verify conversation selection, the mobile back action, long messages,
  and message sending.

### Google Shared Drive course materials

New public/library uploads continue to use the configured R2/S3 storage provider. Instructors can also attach an existing file from the institution's Shared Drive without copying its bytes into R2. Drive-backed materials are streamed through the authenticated materials preview endpoint; only course creators, assigned instructors, admins, active/completed course enrollees, and active members of an active study group explicitly linked to that course can read them.

To enable Drive-backed materials:

1. Enable the Google Drive API in the institution's Google Cloud project and create a service account.
2. Add the service account email as a **Viewer** of the institution's Shared Drive. Keep instructors as the people who add/manage course files there.
3. Configure these backend secrets in the deployment environment (do not commit service-account credentials):

	- `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`: the service-account JSON credential object.
	- `GOOGLE_DRIVE_SHARED_DRIVE_ID`: the ID of the Shared Drive used for course materials.

4. Restart the backend. Instructors can then choose **Google Drive** on the material upload page and attach a Shared Drive file URL to a course unit/topic.

Only files in the configured Shared Drive are accepted. PDFs and native Google Docs, Sheets, and Slides are supported; Google-native documents are exported to PDF for the in-app reader. Existing R2 files are unchanged and should not be deleted as part of enabling this integration.

### Personal Google Drive links

Users can also connect their own Google account with the read-only Drive scope to link files shared with them, including folders under **Shared with me**. These links do not copy file contents into MedTrack storage. The user's encrypted refresh token is stored in `google_drive_connections`, and Drive files are read through that account when opened. Configure `GOOGLE_DRIVE_OAUTH_CLIENT_ID`, `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`, `GOOGLE_DRIVE_OAUTH_REDIRECT_URI` (the backend callback URL, including `/v1/materials/drive/oauth/callback`), `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY` (base64-encoded 32-byte key), and `FRONTEND_URL`. Add the exact callback URL to the Google OAuth client's authorized redirect URIs and enable the Google Drive API. Run the new migration before deploying the OAuth flow.

Drive-backed materials can be linked at course level (for example, a textbook), unit level, or topic level. Class sharing remains disabled unless explicitly enabled.

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).