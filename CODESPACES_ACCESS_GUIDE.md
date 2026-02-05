# GitHub Codespaces Access & 502 Fix

## Problem: 502 Error When Accessing via GitHub Codespaces URL

When accessing the app through GitHub Codespaces forwarded port (e.g., `https://scaling-parakeet-ww5qr4gqgwvc95j4-3000.app.github.dev`), the web app would fail with a 502 Bad Gateway error on reload.

**Root Cause:** The web app's environment was hardcoded to localhost, which isn't accessible when the browser connects through the Codespaces domain.

## Solution Overview

### Smart API Detection

The web app now includes intelligent API endpoint detection:

1. **First attempt:** Uses configured `VITE_API_BASE_URL` (http://localhost:3001)
2. **Fallback:** Tries localhost on standard ports
3. **Final fallback:** Uses `/api` proxy route (works with Vite dev server proxy)

When accessed via Codespaces:
- The app detects that localhost isn't reachable
- Falls back to `/api` proxy
- Vite's development server proxies `/api/*` requests to the real API server
- Everything works seamlessly

### How It Works

**Local Development (http://localhost:3000)**
```
Browser → Vite Dev Server (localhost:3000)
              ↓
        [Vite Proxy: /api → localhost:3001]
              ↓
          API Server (localhost:3001)
```

**Codespaces (https://scaling-parakeet-ww5qr4gqgwvc95j4-3000.app.github.dev)**
```
Browser → Codespaces Domain
              ↓
        Vite Dev Server (internal:3000)
              ↓
        [Vite Proxy: /api → localhost:3001]
              ↓
          API Server (localhost:3001)
```

## How to Access the App

### Option 1: Localhost (Direct Access)
```
http://localhost:3000/
http://localhost:3001/docs  (API docs)
```

**Best for:**
- Local development
- Testing locally
- No network latency

### Option 2: GitHub Codespaces Domain (Forwarded Port)
```
https://scaling-parakeet-ww5qr4gqgwvc95j4-3000.app.github.dev/
```

**Best for:**
- Sharing with team members
- Mobile testing (use actual domain on phone)
- Accessing from outside the local network

### Option 3: Network IP Access
```
http://10.0.11.137:3000/
```

**Best for:**
- Testing from different machines on same network
- Docker integration testing

## Configuration Details

### Environment Variables

**For All Environments:**
```dotenv
# apps/web/.env
VITE_API_BASE_URL=http://localhost:3001
# This is still used as the primary endpoint, but the app will fall back
# to /api proxy if localhost isn't reachable
```

**The App Auto-Detects:**
- If accessed via `localhost:3000` → Uses `http://localhost:3001` directly
- If accessed via `192.168.x.x:3000` → Uses `http://localhost:3001` directly  
- If accessed via `codespaces-domain` → Uses `/api` proxy

### Vite Proxy Configuration

```typescript
// vite.config.ts
proxy: {
  '/api': {
    target: process.env.VITE_API_BASE_URL || 'http://localhost:3001',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, '/api'),
  },
}
```

This tells Vite's dev server:
- Intercept all requests to `/api/*`
- Forward them to the API server
- Handle CORS and origin changes automatically

### CORS Configuration

The API server is configured to accept requests from multiple origins:

```dotenv
# services/api/.env
CORS_ORIGIN=http://localhost:3000,http://localhost:5173,https://scaling-parakeet-ww5qr4gqgwvc95j4-3000.app.github.dev
```

This allows:
- Vite dev server on port 3000
- Alternative Vite port 5173
- GitHub Codespaces forwarded URLs

## Troubleshooting

### Still Getting 502 on Reload?

**1. Verify both servers are running:**
```bash
# Check API server
curl -s http://localhost:3001/health | jq .

# Check Web app
curl -s http://localhost:3000/ | head -20
```

**2. Check browser console:**
- Open DevTools (`F12`)
- Go to Console tab
- Look for messages like:
  - `✓ API verified at http://localhost:3001` → All good
  - `Using /api proxy for API requests` → Using fallback
  - Error messages → Something went wrong

**3. Restart servers:**
```bash
pkill -f "pnpm dev"
# Restart API first, then Web app
cd services/api && pnpm dev
cd apps/web && pnpm dev
```

**4. Clear browser cache:**
- Windows/Linux: `Ctrl+Shift+Delete`
- macOS: `Cmd+Shift+Delete`

### API Returns 404 on `/api/health`?

The `/api` proxy needs to reach a real API endpoint. If the API returns 404:
1. Check if API server is actually running
2. Verify the `/health` endpoint exists on the API
3. Check `CORS_ORIGIN` in API `.env`

### Codespaces Domain Returns 404?

1. **Port forwarding might be disabled** - Check Codespaces settings
2. **Ports tab isn't visible** - Click the Ports icon in VS Code terminal
3. **Domain keeps changing** - That's normal when restarting Codespaces
   - Update CORS origin if needed
   - OR use relative `/api` proxy (more reliable)

## Best Practices

### For Development

1. **Always run both servers:**
   ```bash
   # Terminal 1
   cd services/api && export $(grep -v '^#' .env | xargs) && pnpm dev
   
   # Terminal 2
   cd apps/web && export $(grep -v '^#' .env | xargs) && pnpm dev
   ```

2. **Access via localhost when possible:**
   - More reliable
   - No forwarding delays
   - Better for debugging

3. **Use `/api` proxy when accessing via forwarded domains:**
   - More portable
   - Survives Codespaces URL changes
   - Works across different networks

### For Sharing/Testing

1. **Share the Codespaces domain with others** - It's a publicly accessible URL
2. **Make sure both servers stay running** - Tab out of dev process
3. **Reload page if needed** - App handles it gracefully now

## Files Modified for This Fix

- `apps/web/.env` - Uses localhost for dev
- `apps/web/src/App.tsx` - Smart API detection logic
- `apps/web/vite.config.ts` - Proxy configuration
- `apps/web/src/services/api-client.ts` - Relative path support
- `services/api/.env` - CORS origins updated
- `apps/web/.env.example` - Documentation

## API Endpoint Reference

When using `/api` proxy, requests are automatically rewritten:

```javascript
// These are equivalent:
fetch('/api/health')  // → Proxied to http://localhost:3001/api/health
fetch('http://localhost:3001/api/health')  // → Direct call

// Both work transparently
fetch('/api/users/list')  // → http://localhost:3001/api/users/list
fetch('/api/shifts/123')  // → http://localhost:3001/api/shifts/123
```

## References

- [Vite Dev Server Proxy](https://vitejs.dev/config/server-options.html#server-proxy)
- [GitHub Codespaces Port Forwarding](https://docs.github.com/en/codespaces/developing-in-codespaces/using-the-vs-code-web-client-in-github-codespaces#using-forwarded-ports)
- [CORS in Development](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
