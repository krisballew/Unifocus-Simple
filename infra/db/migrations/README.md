# Database Migrations

This directory contains database migration files.

## Migration Strategy

Migrations are currently managed manually via SQL files in the `init/` directory for initial schema setup. For production, consider using a migration tool:

- **Prisma**: Full-featured ORM with migrations
- **TypeORM**: Popular ORM with migration support
- **node-pg-migrate**: Lightweight PostgreSQL migration tool
- **Drizzle**: Type-safe SQL toolkit

## Running Migrations

```bash
# Apply all migrations
pnpm db:migrate

# Reset database (development only)
pnpm db:reset
```

## Creating Migrations

1. Add SQL files to `infra/db/init/` for initial schema
2. Add versioned migrations to `infra/db/migrations/`
3. Name them with timestamps: `YYYYMMDDHHMMSS-description.sql`
