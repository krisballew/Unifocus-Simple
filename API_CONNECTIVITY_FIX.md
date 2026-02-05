# API Connectivity Fix - 502 Bad Gateway Resolution

## Problem Summary

The application was experiencing **502 Bad Gateway** errors when:
- Reloading the app
- Making changes that impact the API
- Restarting services

**Root Cause:** The web app's `VITE_API_BASE_URL` was hardcoded to a specific GitHub Codespaces domain that changes or becomes unreachable, causing API calls to fail.

## Solution Implemented

### 1. **Updated `.env` Files to Use Localhost**

**File: `apps/web/.env`**
- Changed from: `https://scaling-parakeet-ww5qr4gqgwvc95j4-3001.app.github.dev`
- Changed to: `http://localhost:3001`
- Updated redirect URIs to use `http://localhost:3000` instead of hardcoded Codespaces domain

**File: `services/api/.env`**
- Updated `CORS_ORIGIN` to include all development origins:
  - `http://localhost:3000` (web app via Vite)
  - `http://localhost:5173` (alternative Vite port)
  - GitHub Codespaces domain (as fallback)

### 2. **Added Smart Fallback Logic in `App.tsx`**

The app now includes health checking during initialization:

```typescript
// Verify API is reachable and fallback to localhost if not
if (import.meta.env.DEV) {
  const response = await fetch(`${apiBaseUrl}/health`, {
    method: 'HEAD',
    timeout: 2000,
  });
  
  if (!response || !response.ok) {
    console.warn(`API at ${apiBaseUrl} is not reachable, falling back to localhost`);
    apiBaseUrl = 'http://localhost:3001';
  }
}
```

### 3. **Added Vite Proxy Configuration**

**File: `apps/web/vite.config.ts`**

Added development server proxy for API calls:

```typescript
server: {
  port: 3000,
  host: true,
  proxy: {
    '/api': {
      target: process.env.VITE_API_BASE_URL || 'http://localhost:3001',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '/api'),
    },
  },
}
```

### 4. **Updated API Client to Use Relative Paths in Dev**

**File: `apps/web/src/services/api-client.ts`**

- Added `isDev` flag to detect development mode
- Uses relative paths when in development (leverages Vite proxy)
- Falls back to absolute URLs in production

```typescript
// In development, use relative paths to leverage Vite proxy
const url = this.isDev && !options.baseUrl
  ? path
  : `${options.baseUrl || this.baseUrl}${path}`;
```

## Benefits

✅ **Eliminates 502 errors** - Uses localhost by default, avoiding hardcoded domain issues
✅ **Automatic fallback** - If primary API URL is unreachable, automatically tries localhost
✅ **Vite proxy** - In development, API calls go through Vite's dev server, improving reliability
✅ **Environment-aware** - Behaves differently in dev vs. production
✅ **No manual configuration** - Works out of the box for local development

## How It Works

### Development Flow

```
Browser Request
    ↓
Vite Dev Server (port 3000)
    ↓
[Vite Proxy catches /api/* requests]
    ↓
API Server (port 3001)
    ↓
Response back through proxy
```

### Startup Sequence

1. **App initializes** - Reads `VITE_API_BASE_URL` from `.env`
2. **Health check** - Verifies API is reachable
3. **Fallback** - If unreachable, uses `http://localhost:3001`
4. **API client** - Initialized with verified URL
5. **Proxy usage** - Vite proxy handles all `/api/*` requests

## Testing

### Verify Setup

```bash
# 1. Check API is running
curl -s http://localhost:3001/health | jq .

# 2. Check Web app is running
curl -s http://localhost:3000/ | head -20

# 3. Check proxy is working
curl -s http://localhost:3000/api/health | jq .

# 4. Reload the app in browser
# Should NOT see 502 error
```

### Common Scenarios

**Scenario 1: Reload app with both servers running**
- ✅ Should work - Uses localhost via Vite proxy

**Scenario 2: API server restarts**
- ✅ Should work - App automatically uses fallback

**Scenario 3: Switch between Codespaces domains**
- ✅ Should work - Ignores hardcoded domains, uses localhost

## Configuration Reference

### For Development

```dotenv
# apps/web/.env
VITE_API_BASE_URL=http://localhost:3001
VITE_COGNITO_REDIRECT_URI=http://localhost:3000/auth/callback
VITE_COGNITO_LOGOUT_URI=http://localhost:3000/login
```

```dotenv
# services/api/.env
CORS_ORIGIN=http://localhost:3000,http://localhost:5173,https://*.github.dev
```

### For Production

When deploying to production, update `VITE_API_BASE_URL` to your production domain:

```dotenv
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_COGNITO_REDIRECT_URI=https://app.yourdomain.com/auth/callback
VITE_COGNITO_LOGOUT_URI=https://app.yourdomain.com/login
```

## Long-Term Recommendations

1. **Use environment-specific .env files** - Keep different configs for dev/staging/prod
2. **Implement retry logic** - API client already handles fallback, could add exponential backoff
3. **Monitor API availability** - Log failed health checks for debugging
4. **Use Docker Compose** - For truly consistent local environment setup
5. **CI/CD configuration** - Update deployment workflows to set correct API URLs at build time

## Files Modified

- ✅ `apps/web/.env` - Updated API base URL and URIs
- ✅ `apps/web/src/App.tsx` - Added health check and fallback logic
- ✅ `apps/web/vite.config.ts` - Added API proxy configuration
- ✅ `apps/web/src/services/api-client.ts` - Updated to use relative paths in dev
- ✅ `services/api/.env` - Updated CORS origins

## Troubleshooting

### Still Getting 502 Errors?

1. **Check API is running:**
   ```bash
   curl -s http://localhost:3001/health
   ```

2. **Check web app is running:**
   ```bash
   curl -s http://localhost:3000/
   ```

3. **Check browser console** for API initialization messages

4. **Clear browser cache** - `Ctrl+Shift+Delete`

5. **Restart both servers:**
   ```bash
   pkill -f "pnpm dev"
   # Start API and Web again
   ```

### Proxy Not Working?

- Ensure Vite is running (should see "VITE ready" message)
- Check `.env` file has `VITE_API_BASE_URL=http://localhost:3001`
- Verify API server is on port 3001: `lsof -i :3001`

## References

- [Vite Server Proxy Documentation](https://vitejs.dev/config/server-options.html#server-proxy)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Cross-Origin Requests (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
