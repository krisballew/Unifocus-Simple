# API Security Baseline Implementation

## Overview

This document describes the baseline security features implemented in the Unifocus API to protect against common web application vulnerabilities and attacks.

## Security Features Implemented

### 1. Secure Headers

**Location:** `src/plugins/security.ts`

- **x-powered-by Header Removal**: Removes the `x-powered-by` header to prevent information disclosure about the server technology stack.
- **Content-Type Enforcement**: Ensures all JSON responses have `Content-Type: application/json` header.

**Benefits:**

- Reduces fingerprinting attacks
- Prevents accidental JSONP content-type issues
- Improves API consistency

### 2. CORS (Cross-Origin Resource Sharing)

**Location:** `src/plugins/external.ts`

**Configuration:**

```typescript
await server.register(fastifyCors, {
  origin: config.corsOrigin.split(',').map((o) => o.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});
```

**Features:**

- Whitelist-based origin validation (only configured origins allowed)
- Support for multiple origins via comma-separated environment variable
- Credential support for authenticated requests
- Explicit HTTP methods enumeration

**Configuration via Environment:**

```bash
CORS_ORIGIN="http://localhost:3000,http://localhost:5173,https://app.unifocus.com"
```

**Benefits:**

- Prevents cross-site request forgery (CSRF) attacks from unauthorized domains
- Explicit allow-list prevents accidental exposure
- Single source of truth for allowed origins

### 3. Rate Limiting

**Location:** `src/plugins/rate-limit.ts`

**Default Limits:**

- **100 requests per 15 minutes** per IP address
- In-memory store (no external dependency required)
- Configurable via environment variables

**Configuration:**

```bash
RATE_LIMIT_MAX=100              # Maximum requests
RATE_LIMIT_WINDOW="15 minutes"  # Time window
```

**Bypasses:**

- Localhost (127.0.0.1) always allowed for local development
- `/health` endpoint (liveness probe)
- `/ready` endpoint (readiness probe)

**Benefits:**

- Prevents brute force attacks
- Protects against DDoS attacks
- Maintains API availability under load
- Returns `429 Too Many Requests` when limit exceeded

**Future Enhancement:**
To use Redis-backed rate limiting for distributed deployments:

```typescript
const redis = require('redis');
const client = redis.createClient();
// Pass `redis: client` to plugin configuration
```

### 4. Request Body Size Limits

**Location:** `src/plugins/request-limits.ts` and `src/server.ts`

**Limits:**

- **JSON request bodies:** 1 MB (1,048,576 bytes)
- **Form data / multipart:** 10 MB (10,485,760 bytes)
- **File uploads:** 50 MB (reserved for future file upload endpoints)

**Configuration:**

```bash
REQUEST_JSON_LIMIT="1mb"    # JSON body limit
REQUEST_FORM_LIMIT="10mb"   # Form data limit
```

**Fastify Configuration:**

```typescript
Fastify({
  bodyLimit: 1048576, // 1 MB
});
```

**Benefits:**

- Prevents memory exhaustion attacks
- Protects against "billion laughs" XML expansion attacks (for future XML support)
- Controls storage and bandwidth usage
- Returns `413 Payload Too Large` when exceeded

**Validation:**
The plugin hooks into `preHandler` to check `Content-Length` header before processing and provides structured error responses.

### 5. Request ID / Correlation ID

**Location:** `src/server.ts` and `src/plugins/error-handler.ts`

- Every request receives a unique correlation ID
- Can be provided by client via `x-correlation-id` header
- System generates UUIDs when not provided
- Included in all response headers and logs

**Benefits:**

- Request tracing across logs
- Easier debugging in production
- Enables distributed tracing

### 6. Structured Error Responses

**Location:** `src/plugins/error-handler.ts`

All errors return consistent JSON structure:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Descriptive error message",
  "correlationId": "uuid-here"
}
```

**Sanitization:**

- Stack traces only shown in development mode
- Generic messages in production to prevent information disclosure
- All error details logged server-side with correlation ID

## Plugin Registration Order

**Critical:** Security plugins must be registered early in the plugin chain:

1. **security** - Remove sensitive headers
2. **request-size-limits** - Enforce request body limits
3. **rate-limit** - Apply rate limiting
4. **error-handler** - Centralized error handling
5. **cors** - Cross-origin configuration
6. **auth** - Authentication/authorization
7. **swagger** - API documentation

See `src/plugins/index.ts` for the actual registration order.

## Environment Variables

```bash
# CORS Configuration
CORS_ORIGIN="http://localhost:3000"

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW="15 minutes"

