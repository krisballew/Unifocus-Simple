# AWS Dev Environment Deployment Runbook

**Date:** February 4, 2026  
**Environment:** Development (dev)  
**Status:** ✅ Ready for Deployment

## Prerequisites Verified

### ✅ Infrastructure Code (46 Terraform files)

- VPC module with public/private subnets
- RDS PostgreSQL with security groups
- ECS Fargate with ALB and health checks
- ECR repository for Docker images
- Secrets Manager for sensitive data
- CloudWatch logs
- S3 + CloudFront for web hosting
- GitHub OIDC for CI/CD

### ✅ Application Code

- API: Fastify 5.7.4 with all routes configured
- Web: React 18 with Cognito authentication
- Rate limiting: @fastify/rate-limit 10.3.0 (Fastify 5 compatible)
- Health checks: `/health` (liveness), `/ready` (readiness with DB check)
- No duplicate routes
- All TypeScript errors resolved
- Unit tests passing

### ✅ Deployment Workflows

- `.github/workflows/deploy-api-dev.yml` - API deployment via GitHub Actions
- `.github/workflows/deploy-web-dev.yml` - Web deployment via GitHub Actions
- Both configured with OIDC authentication (no long-lived credentials)

## Environment Constraints

**⚠️ Current Dev Container Limitations:**

- AWS CLI: Not installed
- Terraform: Not installed
- Docker: Not available
- **Impact:** Cannot execute actual AWS deployment from this environment

**✅ What We Can Do:**

- Validate all configurations are correct
- Prepare deployment commands
- Create verification procedures
- Document expected outcomes

---

## Deployment Procedure (Execute from Local Machine)

### Phase 1: AWS Infrastructure Deployment

#### 1.1 Prerequisites

```bash
# Verify tools installed
terraform version  # Should be >= 1.5.0
aws --version      # Should be >= 2.0
docker --version   # For building images

# Verify AWS credentials
aws sts get-caller-identity
# Expected output: Account ID, User ARN, etc.
```

#### 1.2 Deploy Terraform Infrastructure

```bash
# Navigate to terraform dev environment
cd infra/terraform/environments/dev

# Initialize Terraform (first time only)
terraform init

# Review planned changes
terraform plan

# Apply infrastructure
terraform apply

# Expected output:
# - VPC and subnets created
# - RDS PostgreSQL instance launched (takes ~10 minutes)
# - ECS cluster created
# - ALB configured with health check on /ready
# - ECR repository created
# - S3 bucket and CloudFront distribution created

# Save outputs for later use
terraform output -json > ../../../../terraform-outputs.json
```

#### 1.3 Verify Infrastructure

```bash
# Check RDS is available
aws rds describe-db-instances \
  --db-instance-identifier unifocus-dev \
  --query 'DBInstances[0].DBInstanceStatus'
# Expected: "available"

# Check ECS cluster exists
aws ecs describe-clusters \
  --clusters unifocus-dev \
  --query 'clusters[0].status'
# Expected: "ACTIVE"

# Check ALB is active
aws elbv2 describe-load-balancers \
  --names unifocus-dev-alb \
  --query 'LoadBalancers[0].State.Code'
# Expected: "active"
```

### Phase 2: Configure Secrets

#### 2.1 Database Credentials

```bash
# Get DB endpoint from Terraform output
DB_ENDPOINT=$(terraform output -raw db_endpoint)

# Verify secret exists
aws secretsmanager describe-secret \
  --secret-id unifocus/dev/database-url

# Update if needed (secret should be auto-created by Terraform)
# Format: postgresql://unifocus_admin:PASSWORD@ENDPOINT:5432/unifocus
```

#### 2.2 Cognito Configuration

**Required Secrets (must be manually configured):**

```bash
# Create or update Cognito secret
aws secretsmanager put-secret-value \
  --secret-id unifocus/dev/cognito \
  --secret-string '{
    "region": "us-east-1",
    "userPoolId": "us-east-1_XXXXXXXXX",
    "clientId": "your-app-client-id",
    "issuer": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXXXXX",
    "jwksUri": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXXXXX/.well-known/jwks.json"
  }'

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Create JWT secret
aws secretsmanager create-secret \
  --name unifocus/dev/jwt-secret \
  --secret-string "$JWT_SECRET"
```

### Phase 3: Build and Deploy API

#### 3.1 Build Docker Image Locally

