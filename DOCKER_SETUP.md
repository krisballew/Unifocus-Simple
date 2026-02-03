# Docker Setup Guide

This project uses Docker Compose to manage local development dependencies.

## Services Included

- **PostgreSQL 16** - Primary database with persistent volume
- **Redis 7** - Cache and session store with persistent volume

## Quick Start

### 1. Start Services

```bash
pnpm deps:start
```

This will:

- Start PostgreSQL on port 5432
- Start Redis on port 6379
- Create persistent volumes
- Initialize database with schema

### 2. Verify Services

```bash
docker-compose ps
```

### 3. View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f redis
```

## Database Management

### Run Migrations

```bash
pnpm db:migrate
```

### Reset Database (Development Only)

```bash
pnpm db:reset
```

This will:

- Stop and remove all containers
- Delete all volumes (data loss!)
- Recreate containers with fresh data

## Connecting to Services

### PostgreSQL

```bash
# Using psql
docker-compose exec postgres psql -U unifocus -d unifocus_dev

# Connection string
postgresql://unifocus:unifocus_dev_password@localhost:5432/unifocus_dev
```

### Redis

```bash
# Using redis-cli
docker-compose exec redis redis-cli

# Then authenticate
AUTH unifocus_dev_redis

# Connection string
redis://:unifocus_dev_redis@localhost:6379
```

## Environment Variables

All credentials are in `.env.example`. Copy to `.env` for local development:

```bash
cp .env.example .env
```

**Important**: Never commit `.env` - it's in `.gitignore`.

## Stopping Services

### Stop without removing data

```bash
pnpm deps:stop
```

### Stop and remove all data

```bash
docker-compose down -v
```

## Troubleshooting

### Port already in use

If ports 5432 or 6379 are already in use, stop the conflicting service:

```bash
# Check what's using the port
lsof -i :5432
lsof -i :6379

# Kill the process or change ports in docker-compose.yml
```

### Reset everything

```bash
docker-compose down -v
docker system prune -a
pnpm deps:start
```

## GitHub Codespaces

In Codespaces, Docker is automatically available and services start automatically via `postStartCommand`.

All ports are auto-forwarded:

- 3000 - Web App
- 3001 - API
- 5432 - PostgreSQL
- 6379 - Redis
