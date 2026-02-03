# Web App Deployment Verification Guide

This guide covers verifying the deployment of the Unifocus web app to CloudFront, including authentication, API connectivity, and caching behavior.

## Prerequisites

Before deployment verification:

1. ✅ API infrastructure deployed (ECS, ALB, RDS)
2. ✅ GitHub repository secrets configured with environment variables
3. ✅ deploy-web-dev workflow completed successfully
4. ✅ CloudFront distribution deployed and active

## Phase 1: Pre-Deployment Checklist

### 1.1 Verify Web Hosting Infrastructure

```bash
# Check S3 bucket exists
aws s3 ls s3://${{ secrets.WEB_BUCKET_NAME }} --region us-east-1

# Check CloudFront distribution
aws cloudfront list-distributions --region us-east-1 | \
  jq '.DistributionList.Items[] | select(.Comment | contains("unifocus-dev"))'

# Get CloudFront domain name
CLOUDFRONT_DOMAIN=$(aws cloudfront list-distributions --region us-east-1 | \
  jq -r '.DistributionList.Items[] | select(.Comment | contains("unifocus-dev")) | .DomainName')
echo "CloudFront Domain: $CLOUDFRONT_DOMAIN"
```

### 1.2 Verify GitHub Secrets

Required secrets for web deployment:

```bash
# Check web-specific secrets exist
gh secret list --repo krisballew/Unifocus-Simple | grep -E "VITE_|WEB_BUCKET|CLOUDFRONT"

# Expected secrets:
# VITE_API_BASE_URL              - API ALB DNS or endpoint
# VITE_COGNITO_REGION            - AWS region (us-east-1)
# VITE_COGNITO_USER_POOL_ID      - Cognito user pool ID
# VITE_COGNITO_CLIENT_ID         - Cognito app client ID
# VITE_COGNITO_DOMAIN            - Cognito domain (e.g., unifocus-dev.auth.us-east-1.amazoncognito.com)
# VITE_COGNITO_REDIRECT_URI      - OAuth redirect (https://cloudfront-domain/auth/callback)
# VITE_COGNITO_LOGOUT_URI        - OAuth logout (https://cloudfront-domain/login)
# WEB_BUCKET_NAME                - S3 bucket name
# CLOUDFRONT_DISTRIBUTION_ID     - CloudFront distribution ID
# CLOUDFRONT_DOMAIN              - CloudFront domain name
```

## Phase 2: Trigger Web Deployment Workflow

### 2.1 Option A: Trigger via GitHub CLI

```bash
# Trigger the workflow
gh workflow run deploy-web-dev.yml \
  --repo krisballew/Unifocus-Simple \
  --ref main

# Watch the workflow
gh run list --repo krisballew/Unifocus-Simple --workflow deploy-web-dev.yml --limit 1
gh run watch <run-id> --repo krisballew/Unifocus-Simple
```

### 2.2 Option B: Trigger via GitHub Web UI

1. Go to: https://github.com/krisballew/Unifocus-Simple/actions
2. Select "Deploy Web to Dev" workflow
3. Click "Run workflow"
4. Select "main" branch
5. Click "Run workflow"

### 2.3 Monitor Workflow Progress

```bash
# Get latest run logs
LATEST_RUN=$(gh run list --repo krisballew/Unifocus-Simple --workflow deploy-web-dev.yml --limit 1 --json databaseId --query "[0].databaseId" --output raw)

# View step logs
gh run view $LATEST_RUN --repo krisballew/Unifocus-Simple --log

# Expected workflow steps:
# 1. Checkout code ✓
# 2. Setup Node.js ✓
# 3. Setup pnpm ✓
# 4. Get pnpm cache ✓
# 5. Setup pnpm cache ✓
# 6. Install dependencies ✓
# 7. Build web app (with VITE_* env vars) ✓
# 8. Configure AWS credentials (OIDC) ✓
# 9. Sync files to S3 ✓
# 10. Invalidate CloudFront cache ✓
# 11. Verify deployment ✓
```

## Phase 3: CloudFront Verification

### 3.1 Check CloudFront Distribution Status

