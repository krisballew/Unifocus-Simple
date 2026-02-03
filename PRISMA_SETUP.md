# Prisma ORM Setup - Unifocus API

## Overview

This document describes the Prisma ORM setup for the Unifocus API with a comprehensive multi-tenant PostgreSQL schema.

## Installation

Prisma and Prisma Client have been installed in `services/api`:

- `@prisma/client@5.22.0` - Runtime client
- `prisma@5.22.0` - CLI and development tools

## Database Schema

### Core Multi-Tenant Structure

- **Tenant**: Top-level organization entity with `tenant_id` on all related tables
- **Property**: Physical locations/offices within a tenant
- **Department**: Organizational units within a property

### User Management

- **User**: System users with tenant/property/department scoping
- **Role**: Role definitions with permission arrays
- **UserRoleAssignment**: Links users to roles with optional property/department scoping

### Employee Management

- **Employee**: Employee records linked to properties
- **EmployeeJobAssignment**: Job title and department assignments with start/end dates

### Scheduling & Time Tracking

- **Schedule**: Weekly schedules assigned to employees
- **Shift**: Individual shifts within a schedule (day of week, start time, end time)
- **Punch**: Clock in/out records with timestamp and location data
- **Exception**: Absences, late arrivals, early departures, and manual adjustments

### Audit & Compliance

- **AuditLog**: Comprehensive audit trail of all entity changes

## Available Scripts

### Database Management

```bash
# Apply pending migrations
pnpm -F @unifocus/api db:migrate

# Run migrations in development (interactive)
pnpm -F @unifocus/api db:migrate:dev

# Seed the database with demo data
pnpm -F @unifocus/api db:seed

# Reset database (remove all data, re-run migrations, re-seed)
pnpm -F @unifocus/api db:reset
```

### Prisma Development

```bash
# Generate Prisma Client
pnpm -F @unifocus/api prisma:generate

# Open Prisma Studio (visual database browser)
pnpm -F @unifocus/api prisma:studio
```

## Demo Seed Data

The seed script creates:

- 1 demo tenant: "Demo Tenant"
- 2 properties: "Downtown Office" and "Uptown Office"
- 2 departments: "Engineering" and "Sales"
- 3 roles: "Admin", "Manager", "Employee"
- 2 users: admin and manager users
- 3 employees: Alice Johnson, Bob Smith, Carol White
- Job assignments for each employee
- Schedules and shifts for employees
- Sample punches and time tracking records
- Sample exceptions (absences)
- Audit log entries

## Environment Configuration

Configure the database connection in `services/api/.env`:

```env
DATABASE_URL="postgresql://unifocus:unifocus@localhost:5432/unifocus"
```

For development, you can use the docker-compose setup:

```bash
pnpm -F @unifocus/api db:reset  # This runs migrations and seeds automatically
```

## Multi-Tenant Design

Key features of the multi-tenant implementation:

1. **Tenant Isolation**: Every entity includes `tenantId` field for data segregation
2. **Property Scoping**: Most operations scoped to specific properties within a tenant
3. **Department Scoping**: User roles can be scoped to departments
4. **Cascading Deletes**: Deleting a tenant cascades to all related data
5. **Unique Constraints**: Composite unique constraints ensure data integrity per tenant

## Schema Migrations

- **0_init**: Initial schema with all tables, indexes, and foreign key relationships

To create new migrations during development:

```bash
pnpm -F @unifocus/api db:migrate:dev --name <migration-name>
```

## Next Steps

1. Start the database:

   ```bash
   cd /workspaces/Unifocus-Simple
   pnpm -F @unifocus/api db:reset
   ```

2. Generate Prisma Client:

   ```bash
   pnpm -F @unifocus/api prisma:generate
   ```

3. Integrate Prisma Client in API services:

   ```typescript
   import { PrismaClient } from '@prisma/client';
   const prisma = new PrismaClient();
   ```

4. Use Prisma Studio to explore data:
   ```bash
   pnpm -F @unifocus/api prisma:studio
   ```