```bash
# Navigate to API service
cd services/api

# Build Docker image
docker build -t unifocus-api:dev .

# Test image locally
docker run -p 3001:3001 \
  -e NODE_ENV=development \
  -e DATABASE_URL="postgresql://..." \
  unifocus-api:dev

# Verify health check
curl http://localhost:3001/health
# Expected: {"status":"ok","timestamp":"...","uptime":...}
```

#### 3.2 Push to ECR

```bash
# Get ECR repository URL from Terraform output
ECR_REPO=$(terraform output -raw ecr_repository_url)

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_REPO

# Tag image
docker tag unifocus-api:dev $ECR_REPO:latest
docker tag unifocus-api:dev $ECR_REPO:$(git rev-parse --short HEAD)

# Push to ECR
docker push $ECR_REPO:latest
docker push $ECR_REPO:$(git rev-parse --short HEAD)
```

#### 3.3 Deploy to ECS

```bash
# Force new deployment (pulls latest image)
aws ecs update-service \
  --cluster unifocus-dev \
  --service unifocus-dev-api \
  --force-new-deployment

# Wait for deployment to stabilize
aws ecs wait services-stable \
  --cluster unifocus-dev \
  --services unifocus-dev-api

# Check deployment status
aws ecs describe-services \
  --cluster unifocus-dev \
  --services unifocus-dev-api \
  --query 'services[0].deployments[0]'
```

#### 3.4 Verify API Deployment

```bash
# Get ALB DNS name
ALB_DNS=$(terraform output -raw alb_dns_name)

# Test health endpoint
curl http://$ALB_DNS/health
# Expected: {"status":"ok",...}

# Test readiness endpoint
curl http://$ALB_DNS/ready
# Expected: {"status":"ready","checks":{"database_connection":"ok",...}}

# If readiness fails, check logs
aws logs tail /ecs/unifocus-dev-api --follow
```

### Phase 4: Run Database Migrations

#### 4.1 Connect to ECS Task

```bash
# Get running task ID
TASK_ARN=$(aws ecs list-tasks \
  --cluster unifocus-dev \
  --service-name unifocus-dev-api \
  --query 'taskArns[0]' \
  --output text)

# Execute migrations via ECS Exec
aws ecs execute-command \
  --cluster unifocus-dev \
  --task $TASK_ARN \
  --container unifocus-api \
  --interactive \
  --command "/bin/sh"

# Inside container:
cd /app
pnpm prisma migrate deploy
pnpm prisma db seed  # Optional: seed dev data
exit
```

#### 4.2 Verify Database

```bash
# Check migrations applied
# Inside ECS container or via bastion host:
psql $DATABASE_URL -c "SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"

# Verify tables exist
psql $DATABASE_URL -c "\dt"
# Expected: tenants, users, employees, punches, shifts, etc.
```

### Phase 5: Deploy Web Application

#### 5.1 Build Web App

```bash
# Navigate to web app
cd apps/web

# Set build-time environment variables
export VITE_API_URL=http://$ALB_DNS
export VITE_COGNITO_REGION=us-east-1
export VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
export VITE_COGNITO_CLIENT_ID=your-app-client-id

# Build production bundle
pnpm build

# Verify build output
ls -lh dist/
# Expected: index.html, assets/*.js, assets/*.css
```

#### 5.2 Deploy to S3

```bash
# Get S3 bucket name
S3_BUCKET=$(terraform output -raw web_bucket_name)

# Sync build to S3
aws s3 sync dist/ s3://$S3_BUCKET/ \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "*.html" \
  --exclude "*.json"

# Upload HTML files with no-cache
aws s3 sync dist/ s3://$S3_BUCKET/ \
  --exclude "*" \
  --include "*.html" \
  --include "*.json" \
  --cache-control "no-cache,must-revalidate"

# Verify files uploaded
aws s3 ls s3://$S3_BUCKET/ --recursive | head -20
```

#### 5.3 Invalidate CloudFront Cache

```bash
# Get CloudFront distribution ID
CF_DIST_ID=$(terraform output -raw cloudfront_distribution_id)

# Create invalidation
aws cloudfront create-invalidation \
  --distribution-id $CF_DIST_ID \
  --paths "/*"

# Wait for invalidation to complete
aws cloudfront wait invalidation-completed \
  --distribution-id $CF_DIST_ID \
  --id <invalidation-id-from-above>
```

#### 5.4 Verify Web Deployment

