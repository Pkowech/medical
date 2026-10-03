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

The Node backend uses up to 3 PostgreSQL connections by default, and Rust analytics uses up to 2. Set `DATABASE_POOL_MAX` and `RUST_ANALYTICS_DB_MAX_CONNECTIONS` to lower or raise these per-process limits according to the database plan's connection cap and the number of running instances.

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