```bash
# Get distribution details
CLOUDFRONT_ID=${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }}
CLOUDFRONT_DOMAIN=${{ secrets.CLOUDFRONT_DOMAIN }}

aws cloudfront get-distribution \
  --id $CLOUDFRONT_ID \
  --region us-east-1 \
  --query 'Distribution.[Enabled,Status,DomainName]' \
  --output table

# Expected output:
# Enabled: true
# Status: Deployed
# DomainName: d123456789.cloudfront.net
```

### 3.2 Verify S3 Files Uploaded

```bash
# List uploaded files
aws s3 ls s3://${{ secrets.WEB_BUCKET_NAME }}/ --recursive --region us-east-1

# Check index.html cache headers
aws s3api head-object \
  --bucket ${{ secrets.WEB_BUCKET_NAME }} \
  --key index.html \
  --region us-east-1 \
  --query '[ContentType,CacheControl,LastModified]' \
  --output table

# Expected:
# ContentType: text/html; charset=utf-8
# CacheControl: public, no-cache, no-store, must-revalidate
```

### 3.3 Check CloudFront Cache Invalidation

```bash
# List recent invalidations
aws cloudfront list-invalidations \
  --distribution-id $CLOUDFRONT_ID \
  --region us-east-1 \
  --query 'InvalidationList.Items[:3].[Id,Status,CreateTime]' \
  --output table

# Expected: Most recent should be "Completed"

# Get details of latest invalidation
INVALIDATION_ID=$(aws cloudfront list-invalidations \
  --distribution-id $CLOUDFRONT_ID \
  --region us-east-1 \
  --query 'InvalidationList.Items[0].Id' \
  --output text)

aws cloudfront get-invalidation \
  --distribution-id $CLOUDFRONT_ID \
  --id $INVALIDATION_ID \
  --region us-east-1 \
  --query 'Invalidation.[Status,InvalidationBatch.Paths]' \
  --output table
```

## Phase 4: Web App Endpoint Verification

### 4.1 Direct HTTPS Access

```bash
# Test basic connectivity
curl -v https://$CLOUDFRONT_DOMAIN/ 2>&1 | head -30

# Expected responses:
# HTTP/1.1 200 OK
# Content-Type: text/html
# Cache-Control: public, no-cache, no-store, must-revalidate
```

### 4.2 Check Security Headers

```bash
# Verify security headers are present
curl -s -I https://$CLOUDFRONT_DOMAIN/ | grep -E "strict-transport-security|x-content-type|x-frame|content-security"

# Expected headers:
# strict-transport-security: max-age=31536000; includeSubDomains
# x-content-type-options: nosniff
# x-frame-options: DENY
# x-xss-protection: 1; mode=block
# content-security-policy: ...
# referrer-policy: strict-origin-when-cross-origin
# permissions-policy: ...
```

### 4.3 Verify HTML Content

```bash
# Get HTML and check for React app div
curl -s https://$CLOUDFRONT_DOMAIN/ | grep -E '<div id="root"|<script|content-security-policy'

# Expected:
# - <div id="root"></div> element
# - <script> tags with bundle references
# - Inline content-security-policy meta tag (if present)
```

### 4.4 Check Asset Loading

```bash
# Test that static assets are loaded with correct cache headers
curl -s -I https://$CLOUDFRONT_DOMAIN/assets/index-*.js | grep -E "cache-control|age"

# Expected:
# cache-control: public, max-age=31536000, immutable
# (very high TTL for immutable assets with hash)
```

## Phase 5: Authentication Verification

### 5.1 Manual Browser Testing - Recommended

**Best way to test authentication and API connectivity:**

1. **Open CloudFront URL in browser:**

   ```
   https://$CLOUDFRONT_DOMAIN
   ```

2. **Verify application loads:**
   - Page should render without JavaScript errors
   - Browser console should not show CORS errors
   - Should redirect to login page if not authenticated

3. **Check browser console for issues:**
   - Open DevTools (F12)
   - Go to Console tab
   - Look for errors related to:
     - Cognito configuration
     - API endpoint
     - Content Security Policy violations

4. **Test Cognito login:**
   - Click login button
   - Should redirect to Cognito hosted UI
   - Enter valid Cognito credentials
   - Should redirect back to `/auth/callback`
   - Should be redirected to home page after login

