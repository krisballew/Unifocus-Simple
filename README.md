# Unifocus-Simple

A production-ready PNPM workspace monorepo with strict TypeScript, ESLint, Prettier, and CI/CD.

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+

### Installation

```bash
pnpm install
```

### Development

Run all packages in development mode:

```bash
pnpm dev
```

This will start:

- Web app at http://localhost:3000
- API server at http://localhost:3001

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

## GitHub Codespaces

Fully configured for one-command development. The `postStartCommand` runs `pnpm dev` automatically.
