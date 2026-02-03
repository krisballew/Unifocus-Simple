# Deployment Development Guide

This document provides deployment guidance for Unifocus, including environment configuration, migration strategies, and validation procedures.

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [AWS Configuration](#aws-configuration)
3. [Database Migrations in ECS](#database-migrations-in-ecs)
4. [Deployment Validation](#deployment-validation)

## Environment Variables

### API Service (`services/api`)

Required environment variables for the API server. Set these in AWS Systems Manager Parameter Store or ECS task definition.

#### Core Configuration

| Variable    | Required | Default   | Description                                      | AWS Location                    |
| ----------- | -------- | --------- | ------------------------------------------------ | ------------------------------- |
| `PORT`      | No       | `3001`    | Server port                                      | ECS Task Definition             |
| `HOST`      | No       | `0.0.0.0` | Server host                                      | ECS Task Definition             |
| `NODE_ENV`  | **Yes**  | -         | `production`, `staging`, or `development`        | ECS Task Definition             |
| `LOG_LEVEL` | No       | `info`    | Pino log level: `debug`, `info`, `warn`, `error` | Systems Manager Parameter Store |

#### Database Configuration

| Variable       | **Required** | Default | Description                                                             | AWS Location                    |
| -------------- | ------------ | ------- | ----------------------------------------------------------------------- | ------------------------------- |
| `DATABASE_URL` | **Yes**      | -       | PostgreSQL connection string: `postgresql://user:pass@host:5432/dbname` | **Secrets Manager** (encrypted) |

**Connection String Format:**

```
postgresql://username:password@hostname:5432/database_name
```

**AWS Secrets Manager Setup:**

```bash
aws secretsmanager create-secret \
  --name unifocus/api/database-url \
  --secret-string 'postgresql://user:password@rds-instance.amazonaws.com:5432/unifocus'
```

#### Redis Configuration

| Variable    | Required | Default | Description                                    | AWS Location    |
| ----------- | -------- | ------- | ---------------------------------------------- | --------------- |
| `REDIS_URL` | No       | ``      | Redis connection string (optional, future use) | Secrets Manager |

**Connection String Format:**

```
redis://hostname:6379
redis://password@hostname:6379
```

#### JWT & Authentication

| Variable                 | **Required** | Default                | Description                                                   | AWS Location                    |
| ------------------------ | ------------ | ---------------------- | ------------------------------------------------------------- | ------------------------------- |
| `JWT_SECRET`             | **Yes**      | `dev-secret-change-me` | Secret key for JWT signing (>32 chars recommended)            | **Secrets Manager** (encrypted) |
| `AUTH_SKIP_VERIFICATION` | No           | `false`                | Skip JWT verification (`true`/`false`) - **Development only** | ECS Task Definition             |

**Generate JWT Secret:**

```bash
openssl rand -base64 32
```

#### Cognito Configuration

| Variable               | **Required** | Default     | Description                                                                              | AWS Location                    |
| ---------------------- | ------------ | ----------- | ---------------------------------------------------------------------------------------- | ------------------------------- |
| `COGNITO_REGION`       | **Yes**      | `us-east-1` | AWS region for Cognito                                                                   | ECS Task Definition             |
| `COGNITO_USER_POOL_ID` | **Yes**      | -           | Cognito User Pool ID (format: `region_alphanumeric`)                                     | Systems Manager Parameter Store |
| `COGNITO_CLIENT_ID`    | **Yes**      | -           | Cognito App Client ID                                                                    | Systems Manager Parameter Store |
| `COGNITO_ISSUER`       | **Yes**      | -           | Cognito issuer URL: `https://cognito-idp.region.amazonaws.com/region_poolid`             | Systems Manager Parameter Store |
| `COGNITO_JWKS_URI`     | **Yes**      | -           | JWKS URI: `https://cognito-idp.region.amazonaws.com/region_poolid/.well-known/jwks.json` | Systems Manager Parameter Store |

**Example Cognito Configuration:**

```
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_Zzz9z99zZ
COGNITO_CLIENT_ID=7e89f0d8a1b2c3d4e5f6g7h8i9j0k1l2
COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Zzz9z99zZ
COGNITO_JWKS_URI=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Zzz9z99zZ/.well-known/jwks.json
```

#### CORS Configuration

| Variable      | Required | Default                 | Description                                                                    | AWS Location        |
| ------------- | -------- | ----------------------- | ------------------------------------------------------------------------------ | ------------------- |
| `CORS_ORIGIN` | No       | `http://localhost:3000` | Comma-separated allowed origins: `https://example.com,https://app.example.com` | ECS Task Definition |

#### Security & Rate Limiting

| Variable             | Required | Default      | Description                        | AWS Location        |
| -------------------- | -------- | ------------ | ---------------------------------- | ------------------- |
| `RATE_LIMIT_MAX`     | No       | `100`        | Max requests per rate limit window | ECS Task Definition |
| `RATE_LIMIT_WINDOW`  | No       | `15 minutes` | Rate limit time window             | ECS Task Definition |
| `REQUEST_JSON_LIMIT` | No       | `1mb`        | Max JSON request body size         | ECS Task Definition |
| `REQUEST_FORM_LIMIT` | No       | `10mb`       | Max form data request body size    | ECS Task Definition |

### Web App (`apps/web`)

Environment variables for the React frontend. Set these during build time (Vite).

#### Cognito Configuration

| Variable                    | **Required** | Default                               | Description                                           |
| --------------------------- | ------------ | ------------------------------------- | ----------------------------------------------------- |
| `VITE_COGNITO_REGION`       | **Yes**      | `us-east-1`                           | AWS region for Cognito                                |
| `VITE_COGNITO_USER_POOL_ID` | **Yes**      | -                                     | Cognito User Pool ID                                  |
| `VITE_COGNITO_CLIENT_ID`    | **Yes**      | -                                     | Cognito App Client ID                                 |
| `VITE_COGNITO_DOMAIN`       | **Yes**      | -                                     | Cognito domain (without `https://` or auth endpoints) |
| `VITE_COGNITO_REDIRECT_URI` | No           | `http://localhost:5173/auth/callback` | Redirect URI after login                              |
| `VITE_COGNITO_LOGOUT_URI`   | No           | `http://localhost:5173/login`         | Redirect URI after logout                             |

#### API Configuration

| Variable            | **Required** | Default                 | Description                             |
| ------------------- | ------------ | ----------------------- | --------------------------------------- |
| `VITE_API_BASE_URL` | **Yes**      | `http://localhost:3001` | API base URL: `https://api.example.com` |

**Example Web Environment:**

```
VITE_COGNITO_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=us-east-1_Zzz9z99zZ
VITE_COGNITO_CLIENT_ID=7e89f0d8a1b2c3d4e5f6g7h8i9j0k1l2
VITE_COGNITO_DOMAIN=unifocus-dev.auth.us-east-1.amazoncognito.com
VITE_COGNITO_REDIRECT_URI=https://app.example.com/auth/callback
VITE_COGNITO_LOGOUT_URI=https://app.example.com/login
VITE_API_BASE_URL=https://api.example.com
```

## AWS Configuration

### Setup Checklist

- [ ] **Cognito User Pool** - Create or obtain existing pool details
- [ ] **Cognito App Client** - Create app client with appropriate settings
- [ ] **RDS PostgreSQL** - Provision database instance
- [ ] **Secrets Manager** - Store sensitive values (DATABASE_URL, JWT_SECRET)
- [ ] **Systems Manager Parameter Store** - Store configuration (Cognito details, log level, etc.)
- [ ] **ECS Cluster** - Create or designate target cluster
- [ ] **ECR Repositories** - Create repositories for API and Web images
- [ ] **ALB/Load Balancer** - Configure for routing to services
- [ ] **CloudWatch** - Create log groups for services

### AWS Secrets Manager Setup

Store sensitive values that should not be visible in ECS task definitions:

```bash
# Store DATABASE_URL
aws secretsmanager create-secret \
  --name unifocus/api/database-url \
  --secret-string 'postgresql://user:pass@rds.amazonaws.com:5432/unifocus' \
  --region us-east-1

# Store JWT_SECRET
aws secretsmanager create-secret \
  --name unifocus/api/jwt-secret \
  --secret-string 'your-generated-secret-key-here' \
  --region us-east-1
```

**In ECS Task Definition, reference as:**

```json
{
  "name": "DATABASE_URL",
  "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:unifocus/api/database-url:password::"
}
```

### AWS Systems Manager Parameter Store Setup

Store non-sensitive configuration:

```bash
# Store Cognito settings
aws ssm put-parameter \
  --name /unifocus/api/cognito-user-pool-id \
  --value 'us-east-1_Zzz9z99zZ' \
  --type String

aws ssm put-parameter \
  --name /unifocus/api/cognito-client-id \
  --value '7e89f0d8a1b2c3d4e5f6g7h8i9j0k1l2' \
  --type String

# Store other config
aws ssm put-parameter \
  --name /unifocus/api/log-level \
  --value 'info' \
  --type String
```

**In ECS Task Definition, reference as:**

```json
{
  "name": "COGNITO_USER_POOL_ID",
  "valueFrom": "arn:aws:ssm:us-east-1:123456789:parameter:/unifocus/api/cognito-user-pool-id"
}
```

## Database Migrations in ECS

### Pre-deployment Migrations

Database migrations should run **before** the application starts to ensure schema is ready.

#### ECS Task Strategy

Create a separate **migration task** that runs before deploying the service:

```bash
# Run migration task (before service update)
aws ecs run-task \
  --cluster unifocus-cluster \
  --task-definition unifocus-api-migrate:1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx]}" \
  --overrides '{
    "containerOverrides": [{
      "name": "api-migrate",
      "command": ["pnpm", "db:migrate"]
    }]
  }'

# Wait for task to complete
aws ecs wait tasks-stopped --cluster unifocus-cluster --tasks <task-arn>

# Check task exit code (0 = success)
aws ecs describe-tasks --cluster unifocus-cluster --tasks <task-arn> \
  --query 'tasks[0].containers[0].exitCode'
```

#### Migration Task Definition

Create a task definition that runs migrations:

```json
{
  "family": "unifocus-api-migrate",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "api-migrate",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/unifocus-api:latest",
      "essential": true,
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:unifocus/api/database-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/unifocus-api-migrate",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### Dockerfile Migration Hook

Alternatively, include migration in the Dockerfile entrypoint:

```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN pnpm install --prod
EXPOSE 3001

# Entrypoint script runs migrations, then starts server
COPY scripts/docker-entrypoint.sh /
ENTRYPOINT ["/docker-entrypoint.sh"]
```

```bash
# scripts/docker-entrypoint.sh
#!/bin/sh
set -e

echo "Running database migrations..."
pnpm db:migrate

echo "Starting API server..."
node dist/index.js
```

#### Prisma Migrations in ECS

Our project uses Prisma. Migrations are applied with:

```bash
# Deployment migration (applies pending migrations, fails if schema mismatch)
pnpm db:migrate

# Development migration (interactive, creates new migrations)
pnpm db:migrate:dev
```

**In production, use:** `pnpm db:migrate` (non-interactive, fast-fails on issues)

#### Migration Monitoring

Check migration status in CloudWatch:

```bash
# View migration logs
aws logs tail /ecs/unifocus-api-migrate --follow

# Check for errors
aws logs filter-log-events \
  --log-group-name /ecs/unifocus-api-migrate \
  --filter-pattern "ERROR"
```

## Deployment Validation

### Pre-deployment Validation

Before deploying, validate that all required environment variables are present:

```bash
# From root of monorepo
pnpm validate:env

# Expected output:
# ✓ Validating environment variables...
# ✓ API required variables OK
# ✓ Web required variables OK
# ✓ All checks passed
```

The validation script (`scripts/validate-env.ts`):

- Checks all required variables are set
- Validates Cognito configuration format
- Ensures database connection string is valid
- Fails fast with clear error messages

### Post-deployment Validation

After ECS service deployment, validate the deployment was successful:

#### 1. Service Health Check

```bash
# Check service is running
aws ecs describe-services \
  --cluster unifocus-cluster \
  --services unifocus-api \
  --query 'services[0].[desiredCount,runningCount,status]'

# Expected: desiredCount == runningCount && status == ACTIVE
```

#### 2. Task Status Check

```bash
# Check task is healthy
aws ecs describe-tasks \
  --cluster unifocus-cluster \
  --tasks <task-arn> \
  --query 'tasks[0].[lastStatus,taskDefinitionArn]'

# Expected: lastStatus == RUNNING
```

#### 3. Application Endpoint Tests

```bash
# Test API health endpoint (no authentication required)
curl -s https://api.example.com/health | jq .
# Expected response:
# {
#   "status": "ok",
#   "uptime": 123.45
# }

# Test API /ready endpoint (checks database connectivity)
curl -s https://api.example.com/ready | jq .
# Expected response:
# {
#   "status": "ready",
#   "database": "connected"
# }
```

#### 4. Security Validation

```bash
# Check security headers are present
curl -i https://api.example.com/health 2>/dev/null | grep -i "^[a-z-]*:"

# Expected headers (should NOT see):
# x-powered-by: removed ✓

# Expected headers (should see):
# content-type: application/json ✓
# access-control-allow-origin: https://app.example.com ✓
```

#### 5. Application Logs

```bash
# Check for startup errors in CloudWatch
aws logs tail /ecs/unifocus-api --follow --since 10m

# Check for Cognito authentication errors
aws logs filter-log-events \
  --log-group-name /ecs/unifocus-api \
  --filter-pattern "authentication|401|403" \
  --since 10m
```

#### 6. Web Application Check

```bash
# Test web app is served
curl -s https://app.example.com | grep -o '<title>.*</title>'

# Check web app can reach API
# (Open browser dev tools, check /api calls for 200 response)
```

### Monitoring After Deployment

#### CloudWatch Metrics to Monitor

```bash
# API Response Time
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name ResponseTime \
  --dimensions Name=ServiceName,Value=unifocus-api \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum

# CPU Utilization
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=unifocus-api \
  --statistics Average,Maximum
```

#### Alarms to Set Up

```bash
# High error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name unifocus-api-errors \
  --alarm-description "Alert when API error rate > 5%" \
  --metric-name ErrorRate \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold
```

### Deployment Rollback

If validation fails after deployment:

```bash
# Revert to previous task definition
aws ecs update-service \
  --cluster unifocus-cluster \
  --service unifocus-api \
  --task-definition unifocus-api:$(( CURRENT_REVISION - 1 ))

# Wait for rollback to complete
aws ecs wait services-stable \
  --cluster unifocus-cluster \
  --services unifocus-api
```

## Deployment Checklist

- [ ] All required environment variables validated (`pnpm validate:env`)
- [ ] Database migrations run successfully
- [ ] API /health endpoint returns 200
- [ ] API /ready endpoint returns 200
- [ ] Security headers present on API responses
- [ ] Web app served at correct domain
- [ ] Web app can reach API and authenticate
- [ ] CloudWatch logs show no errors
- [ ] CloudWatch alarms configured and active
- [ ] Rate limiting tests pass (100 req/15 min per IP)
- [ ] CORS policy allows correct origins only
- [ ] JWT validation working (authorized requests succeed, unauthorized fail)

## Troubleshooting

### Environment Variable Issues

**Problem:** `Error: DATABASE_URL is required but not set`

**Solution:**

1. Verify the variable is set in Secrets Manager or Parameter Store
2. Check IAM permissions for ECS task role to access Secrets Manager
3. Verify the `valueFrom` format in task definition is correct

### Database Migration Failures

**Problem:** `Error: Migration task failed with exit code 1`

**Solution:**

1. Check migration logs: `aws logs tail /ecs/unifocus-api-migrate`
2. Verify DATABASE_URL is correct and accessible from ECS task
3. Check PostgreSQL security groups allow ECS task connectivity
4. Verify Prisma migrations are correct: `pnpm db:migrate:dev` (locally)

### Cognito Authentication Failures

**Problem:** `Error: Invalid Cognito configuration`

**Solution:**

1. Verify COGNITO_ISSUER and COGNITO_JWKS_URI are accessible
2. Check Cognito User Pool exists and App Client is configured
3. Verify VITE_COGNITO_DOMAIN matches Cognito domain in console
4. Test JWKS endpoint directly: `curl https://cognito-idp.region.amazonaws.com/poolid/.well-known/jwks.json`

### Performance Issues

**Problem:** `API response time > 1000ms`

**Solution:**

1. Check database query performance in PostgreSQL logs
2. Verify RDS instance has sufficient resources (CPU, memory)
3. Check CloudWatch metrics for high CPU/memory usage
4. Review rate limiting configuration if many 429 responses

## Additional Resources

- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)
- [ECS Task Definition Reference](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html)
- [AWS Secrets Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- [Cognito Integration Guide](./COGNITO_SETUP.md)
- [Security Baseline Documentation](./SECURITY_BASELINE.md)