5. **Verify environment configuration:**
   - In DevTools Console, run:
     ```javascript
     // Check if Cognito is configured
     console.log(import.meta.env.VITE_COGNITO_USER_POOL_ID);
     console.log(import.meta.env.VITE_COGNITO_DOMAIN);
     console.log(import.meta.env.VITE_API_BASE_URL);
     ```
   - All should show actual values (not blank or undefined)

### 5.2 Check Network Requests

In DevTools Network tab, verify:

1. **Initial page load:**
   - `/` returns 200 with index.html
   - `/assets/index-*.js` loads successfully
   - Static assets have long cache TTL

2. **Authentication requests:**
   - XHR to `https://cognito-domain/oauth2/authorize` (redirect)
   - XHR to `https://cognito-domain/oauth2/token` (after callback)
   - Verify no CORS errors

3. **API requests:**
   - Requests to API endpoint (e.g., `http://alb-dns/health`)
   - Should include `Authorization: Bearer <token>` header
   - Should return 200 with expected data

### 5.3 Verify Cognito Configuration

```bash
# Get Cognito user pool details
COGNITO_POOL_ID=${{ secrets.VITE_COGNITO_USER_POOL_ID }}
COGNITO_REGION=${{ secrets.VITE_COGNITO_REGION }}

aws cognito-idp describe-user-pool \
  --user-pool-id $COGNITO_POOL_ID \
  --region $COGNITO_REGION \
  --query 'UserPool.[Id,Name,Status]' \
  --output table

# Verify app client configuration
COGNITO_CLIENT_ID=${{ secrets.VITE_COGNITO_CLIENT_ID }}

aws cognito-idp describe-user-pool-client \
  --user-pool-id $COGNITO_POOL_ID \
  --client-id $COGNITO_CLIENT_ID \
  --region $COGNITO_REGION \
  --query 'UserPoolClient.[ClientId,CallbackURLs,LogoutURLs,AllowedOAuthFlows]' \
  --output table

# Expected CallbackURLs to include:
# https://$CLOUDFRONT_DOMAIN/auth/callback

# Expected LogoutURLs to include:
# https://$CLOUDFRONT_DOMAIN/login
```

## Phase 6: API Connectivity Verification

### 6.1 Test API Health Endpoint

After authenticating in the browser:

```bash
# Get an auth token from the browser console:
# Copy from DevTools > Application > LocalStorage > token

API_URL=${{ secrets.VITE_API_BASE_URL }}
TOKEN="<token-from-browser>"

# Test API health endpoint
curl -s https://$API_URL/health | jq .

# Test API ready endpoint
curl -s https://$API_URL/ready | jq .

# Test API endpoint with auth
curl -s -H "Authorization: Bearer $TOKEN" https://$API_URL/health | jq .
```

### 6.2 Monitor API Connectivity

```bash
# Check if app can reach API (check logs)
# In browser DevTools Console after login, run:
fetch('/api/health').then(r => r.json()).then(console.log).catch(console.error)

# Should return 200 with health status
```

## Phase 7: Troubleshooting Failed Deployments

### Issue 1: CloudFront serves error page

**Symptoms:** HTTP 403 or 404 from CloudFront

**Diagnosis:**

```bash
# Check S3 bucket policy
aws s3api get-bucket-policy \
  --bucket ${{ secrets.WEB_BUCKET_NAME }} \
  --region us-east-1 | jq '.Policy | fromjson'

# Check CloudFront OAI
CLOUDFRONT_ID=${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }}
aws cloudfront get-distribution \
  --id $CLOUDFRONT_ID \
  --region us-east-1 \
  --query 'Distribution.DistributionConfig.Origins[0].S3OriginConfig' \
  --output json
```

**Fix:**

```bash
# Redeploy to ensure S3 bucket policy is correct
# Or manually update:
aws s3api put-bucket-policy \
  --bucket ${{ secrets.WEB_BUCKET_NAME }} \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity <OAI-ID>"},
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${{ secrets.WEB_BUCKET_NAME }}/*"
    }]
  }'
```

### Issue 2: App loads but shows blank page

**Symptoms:** HTML loads (200), but React doesn't render