```bash
# Get CloudFront URL
CF_URL=$(terraform output -raw cloudfront_domain_name)

# Test web app loads
curl -I https://$CF_URL
# Expected: HTTP/2 200, with security headers

# Check security headers
curl -I https://$CF_URL | grep -E "strict-transport-security|x-content-type-options|x-frame-options"
# Expected:
# strict-transport-security: max-age=31536000; includeSubDomains
# x-content-type-options: nosniff
# x-frame-options: DENY
```

### Phase 6: End-to-End Smoke Test

#### 6.1 Run E2E Test Script

```bash
# From project root
npx tsx scripts/e2e-dev-smoke.ts http://$ALB_DNS

# Expected output:
# ========================================
# E2E SMOKE TEST - DEV ENVIRONMENT
# ========================================
#
# 📊 PHASE 1: HEALTH & READINESS CHECKS
# [✓] GET /health (45ms)
# [✓] GET /ready (123ms)
#
# 🔐 PHASE 2: AUTHENTICATION
# [✓] Mock login (78ms)
#
# ⏱️  PHASE 3: PUNCH FLOW
# [✓] Create employee (156ms)
# [✓] Create schedule (89ms)
# [✓] Create shift (102ms)
# [✓] Create punch (145ms)
#
# 🚨 PHASE 4: EXCEPTION RESOLUTION
# [✓] Fetch exceptions (67ms)
# [✓] Resolve exception (98ms)
#
# 📋 PHASE 5: AUDIT LOG VERIFICATION
# [✓] Verify audit logs (112ms)
#
# ========================================
# SUMMARY: 11/11 tests passed ✅
# ========================================
```

---

## Common Issues and Fixes

### Issue 1: ALB Health Check Failing

**Symptoms:**

- ECS tasks start but ALB shows unhealthy
- Tasks are repeatedly stopped and restarted

**Diagnosis:**

```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw target_group_arn)

# Check task logs
aws logs tail /ecs/unifocus-dev-api --follow
```

**Common Causes:**

1. **Database not accessible**
   - Fix: Check security group rules allow ECS → RDS on port 5432
   - Fix: Verify DATABASE_URL secret is correct

2. **Missing environment variables**
   - Fix: Verify all required env vars in ECS task definition
   - Fix: Check secrets exist in Secrets Manager

3. **Health check endpoint misconfigured**
   - Fix: Ensure ALB health check uses `/ready` (not `/health`)
   - Fix: Verify health check path in target group settings

### Issue 2: Database Connection Errors

**Error:** `P1001: Can't reach database server`

**Fixes:**

```bash
# 1. Check security group allows ECS → RDS
aws ec2 describe-security-groups \
  --group-ids $(terraform output -raw rds_security_group_id)

# 2. Verify DATABASE_URL format
# Correct: postgresql://user:pass@host:5432/dbname
# Wrong: postgres://... (should be postgresql://)

# 3. Check RDS is in same VPC
aws rds describe-db-instances \
  --db-instance-identifier unifocus-dev \
  --query 'DBInstances[0].DBSubnetGroup.VpcId'
```

### Issue 3: CORS Errors in Web App

**Error:** `Access to fetch at 'http://...' from origin 'https://...' has been blocked by CORS policy`

**Fixes:**

```bash
# 1. Update CORS_ORIGIN in ECS task definition
# Should match CloudFront domain: https://d1234567890.cloudfront.net

# 2. Redeploy API with correct CORS_ORIGIN
aws ecs update-service \
  --cluster unifocus-dev \
  --service unifocus-dev-api \
  --force-new-deployment

# 3. Verify CORS headers
curl -I \
  -H "Origin: https://$CF_URL" \
  -H "Access-Control-Request-Method: POST" \
  http://$ALB_DNS/api/tenants
# Expected: Access-Control-Allow-Origin header
```

### Issue 4: JWT Validation Fails

**Error:** `Invalid JWT token` or `401 Unauthorized`

**Fixes:**

```bash
# 1. Verify Cognito configuration matches
# Check ECS task env vars match Cognito User Pool

# 2. Verify JWT_SECRET is set
aws secretsmanager get-secret-value \
  --secret-id unifocus/dev/jwt-secret

# 3. Check issuer URL matches exactly
# Must be: https://cognito-idp.REGION.amazonaws.com/USER_POOL_ID
```

### Issue 5: Migrations Not Applied

**Error:** `P2021: The table 'main.User' does not exist in the current database.`

