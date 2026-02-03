# GitHub Actions CI/CD Implementation Summary

## Overview

Implemented complete CI/CD pipelines for deploying the Unifocus application to AWS using GitHub Actions with OIDC authentication. This setup eliminates the need for long-lived AWS credentials stored as secrets.

## What Was Created

### 1. Terraform Infrastructure

#### GitHub OIDC Module (`infra/terraform/modules/github-oidc/`)

Creates the AWS IAM infrastructure for GitHub Actions authentication:

- **OIDC Provider**: Establishes trust with GitHub's identity provider
- **IAM Role**: Allows GitHub Actions to assume AWS credentials
- **Web Deployment Policy**: Grants permissions for S3 and CloudFront operations
- **API Deployment Policy**: Grants permissions for ECR and ECS operations

**Key Security Features**:

- Trust policy restricted to specific GitHub repository
- Least-privilege IAM permissions (only what's needed for deployments)
- No long-lived credentials (temporary tokens valid for 1 hour)
- Resource-specific ARN restrictions in policies

#### Updated Environment Configuration

Modified `infra/terraform/environments/dev/`:

- **main.tf**: Added github-oidc module integration
- **variables.tf**: Added github_org and github_repo variables
- **outputs.tf**: Exposed github_actions_role_arn and oidc_provider_arn

### 2. GitHub Actions Workflows

#### Web Deployment (`.github/workflows/deploy-web-dev.yml`)

Automated web app deployment pipeline:

**Triggers**:

- Pushes to `main` branch affecting `apps/web/**` or `packages/**`
- Manual workflow dispatch

**Steps**:

1. Checkout code
2. Setup Node.js and pnpm
3. Install dependencies with caching
4. Build web app with Vite
5. Configure AWS credentials via OIDC
6. Sync files to S3 (with smart caching headers)
7. Invalidate CloudFront cache
8. Display deployment summary

**Features**:

- Dependency caching for faster builds
- Immutable caching for assets (1 year)
- No-cache for index.html (ensures updates are fetched)
- Full CloudFront invalidation for immediate updates

#### API Deployment (`.github/workflows/deploy-api-dev.yml`)

Automated API deployment pipeline:

**Triggers**:

- Pushes to `main` branch affecting `services/api/**` or `packages/contracts/**`
- Manual workflow dispatch

**Steps**:

1. Checkout code
2. Configure AWS credentials via OIDC
3. Login to Amazon ECR
4. Build Docker image with BuildX
5. Tag image with commit SHA and latest
6. Push both tags to ECR
7. Download current ECS task definition
8. Update task definition with new image
9. Deploy to ECS service
10. Wait for service stability
11. Display deployment summary

**Features**:

- Multi-tag strategy (SHA for versioning, latest for convenience)
- Automatic task definition updates
- Zero-downtime deployments (ECS rolling updates)
- Service stability checks before completion

### 3. Docker Infrastructure

#### API Dockerfile (`services/api/Dockerfile`)

Multi-stage Docker build for the API:

**Build Stage**:

- Uses Node.js 20 Alpine for smaller image size
- Installs pnpm for efficient dependency management
- Builds contracts package and API service
- Generates Prisma Client

**Production Stage**:

- Minimal production dependencies only
- Copies pre-built artifacts from build stage
- Includes Prisma Client for database access
- Exposes port 3000
- Built-in health check endpoint
- Runs as single command: `node dist/index.js`

**Optimizations**:

- Multi-stage build reduces final image size
- Separate dependency and build layers for better caching
- Production-only dependencies in final image
- Alpine Linux base for minimal footprint

#### Docker Ignore (`.dockerignore`)

Optimizes Docker build context by excluding:

- node_modules (rebuilt in container)
- Build outputs (dist, build directories)
- Environment files
- IDE configurations
- Git files
- Documentation
- CI/CD files
- Frontend app (not needed for API build)
- Scripts directory

### 4. Documentation

#### Workflow README (`.github/workflows/README.md`)

Comprehensive guide covering:

**Setup Instructions**:

- Terraform deployment steps
- GitHub secrets configuration
- Testing procedures

**Security Features**:

- OIDC authentication flow explanation
- IAM permissions breakdown
- Trust policy configuration
- Security best practices

**Monitoring**:

- Workflow status checking
- AWS resource verification
- CloudWatch logs access

**Troubleshooting**:

- Common error scenarios
- Resolution steps
- Debugging tips

## How It Works

### OIDC Authentication Flow

1. **Workflow Starts**: GitHub Actions workflow begins execution
2. **Token Request**: Workflow requests JWT token from GitHub
3. **Token Claims**: Token includes repository, branch, and workflow information
4. **AWS Validation**: AWS IAM validates token against OIDC provider
5. **Trust Check**: AWS verifies token claims match role's trust policy
6. **Credential Issue**: AWS issues temporary credentials (valid 1 hour)
7. **Deployment**: Workflow uses temporary credentials for AWS operations

### Deployment Process

**Web Deployment**:

```
Code Push → Build Web App → Upload to S3 → Invalidate CloudFront → Live
```

**API Deployment**:

```
Code Push → Build Docker Image → Push to ECR → Update ECS Task → Rolling Update → Live
```

## Setup Required

To use these workflows, you need to:

1. **Deploy Terraform Infrastructure**:

   ```bash
   cd infra/terraform/environments/dev
   terraform init
   export TF_VAR_github_org="your-org"
   export TF_VAR_github_repo="your-repo"
   terraform apply
   ```

2. **Configure GitHub Secrets** (see .github/workflows/README.md):
   - AWS_ROLE_ARN
   - WEB_BUCKET_NAME
   - CLOUDFRONT_DISTRIBUTION_ID
   - CLOUDFRONT_DOMAIN
   - ECR_REPOSITORY_NAME
   - ECS_CLUSTER_NAME
   - ECS_SERVICE_NAME
   - ECS_TASK_FAMILY
   - VITE_API_URL

3. **Push to Main Branch** or **Trigger Manually**:
   - Changes to web or API will automatically deploy
   - Or use GitHub Actions UI to trigger manually

## Benefits

### Security

- ✅ No long-lived AWS credentials
- ✅ Temporary tokens with 1-hour expiration
- ✅ Least-privilege IAM permissions
- ✅ Repository-specific trust policy
- ✅ Auditable via AWS CloudTrail

### Developer Experience

- ✅ Automatic deployments on push to main
- ✅ Manual deployment option via UI
- ✅ Detailed logs for troubleshooting
- ✅ Build caching for faster runs
- ✅ Deployment status in GitHub UI

### Operations

- ✅ Zero-downtime deployments (ECS rolling updates)
- ✅ Rollback capability (ECR image tags by SHA)
- ✅ Service health checks before completion
- ✅ CloudWatch logs for monitoring
- ✅ Infrastructure as code (Terraform)

## Files Created/Modified

### New Files

- `.github/workflows/deploy-web-dev.yml` - Web deployment workflow
- `.github/workflows/deploy-api-dev.yml` - API deployment workflow
- `.github/workflows/README.md` - Comprehensive documentation
- `infra/terraform/modules/github-oidc/main.tf` - OIDC IAM infrastructure
- `infra/terraform/modules/github-oidc/variables.tf` - Module inputs
- `infra/terraform/modules/github-oidc/outputs.tf` - Module outputs
- `services/api/Dockerfile` - Multi-stage API container build
- `.dockerignore` - Docker build optimization

### Modified Files

- `infra/terraform/environments/dev/main.tf` - Added github-oidc module
- `infra/terraform/environments/dev/variables.tf` - Added GitHub variables
- `infra/terraform/environments/dev/outputs.tf` - Exposed OIDC outputs
- `infra/terraform/modules/ecs/outputs.tf` - Added role ARN outputs

## Commit

All changes committed in: `7e3e854` - "Add GitHub Actions CI/CD with OIDC authentication"

## Next Steps

1. Deploy the Terraform infrastructure with your GitHub org/repo
2. Configure GitHub secrets using the Terraform outputs
3. Test deployments by pushing to main or using manual triggers
4. Monitor first deployments to ensure everything works
5. Consider adding:
   - Staging environment workflows
   - Pull request preview deployments
   - Automated testing in CI
   - Slack/Teams notifications on deployment
   - Custom domain configuration for CloudFront
