# Cognito Authentication Setup - Unifocus

## Overview

This document describes the Cognito authentication implementation with RBAC (Role-Based Access Control) and tenant scoping.

## Architecture

### API Server (services/api)

- **JWT Validation Middleware** (`src/plugins/auth.ts`)
  - Validates RS256-signed JWT tokens from Cognito
  - JWKS caching (1 hour TTL) to minimize API calls
  - Extracts user claims: userId, email, tenantId, roles, scopes
- **RBAC Helpers** (`src/auth/rbac.ts`)
  - Role/scope checking functions
  - Tenant scoping validation
  - Resource ownership authorization
  - Middleware factory for route-level protection

- **Protected Endpoints** with tenant scoping
  - GET /api/me - Current user info
  - GET /api/me/tenants - User's accessible tenants
  - GET /api/tenants/:id - Tenant details (tenant-scoped)
  - GET /api/tenants/:id/properties - Properties in tenant
  - GET /api/properties - User's properties (auto-scoped)
  - GET /api/properties/:id - Property details (tenant-scoped)

### Web App (apps/web)

- **Cognito Auth Service** (`src/services/cognito-auth.ts`)
  - Redirect to Cognito Hosted UI for OAuth flow
  - Handle authorization code exchange
  - Token storage in localStorage
  - Token refresh mechanism
  - Session management
- **API Client** (`src/services/api-client.ts`)
  - Auto-attach Authorization header with JWT
  - Typed fetch wrapper
  - Pre-built endpoint helpers
- **Components & Hooks**
  - LoginPage: OAuth UI with Cognito Hosted UI redirect
  - ProtectedRoute: Route-level auth enforcement
  - useAuth: Hook for consuming auth state

## Configuration

### Environment Variables

**API (.env):**

```env
# Cognito / Auth
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_xxxxxxxxx
COGNITO_JWKS_URI=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_xxxxxxxxx/.well-known/jwks.json

# For development without Cognito
AUTH_SKIP_VERIFICATION=false
```

**Web (.env):**

```env
# Cognito Authentication
VITE_COGNITO_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_DOMAIN=unifocus-dev.auth.us-east-1.amazoncognito.com
VITE_COGNITO_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_COGNITO_LOGOUT_URI=http://localhost:5173/login
VITE_API_BASE_URL=http://localhost:3001
```

## AWS Cognito Setup

### 1. Create User Pool

1. AWS Cognito > User Pools > Create
2. Configure sign-up/sign-in options:
   - Email required
   - Username with email option
   - Self-service password reset
3. Configure MFA (optional)
4. Define custom attributes:
   - `custom:tenant_id` (String, required for production)

### 2. Configure App Client

1. User Pool > App Integration > App Clients
2. Create app client (public client for web app)
3. Configure settings:
   - Allowed OAuth flows: Authorization code grant
   - Allowed OAuth scopes: email, openid, profile
   - Allowed callback URLs: `http://localhost:5173/auth/callback`
   - Allowed sign-out URLs: `http://localhost:5173/login`

### 3. Configure Cognito Domain

1. User Pool > App Integration > Domain
2. Create domain (e.g., `unifocus-dev`)
3. This creates the Hosted UI at: `https://unifocus-dev.auth.us-east-1.amazoncognito.com`

### 4. User Groups/Roles (Optional)

Create groups in Cognito for role mapping:

- Admin
- Manager
- Employee

Then use `cognito:groups` claim in tokens.

## Security Features

### Authentication

- RS256 JWT validation with JWKS
- Token stored in localStorage
- Automatic token refresh support
- OAuth 2.0 authorization code grant (production)

### Authorization

- Tenant-scoped resource access
- Role-based access control (RBAC)
- Scope-based permission checks
- Resource ownership validation

### Tenant Isolation

- All queries filtered by `tenantId`
- User access verified before resource retrieval
- Composite unique constraints prevent cross-tenant access

## API Usage Examples

### As Authenticated User

```bash
# Get current user
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/me

# List user's tenants
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/me/tenants

# Get specific tenant
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/tenants/$TENANT_ID

# List properties in tenant
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/tenants/$TENANT_ID/properties

# List user's properties (auto-scoped to tenant from JWT)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/properties
```

### Frontend Usage

```typescript
import { initializeCognitoAuth, getAuthService } from './services/cognito-auth';
import { initializeApiClient, getCurrentUser, getProperties } from './services/api-client';

// Initialize services
initializeCognitoAuth(config);
initializeApiClient(baseUrl);

// Check auth status
const authService = getAuthService();
if (authService.isAuthenticated()) {
  const user = await getCurrentUser();
  const properties = await getProperties();
}

// Login/Logout
authService.redirectToLogin();
authService.logout();
```

## Development Tips

### Local Development Without Cognito

Set `AUTH_SKIP_VERIFICATION=true` in API `.env` to skip JWT validation for testing.

### Testing with Mock Token

Create a simple JWT token and use it for testing:

```javascript
const mockToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';
localStorage.setItem(
  'auth_tokens',
  JSON.stringify({
    accessToken: mockToken,
    idToken: mockToken,
    refreshToken: mockToken,
  })
);
```

### Debug Token

Decode JWT tokens at https://jwt.io (client-side only, never share tokens)

### Cognito Logs

- CloudWatch Logs: CloudWatch > Log Groups > /aws/cognito/...
- User activity: Cognito > User Pools > Users

## RBAC Examples

### Check User Role

```typescript
import { getAuthContext, hasRole } from './auth/rbac';

const handler = async (request, reply) => {
  const context = getAuthContext(request);

  if (hasRole(context, 'Admin')) {
    // Allow admin action
  }
};
```

### Route-Level Authorization

```typescript
import { createAuthorizationMiddleware } from './auth/rbac';

server.get(
  '/api/admin/users',
  {
    onRequest: createAuthorizationMiddleware({
      requireRoles: 'Admin',
      requireTenant: true,
    }),
  },
  async (request, reply) => {
    // Only Admin users with tenant scope can access
  }
);
```

### Resource Ownership Check

```typescript
import { canAccessResource, getAuthContext } from './auth/rbac';

const context = getAuthContext(request);
const canAccess = canAccessResource(
  context,
  'Manager', // Required role
  employeeId, // Resource owner
  tenantId // Resource tenant
);
```

## Troubleshooting

### "Missing or invalid Authorization header"

- Ensure token is attached: `Authorization: Bearer $TOKEN`
- Check token hasn't expired
- Verify JWKS_URI is accessible

### "Invalid token"

- JWKS fetch failed - check network/CORS
- Token signed with wrong key
- Token issuer doesn't match config

### "Tenant scope required"

- Ensure user has `custom:tenant_id` attribute in Cognito
- Verify JWT contains `custom:tenant_id` claim

### "Access denied to this tenant"

- User not member of requested tenant
- Verify user record exists in database
- Check `tenantId` matches

## Production Checklist

- [ ] Configure real Cognito User Pool in production AWS account
- [ ] Set strong JWT_SECRET in production
- [ ] Enable HTTPS for all endpoints
- [ ] Configure CORS for production domain
- [ ] Set up CloudWatch logs for audit
- [ ] Configure custom domain for Cognito Hosted UI
- [ ] Enable MFA in Cognito
- [ ] Set up password policies
- [ ] Configure user pool backup
- [ ] Test token refresh mechanism
- [ ] Implement logout across all tabs (using storage events)
- [ ] Add session timeout handling
