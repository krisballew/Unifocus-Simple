# Unifocus-Simple

A production-ready PNPM workspace monorepo with strict TypeScript, ESLint, Prettier, and CI/CD.

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose

### Installation

```bash
# Clone and install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start development dependencies (Postgres + Redis)
pnpm deps:start

# Run database migrations
pnpm db:migrate
```

### Development

Run all packages in development mode:

```bash
pnpm dev
```

This will start:

- Web app at http://localhost:3000
- API server at http://localhost:3001
- PostgreSQL at localhost:5432
- Redis at localhost:6379

## Workspace Structure

```
.
├── apps/web/              # React + Vite frontend
├── services/api/          # Express API server
├── packages/contracts/    # Shared TypeScript types
├── packages/ui/           # Shared React components
├── packages/i18n/         # Internationalization
├── infra/terraform/       # Infrastructure as code
└── docs/                  # Documentation
```

## Available Scripts

### Root Level

- `pnpm dev` - Start all packages in dev mode (parallel)
- `pnpm build` - Build all packages
- `pnpm test` - Run all tests
- `pnpm lint` - Lint all packages
- `pnpm typecheck` - Type check all packages
- `pnpm format` - Format all files with Prettier

### Database & Dependencies

- `pnpm deps:start` - Start PostgreSQL & Redis via Docker Compose
- `pnpm deps:stop` - Stop all Docker services
- `pnpm db:migrate` - Run database migrations
- `pnpm db:reset` - Reset database (development only)

## Configuration

### TypeScript

- Strict mode enabled with comprehensive type checking
- Project references for incremental builds

### ESLint

- TypeScript strict type checking
- Import sorting and validation

### Git Hooks

- **pre-commit**: Runs lint-staged
- **pre-push**: Runs type checking

## CI/CD

GitHub Actions workflow includes linting, type checking, testing, and building.

## Deployment

### AWS Infrastructure

Deploy infrastructure using Terraform:

```bash
# Navigate to dev environment
cd infra/terraform/environments/dev

# Initialize and apply
terraform init
terraform apply
```

See [DEPLOYMENT_RUNBOOK_DEV.md](DEPLOYMENT_RUNBOOK_DEV.md) for complete deployment procedure.

### Deployment Workflows

- **API**: `.github/workflows/deploy-api-dev.yml` - Deploys to ECS on push to main
- **Web**: `.github/workflows/deploy-web-dev.yml` - Deploys to S3/CloudFront on push to main

### Pre-Deployment Validation

```bash
# Validate all configurations before deploying
npx tsx scripts/validate-deployment.ts dev
```

### E2E Smoke Test

```bash
# Test deployed environment
npx tsx scripts/e2e-dev-smoke.ts https://your-api-url.com
```

For detailed deployment instructions, see:

- [DEPLOYMENT_RUNBOOK_DEV.md](DEPLOYMENT_RUNBOOK_DEV.md) - Step-by-step deployment guide
- [docs/TERRAFORM_DEPLOYMENT.md](docs/TERRAFORM_DEPLOYMENT.md) - Terraform setup
- [docs/DEPLOYMENT_DEV.md](docs/DEPLOYMENT_DEV.md) - Environment variables guide
- [docs/COMPLETE_DEPLOYMENT_GUIDE.md](docs/COMPLETE_DEPLOYMENT_GUIDE.md) - Full deployment status

## GitHub Codespaces

Fully configured for one-command development:

1. Open in Codespaces - dependencies install automatically
2. Docker Compose starts PostgreSQL & Redis
3. Database is initialized with schema
4. `pnpm dev` starts automatically

Ports automatically forwarded:

- 3000 (Web App)
- 3001 (API)
- 5432 (PostgreSQL)
- 6379 (Redis)

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret for JWT tokens
- `VITE_API_URL` - API URL for web app
