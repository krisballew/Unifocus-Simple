# Unifocus API - Production Fastify Implementation

## Overview

The Unifocus API is now powered by Fastify 5.7.4, a production-ready Node.js web framework optimized for performance and TypeScript support. The implementation features a modular architecture with comprehensive error handling, automatic request/response validation, and OpenAPI documentation.

## Architecture

### Core Components

1. **Server Factory** ([src/server.ts](src/server.ts))
   - Configurable Fastify instance with pino logging
   - Zod-based request/response validation
   - Correlation ID tracking via `x-correlation-id` header
   - TypeScript type provider for automatic type inference

2. **Configuration** ([src/config.ts](src/config.ts))
   - Environment-based configuration
   - Type-safe config interface
   - Validates required environment variables

3. **Plugin System** ([src/plugins/](src/plugins/))
   - **external.ts**: Third-party plugins (CORS, Swagger)
   - **error-handler.ts**: Global error handling and request logging
   - **index.ts**: Plugin registration orchestration

4. **Route Modules** ([src/routes/](src/routes/))
   - **health.ts**: Liveness (`/health`) and readiness (`/ready`) probes
   - **tenants.ts**: Full CRUD operations for tenant management
   - **auth.ts**: Authentication endpoints (placeholder implementation)
   - **index.ts**: Route registration

## Features

### ✅ Implemented

- **Fastify 5.7.4** - High-performance web framework
- **Zod Validation** - Runtime type checking via `fastify-type-provider-zod`
- **OpenAPI/Swagger** - Interactive API documentation at `/docs`
- **CORS** - Configurable cross-origin resource sharing
- **Error Handling** - Centralized error handling with proper status codes
- **Logging** - Structured logging with pino (pretty printing in dev)
- **Correlation IDs** - Request tracking via `x-correlation-id` header
- **Health Checks** - Liveness and readiness endpoints with DB/Redis checks
- **Modular Routes** - Organized by domain (tenants, auth, health, etc.)
- **Type Safety** - Full TypeScript support with automatic type inference
- **ESM Support** - Native ES modules throughout

### 🚧 In Progress

- Unit tests (test runner compatibility issue - see [KNOWN_ISSUES.md](KNOWN_ISSUES.md))
- Database integration (PostgreSQL via Drizzle ORM - planned)
- Redis integration (caching and sessions - planned)
- JWT authentication (placeholder routes exist)

### 📋 Planned

- Additional route modules:
  - Properties (`/api/properties`)
  - Employees (`/api/employees`)
  - Scheduling (`/api/scheduling`)
  - Time tracking (`/api/time`)
  - Housekeeping (`/api/housekeeping`)
- Rate limiting
- Request validation middleware
- Database connection pooling
- Redis caching layer
- Authentication middleware
- Authorization (RBAC)

## API Endpoints

### Health & Readiness

```
GET /health
Response: { status: "ok", timestamp: string, uptime: number }
```

```
GET /ready
Response: {
  status: "ready" | "not_ready",
  timestamp: string,
  checks: { database: "ok" | "error", redis: "ok" | "error" }
}
```

### Tenants

```
GET    /api/tenants       - List all tenants
GET    /api/tenants/:id   - Get tenant by ID
POST   /api/tenants       - Create new tenant
PUT    /api/tenants/:id   - Update tenant
DELETE /api/tenants/:id   - Delete tenant
```

### Authentication (Placeholder)

```
POST /api/auth/login      - User login
POST /api/auth/register   - User registration
```

## Development

### Start Dev Server

```bash
cd services/api
pnpm dev
```

Server starts on `http://localhost:3001`

### Environment Variables

Required variables (see [.env.example](../../.env.example)):

- `PORT` - Server port (default: 3001)
- `HOST` - Server host (default: 0.0.0.0)
- `NODE_ENV` - Environment (development/production/test)
- `CORS_ORIGIN` - Allowed CORS origins (comma-separated)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret for JWT signing
- `LOG_LEVEL` - Pino log level (default: info)