# Request Size Limits
REQUEST_JSON_LIMIT="1mb"
REQUEST_FORM_LIMIT="10mb"

# Logging
LOG_LEVEL="info"
NODE_ENV="production"
```

## Testing

### Unit Tests

Run security baseline tests:

```bash
npm test
```

Look for `security-baseline.test.ts` tests that verify:

- Header removal
- CORS enforcement
- Request body size validation
- Rate limiting configuration
- Structured error responses

### Manual Verification

Run the security verification script:

```bash
npm run verify:security
```

This script checks:

- Secure headers are set correctly
- CORS configuration
- Health endpoints respond properly
- Correlation ID header present
- Request body limits enforced
- Rate limit configuration active

Example output:

```
======================================================================
  Security Baseline Verification
======================================================================

✓ PASS  Secure Headers
✓ PASS  Health Endpoint Accessible
✓ PASS  Correlation ID Header Present
✓ PASS  Content-Type Header Set
✓ PASS  CORS Headers Present
✓ PASS  CORS Origin Configured
✓ PASS  Ready Endpoint Returns Valid Status
✓ PASS  Ready Endpoint Response Structure
✓ PASS  Request Body Size Limit - Small Payloads Accepted
✓ PASS  Rate Limiting Configured
✓ PASS  Rate Limit Skips Health Checks
✓ PASS  Security Plugin Active

======================================================================
  Summary
======================================================================

Tests Passed: 12/12 (100%)

✓ All security baseline tests passed!
```

## Security Best Practices

### For Deployment

1. **Set appropriate CORS origins:**

   ```bash
   CORS_ORIGIN="https://app.unifocus.com,https://admin.unifocus.com"
   ```

2. **Adjust rate limits based on your needs:**

   ```bash
   RATE_LIMIT_MAX=1000      # For higher throughput
   RATE_LIMIT_WINDOW="1 hour"
   ```

3. **Monitor rate limit triggers:**
   - 429 responses indicate potential attack or misconfiguration
   - Check logs for unusual patterns

4. **Keep dependencies updated:**

   ```bash
   npm audit
   pnpm audit
   ```

5. **Use Redis rate limiting for distributed deployments:**
   - Multiple API instances will share rate limit state
   - Better DDoS protection

6. **Use a WAF (Web Application Firewall) in front:**
   - CloudFlare, AWS WAF, or similar
   - Additional protection layer for rate limiting, DDoS

### For Development

- CORS origin can be set to `"*"` (not recommended in production)
- Rate limiting can be disabled by setting `RATE_LIMIT_MAX=999999`
- Request size limits can be increased for testing

## Future Enhancements

1. **HTTPS/TLS Only:** Add HSTS header plugin
2. **Content Security Policy (CSP):** Prevent injection attacks
3. **SQL Injection Prevention:** Already handled by Prisma
4. **JWT Validation:** Already implemented in auth plugin
5. **OWASP Compliance:** Regular security audits
6. **API Key Rate Limiting:** Per-API-key rate limits
7. **Geographic Rate Limiting:** Restrict by region
8. **Captcha Integration:** For rate-limited clients

## Resources

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Fastify Security](https://www.fastify.io/docs/latest/Guides/Security/)
- [HTTP Security Headers](https://owasp.org/www-project-secure-headers/)
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)

## Related Files

- `src/plugins/security.ts` - Secure headers plugin
- `src/plugins/rate-limit.ts` - Rate limiting plugin
- `src/plugins/request-limits.ts` - Request body size limits
- `src/plugins/error-handler.ts` - Centralized error handling
- `src/plugins/external.ts` - CORS configuration
- `src/server.ts` - Fastify initialization
- `src/plugins/index.ts` - Plugin registration
- `tests/security-baseline.test.ts` - Security tests
- `scripts/verify-security.js` - Verification script