**Diagnosis:**

```javascript
// In DevTools Console:
// Check if root element exists
document.getElementById('root');

// Check for JavaScript errors
// Go to Console tab and look for red errors
```

**Causes & Fixes:**

- CSP blocking React: Check Content-Security-Policy headers, ensure 'wasm-unsafe-eval' allowed
- Build artifact missing: Verify `/assets/index-*.js` loads in Network tab
- React version mismatch: Check package-lock consistency

### Issue 3: Cognito authentication fails

**Symptoms:** Login button doesn't work, or redirect fails

**Diagnosis:**

```javascript
// In DevTools Console:
console.log(import.meta.env.VITE_COGNITO_USER_POOL_ID);
console.log(import.meta.env.VITE_COGNITO_CLIENT_ID);
console.log(import.meta.env.VITE_COGNITO_DOMAIN);
console.log(import.meta.env.VITE_COGNITO_REDIRECT_URI);

// All should show actual values
```

**Common causes:**

- Missing VITE\_\* secrets in workflow
- Cognito domain not in secret or incorrect format
- Redirect URI not registered in Cognito app client
- User pool or app client doesn't exist

**Fix:**

```bash
# 1. Verify secrets are set
gh secret list --repo krisballew/Unifocus-Simple | grep VITE_COGNITO

# 2. Check Cognito app client callback URLs
COGNITO_POOL_ID=${{ secrets.VITE_COGNITO_USER_POOL_ID }}
COGNITO_CLIENT_ID=${{ secrets.VITE_COGNITO_CLIENT_ID }}

aws cognito-idp describe-user-pool-client \
  --user-pool-id $COGNITO_POOL_ID \
  --client-id $COGNITO_CLIENT_ID \
  --region us-east-1 \
  --query 'UserPoolClient.CallbackURLs' \
  --output table

# 3. Update if needed
aws cognito-idp update-user-pool-client \
  --user-pool-id $COGNITO_POOL_ID \
  --client-id $COGNITO_CLIENT_ID \
  --region us-east-1 \
  --callback-urls "https://$CLOUDFRONT_DOMAIN/auth/callback"

# 4. Re-trigger deployment
gh workflow run deploy-web-dev.yml --repo krisballew/Unifocus-Simple
```

### Issue 4: API requests fail (CORS errors)

**Symptoms:** XHR/fetch to API returns 403 or CORS error

**Diagnosis:**

```javascript
// In DevTools Console:
// Look for CORS errors in Console tab
// Check Network tab for failed API requests

// Try fetching directly:
fetch('http://api-alb-dns/health')
  .then((r) => r.json())
  .then(console.log)
  .catch(console.error);
```

**Common causes:**

- API not configured to accept CloudFront origin in CORS
- API health check endpoint not returning proper headers
- ALB not responding or returning error

**Fix:**

```bash
# 1. Check API is running
ALB_DNS=${{ secrets.VITE_API_BASE_URL }}

curl -I https://$ALB_DNS/health

# 2. Check API CORS headers
curl -I -H "Origin: https://$CLOUDFRONT_DOMAIN" \
  https://$ALB_DNS/health

# 3. Update API CORS_ORIGIN if needed (in Secrets Manager)
aws secretsmanager update-secret \
  --secret-id <cognito-secret-arn> \
  --secret-string '{...,"cors_origin":"https://$CLOUDFRONT_DOMAIN",...}'

# 4. Force API service update
CLUSTER=$(aws ecs list-clusters --region us-east-1 --query 'clusterArns[0]' --output text)
SERVICE=$(aws ecs list-services --cluster $CLUSTER --region us-east-1 --query 'serviceArns[0]' --output text)

aws ecs update-service \
  --cluster $CLUSTER \
  --service $SERVICE \
  --force-new-deployment \
  --region us-east-1
```

### Issue 5: Stale configuration after deployment

**Symptoms:** App loads old environment values after deployment

**Diagnosis:**

```javascript
// In DevTools Console:
console.log(import.meta.env.VITE_API_BASE_URL);
// Check if this matches new API endpoint
```

**Root Cause:**

- Browser cached old `index.html`
- CloudFront cached old index.html before invalidation

