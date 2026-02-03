# Development Guide - Unifocus

## Quick Start

### Prerequisites

- Node.js 18+ (installed in dev container)
- Docker (for PostgreSQL and dependencies)
- AWS Account (for Cognito - development mode uses mock auth)

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment files
cp services/api/.env.example services/api/.env
cp apps/web/.env.example apps/web/.env

# Start dependencies (Docker)
./scripts/start-deps.sh

# Run database migrations and seed
cd services/api
pnpm db:migrate
pnpm db:seed

# Start API server
cd services/api
pnpm dev

# Start web app (in new terminal)
cd apps/web
pnpm dev
```

API: http://localhost:3001
Web: http://localhost:5173

## Project Structure

```
apps/web/                   # React frontend
├── src/
│   ├── services/          # Cognito auth, API client
│   ├── components/        # LoginPage, ProtectedRoute
│   ├── hooks/            # useAuth
│   └── App.tsx           # Main app with auth init
services/api/              # Fastify backend
├── src/
│   ├── plugins/          # Auth middleware, external plugins
│   ├── auth/             # RBAC helpers
│   ├── routes/           # API endpoints
│   └── config.ts         # Configuration
packages/                  # Shared packages
├── contracts/            # TypeScript types
├── ui/                   # Shared UI components
└── i18n/                 # Internationalization
infra/                    # Database, infrastructure
├── db/
│   ├── init/            # SQL schema initialization
│   └── migrations/      # Prisma migrations
```

## Authentication & Authorization

### For API Developers

#### Protecting Routes with RBAC

```typescript
import { createAuthorizationMiddleware } from './auth/rbac';

server.get(
  '/api/admin/users',
  {
    onRequest: createAuthorizationMiddleware({
      requireRoles: ['Admin', 'Manager'], // OR logic
      requireTenant: true,
    }),
  },
  async (request, reply) => {
    // Your handler
  }
);
```

#### Accessing Auth Context

```typescript
import { getAuthContext } from './auth/rbac';

const handler = async (request, reply) => {
  const context = getAuthContext(request);

  console.log(context.userId); // User ID from JWT
  console.log(context.tenantId); // Tenant ID from JWT
  console.log(context.roles); // User roles
  console.log(context.scopes); // User scopes
  console.log(context.email); // User email
};
```

#### Common Authorization Patterns

```typescript
import { hasRole, hasScope, canAccessResource, getAuthContext } from './auth/rbac';

const context = getAuthContext(request);

// Check role
if (hasRole(context, 'Manager')) {
  // Allow manager action
}

// Check scope
if (hasScope(context, 'write:properties')) {
  // Allow property write
}

// Check resource ownership (for employees, properties, etc.)
const canAccess = canAccessResource(
  context,
  'Manager', // Required role
  resourceId, // Resource owner (e.g., employee.userId)
  tenantId // Resource tenant
);
```

### For Frontend Developers

#### useAuth Hook

```typescript
import { useAuth } from './hooks/useAuth';

function MyComponent() {
  const { user, isAuthenticated, isLoading, error } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!isAuthenticated) return <div>Not logged in</div>;

  return <div>Welcome, {user?.email}!</div>;
}
```

#### API Client with Auto-Auth

```typescript
import { getApiClient } from './services/api-client';

const api = getApiClient();

// Automatically attaches Authorization header
const user = await api.getCurrentUser();
const properties = await api.getProperties();
const property = await api.getProperty(propertyId);
```

#### Protected Routes

```typescript
import { ProtectedRoute } from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';

<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>
```

## Database

### Prisma Commands

```bash
cd services/api

# Create migration
pnpm prisma migrate dev --name add_feature

# Apply migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Reset database (WARNING: deletes all data)
pnpm db:reset

# Open Prisma Studio UI
pnpm prisma studio
```

### Adding New Models

1. Update `services/api/prisma/schema.prisma`
2. Add `tenantId String` to all models (except Tenant itself)
3. Run: `pnpm prisma migrate dev --name model_name`
4. Implement routes with tenant scoping

### Multi-Tenant Best Practice

All queries MUST be filtered by `tenantId`:

```typescript
// ✓ Correct - tenant scoped
const properties = await prisma.property.findMany({
  where: {
    tenantId: context.tenantId,
    // additional filters
  },
});

// ✗ Wrong - accessible by all users
const properties = await prisma.property.findMany({
  where: {
    // missing tenantId filter!
  },
});
```

## Testing

### Unit Tests

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

### API Testing with cURL

```bash
# Get current user (requires valid JWT)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/me

# Test without auth (should fail)
curl http://localhost:3001/api/me
# Expected: 401 Unauthorized
```

### Mock Authentication (Development)

Set in `services/api/.env`:

```env
AUTH_SKIP_VERIFICATION=true
```

Then create mock tokens for testing:

```typescript
// In tests
const mockContext = {
  userId: 'test-user-id',
  email: 'test@example.com',
  tenantId: 'test-tenant-id',
  roles: ['Admin'],
  scopes: [],
};