**Fixes:**

```bash
# 1. Connect to ECS task and run migrations
TASK_ARN=$(aws ecs list-tasks --cluster unifocus-dev --service-name unifocus-dev-api --query 'taskArns[0]' --output text)
aws ecs execute-command --cluster unifocus-dev --task $TASK_ARN --container unifocus-api --interactive --command "/bin/sh"

# Inside container:
pnpm prisma migrate deploy

# 2. Verify migrations table
psql $DATABASE_URL -c "SELECT * FROM _prisma_migrations;"
```

### Issue 6: Web App Shows Blank Page

**Diagnosis:**

```bash
# Check browser console for errors
# Check CloudFront logs
aws logs tail /aws/cloudfront/unifocus-dev --follow

# Check S3 bucket contents
aws s3 ls s3://$(terraform output -raw web_bucket_name)/ --recursive
```

**Common Causes:**

1. **Build env vars missing**
   - Fix: Rebuild with VITE*API_URL, VITE_COGNITO*\* vars

2. **CloudFront not serving latest**
   - Fix: Create cache invalidation (see Phase 5.3)

3. **API URL incorrect**
   - Fix: Update VITE_API_URL to match ALB DNS
   - Fix: Ensure API URL includes protocol (http:// or https://)

---

## Deployment Verification Checklist

After completing all phases, verify:

- [ ] Infrastructure deployed: `terraform output` shows all resources
- [ ] RDS database accessible and migrations applied
- [ ] API responding on ALB: `curl http://$ALB_DNS/ready` returns 200
- [ ] ECS service stable: `aws ecs describe-services` shows `runningCount=desiredCount`
- [ ] ALB health checks passing: Target group shows healthy targets
- [ ] Web app accessible: `https://$CF_URL` loads successfully
- [ ] Security headers present: CSP, HSTS, X-Frame-Options, etc.
- [ ] E2E smoke test passes: All 11 tests green
- [ ] CloudWatch logs streaming: API logs visible in CloudWatch
- [ ] No errors in CloudWatch: Check for exceptions or 500s

---

## Rollback Procedure

If deployment fails and needs rollback:

```bash
# 1. Revert to previous ECS task definition
aws ecs update-service \
  --cluster unifocus-dev \
  --service unifocus-dev-api \
  --task-definition unifocus-dev-api:PREVIOUS_REVISION

# 2. Revert web deployment
# Re-upload previous dist/ build to S3
aws s3 sync previous-dist/ s3://$S3_BUCKET/ --delete
aws cloudfront create-invalidation --distribution-id $CF_DIST_ID --paths "/*"

# 3. Rollback database migrations (if needed)
# Connect to ECS and run:
pnpm prisma migrate resolve --rolled-back MIGRATION_NAME
```

---

## Success Criteria

**Deployment is successful when:**

✅ All infrastructure created without errors  
✅ API health check returns 200 OK  
✅ API readiness check returns 200 with database "ok"  
✅ Database migrations applied successfully  
✅ Web app loads and displays login page  
✅ E2E smoke test shows 11/11 tests passed  
✅ No 5xx errors in CloudWatch logs (first 30 minutes)  
✅ Security headers present on all web responses

---

## Next Steps After Deployment

1. **Configure GitHub Actions Secrets:**
   - `AWS_ROLE_ARN` - From `terraform output github_actions_role_arn`
   - `ECR_REPOSITORY_NAME` - From `terraform output ecr_repository_name`
   - `ECS_CLUSTER_NAME` - `unifocus-dev`
   - `ECS_SERVICE_NAME` - `unifocus-dev-api`
   - `S3_BUCKET_NAME` - From `terraform output web_bucket_name`
   - `CLOUDFRONT_DISTRIBUTION_ID` - From `terraform output cloudfront_distribution_id`

2. **Enable Auto-Deployment:**
   - Push to `main` branch triggers API deployment
   - Push to `main` branch triggers web deployment

3. **Set Up Monitoring:**
   - Configure CloudWatch alarms for 5xx errors
   - Set up ALB request count alarms
   - Monitor ECS CPU/memory utilization

4. **Create Cognito Users:**
   - Set up test users in Cognito User Pool
   - Verify authentication flow works end-to-end

---

**Deployment prepared by:** GitHub Copilot  
**Date:** February 4, 2026  
**Review status:** Ready for execution from local machine with AWS CLI, Terraform, and Docker installed