**Fix:**

```bash
# 1. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

# 2. Check index.html cache headers
curl -I https://$CLOUDFRONT_DOMAIN/ | grep -i cache

# Expected: cache-control: public, no-cache, no-store, must-revalidate

# 3. If caching wrong, manually invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_ID \
  --paths "/" "/index.html" \
  --region us-east-1

# 4. Re-trigger deployment
gh workflow run deploy-web-dev.yml --repo krisballew/Unifocus-Simple
```

## Phase 8: Performance Verification

### 8.1 Check Asset Delivery

```bash
# Measure download time for main bundle
time curl -s -o /dev/null -w "%{time_total}s\n" https://$CLOUDFRONT_DOMAIN/assets/index-*.js

# Expected: < 1 second for initial request from nearby region
```

### 8.2 Check CloudFront Cache Hit Ratio

```bash
# Get CloudFront cache statistics
aws cloudfront get-distribution-statistics \
  --id $CLOUDFRONT_ID \
  --region us-east-1 \
  --query 'Distribution.Statistics' \
  --output table 2>/dev/null || echo "Statistics not available via API"

# Check CloudWatch metrics instead
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name CacheHitRate \
  --dimensions Name=DistributionId,Value=$CLOUDFRONT_ID \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average \
  --region us-east-1
```

## Phase 9: Validation Checklist

Before signing off on deployment:

- [ ] **CloudFront Distribution**
  - [ ] Distribution is enabled
  - [ ] Status shows "Deployed"
  - [ ] Domain is accessible via HTTPS
- [ ] **S3 Bucket**
  - [ ] Files uploaded to bucket
  - [ ] index.html has no-cache headers
  - [ ] assets have max-age=31536000
- [ ] **Security Headers**
  - [ ] Strict-Transport-Security present
  - [ ] X-Content-Type-Options: nosniff
  - [ ] X-Frame-Options: DENY
  - [ ] Content-Security-Policy configured
- [ ] **Web App**
  - [ ] Page loads without JavaScript errors
  - [ ] React app renders (root element populated)
  - [ ] All static assets load successfully
- [ ] **Authentication**
  - [ ] Login button redirects to Cognito hosted UI
  - [ ] Can enter credentials and login
  - [ ] Redirects back to app after login
  - [ ] User state persists after page refresh
- [ ] **API Connectivity**
  - [ ] `/health` endpoint responds with 200
  - [ ] `/ready` endpoint responds with 200 (database ok)
  - [ ] Authenticated API calls work
  - [ ] No CORS errors in browser console
- [ ] **Caching**
  - [ ] Static assets return 304 Not Modified on repeat requests
  - [ ] index.html returns 200 with fresh content
  - [ ] No stale configuration after deployment
- [ ] **Performance**
  - [ ] Page load < 3 seconds
  - [ ] Asset downloads complete quickly
  - [ ] No console warnings or errors

## Quick Reference Commands

```bash
# Get all deployment info
CLOUDFRONT_ID=${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }}
CLOUDFRONT_DOMAIN=${{ secrets.CLOUDFRONT_DOMAIN }}
WEB_BUCKET=${{ secrets.WEB_BUCKET_NAME }}

echo "=== CloudFront Status ==="
aws cloudfront get-distribution --id $CLOUDFRONT_ID --region us-east-1 | jq '.Distribution.Status'

echo "=== S3 Files ==="
aws s3 ls s3://$WEB_BUCKET/ --recursive --region us-east-1 | wc -l

echo "=== Recent Invalidations ==="
aws cloudfront list-invalidations --distribution-id $CLOUDFRONT_ID --region us-east-1 | jq '.InvalidationList.Items[0]'

echo "=== Security Headers ==="
curl -s -I https://$CLOUDFRONT_DOMAIN/ | grep -iE "security|cache|csp"
```

## Related Documentation

- [Terraform Web Hosting Module](../../infra/terraform/modules/web-hosting/main.tf)
- [Deployment Workflow](../../.github/workflows/deploy-web-dev.yml)
- [Environment Configuration](../DEPLOYMENT_STATUS.md)
- [API Deployment Guide](./DEPLOYMENT_VERIFICATION_GUIDE.md)