// Store in request for testing
request.authContext = mockContext;
```

## Configuration

### Environment Variables

**API (.env):**

- `DATABASE_URL` - PostgreSQL connection string
- `COGNITO_*` - Cognito credentials (see COGNITO_SETUP.md)
- `AUTH_SKIP_VERIFICATION` - Set to `true` for development without Cognito
- `PORT` - API port (default: 3001)
- `LOG_LEVEL` - Logging level (debug, info, warn, error)

**Web (.env):**

- `VITE_API_BASE_URL` - API base URL
- `VITE_COGNITO_*` - Cognito OAuth credentials (see COGNITO_SETUP.md)

## Common Tasks

### Add New API Endpoint

```typescript
// services/api/src/routes/myfeature.ts
import { FastifyInstance } from 'fastify';
import { createAuthorizationMiddleware, getAuthContext } from '../auth/rbac';
import { prisma } from '../db';

export async function myfeatureRoutes(server: FastifyInstance) {
  server.get(
    '/api/myfeature',
    {
      onRequest: createAuthorizationMiddleware({
        requireRoles: ['Manager'],
        requireTenant: true,
      }),
    },
    async (request, reply) => {
      const context = getAuthContext(request);

      const data = await prisma.myModel.findMany({
        where: {
          tenantId: context.tenantId,
        },
      });

      return reply.send(data);
    }
  );
}

// Register in src/routes/index.ts
import { myfeatureRoutes } from './myfeature';

export async function setupRoutes(server: FastifyInstance) {
  await server.register(myfeatureRoutes);
}
```

### Add New React Component

```typescript
// apps/web/src/components/MyFeature.tsx
import React from 'react';
import { useAuth } from '../hooks/useAuth';

interface MyFeatureProps {
  title: string;
}

export const MyFeature: React.FC<MyFeatureProps> = ({ title }) => {
  const { user } = useAuth();

  return (
    <div>
      <h1>{title}</h1>
      <p>User: {user?.email}</p>
    </div>
  );
};
```

### Query API from Frontend

```typescript
import { getApiClient } from './services/api-client';

async function loadUserData() {
  const api = getApiClient();

  try {
    const user = await api.getCurrentUser();
    const tenants = await api.getTenants();
    // Use data...
  } catch (error) {
    console.error('Failed to load user data:', error);
  }
}
```

## Debugging

### API Debugging

```bash
# Enable verbose logging
LOG_LEVEL=debug pnpm dev

# Use VS Code debugger
# Set breakpoints in src/ files
# Run: pnpm dev
```

### Frontend Debugging

```bash
# Chrome DevTools
# Open http://localhost:5173
# Press F12 to open developer tools

# React DevTools
# Install browser extension
# Inspect component props/state
```

### Database Debugging

```bash
# Open Prisma Studio
pnpm prisma studio
# View/edit data at http://localhost:5555

# Query database directly
psql -U postgres -d unifocus -h localhost
# Use SQL commands to inspect data
```

## Performance

### Optimize API Queries

```typescript
// Use select to limit fields
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { id: true, email: true, roles: true },
});

// Use relations efficiently
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  include: {
    properties: { take: 10 }, // Limit related records
  },
});

// Batch queries
const [users, properties] = await Promise.all([
  prisma.user.findMany({ where: { tenantId } }),
  prisma.property.findMany({ where: { tenantId } }),
]);
```

### Frontend Performance

```typescript
// Memoize components
import { memo } from 'react';

export const MyComponent = memo(({ data }) => {
  return <div>{data}</div>;
});

// Use lazy loading for routes
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./Dashboard'));

<Suspense fallback={<Loading />}>
  <Dashboard />
</Suspense>
```

## Troubleshooting

### "Cannot find module" errors

```bash
# Rebuild workspace
pnpm install
pnpm build

# Clear caches
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Port already in use

```bash
# Find process using port
lsof -i :3001
lsof -i :5173

# Kill process
kill -9 <PID>
```

### Database connection refused

```bash
# Check if PostgreSQL is running
docker ps

# Start dependencies
./scripts/start-deps.sh

# Check DATABASE_URL in .env
echo $DATABASE_URL
```

### CORS errors in frontend

```typescript
// Update CORS in services/api/src/index.ts
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
};

server.register(require('@fastify/cors'), corsOptions);
```

## Resources

- [Prisma Documentation](https://www.prisma.io/docs/)
- [Fastify Documentation](https://www.fastify.io/docs/)
- [React Documentation](https://react.dev/)
- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Getting Help

- Check `COGNITO_SETUP.md` for authentication issues
- Check `README.md` for project overview
- Check `services/api/KNOWN_ISSUES.md` for API issues
- Ask in #engineering Slack channel