### Build & Start Production

```bash
pnpm build  # Compile TypeScript
pnpm start  # Run compiled JavaScript
```

### Testing

```bash
pnpm test  # Run unit tests (see KNOWN_ISSUES.md)
```

**Manual Testing:**

```bash
# Start server
pnpm dev

# Test health endpoint
curl http://localhost:3001/health

# Test tenant endpoints
curl http://localhost:3001/api/tenants
curl http://localhost:3001/api/tenants/1

# Create tenant
curl -X POST http://localhost:3001/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Hotel","slug":"test-hotel"}'
```

### Interactive API Documentation

Visit `http://localhost:3001/docs` for Swagger UI with:

- Interactive endpoint testing
- Request/response schemas
- Authentication testing (when implemented)

## Code Quality

### Linting

```bash
pnpm lint          # Check for issues
pnpm lint --fix    # Auto-fix issues
```

### Type Checking

```bash
pnpm typecheck
```

### Build Verification

```bash
pnpm build
```

## Architecture Decisions

### Why Fastify over Express?

1. **Performance** - Up to 2x faster than Express
2. **TypeScript Support** - First-class TypeScript integration
3. **Schema Validation** - Built-in request/response validation
4. **Plugin System** - Encapsulated, testable plugins
5. **Modern APIs** - Async/await, promises everywhere
6. **Active Development** - Regular updates and security patches

### Why Zod?

1. **Runtime Validation** - Type safety at runtime, not just compile time
2. **OpenAPI Generation** - Automatic Swagger docs from schemas
3. **Shared Contracts** - Single source of truth in `@unifocus/contracts`
4. **Type Inference** - TypeScript types derived from schemas
5. **Composable** - Easy schema composition and reuse

### ESM vs CommonJS

The project uses ESM (ES Modules) for:

- Modern JavaScript standards
- Better tree-shaking
- Native async module loading
- Future-proof codebase

## Dependencies

### Core

- `fastify@5.7.4` - Web framework
- `pino@10.3.0` - Structured logging
- `zod@3.25.76` - Schema validation (via @unifocus/contracts)

### Plugins

- `@fastify/cors@11.2.0` - CORS support
- `@fastify/swagger@9.6.1` - OpenAPI spec generation
- `@fastify/swagger-ui@5.2.5` - Interactive API docs
- `fastify-plugin@5.1.0` - Plugin utilities
- `fastify-type-provider-zod@6.1.0` - Zod integration

### Development

- `tsx@4.21.0` - TypeScript execution (dev mode)
- `tap@21.5.0` - Test framework
- `@types/node@20.19.30` - Node.js type definitions

## Next Steps

1. **Database Integration**
   - Set up Drizzle ORM
   - Create database models
   - Add migration system
   - Replace in-memory stores with real DB queries

2. **Authentication**
   - Implement JWT token generation/validation
   - Add password hashing (bcrypt)
   - Create auth middleware
   - Protect routes with authentication

3. **Testing**
   - Resolve test runner ESM compatibility
   - Add comprehensive test coverage
   - Integration tests for API endpoints
   - E2E tests for critical flows

4. **Additional Routes**
   - Properties management
   - Employee management
   - Shift scheduling
   - Time tracking/punches
   - Housekeeping tasks

5. **Production Hardening**
   - Add rate limiting
   - Implement request ID propagation
   - Set up monitoring/observability
   - Add security headers
   - Configure helmet.js

## Resources

- [Fastify Documentation](https://fastify.dev/)
- [Zod Documentation](https://zod.dev/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Pino Logger](https://getpino.io/)

## Contributing

When adding new routes:

1. Create a new route file in `src/routes/`
2. Import schemas from `@unifocus/contracts`
3. Add OpenAPI schema documentation
4. Register routes in `src/routes/index.ts`
5. Add unit tests
6. Update this README

## Support

For issues or questions:

- Check [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for known problems
- Review API documentation at `/docs`
- Check server logs (pino output)
- Verify environment variables are set correctly
