# GitHub Actions CI/CD Setup

This project uses GitHub Actions with AWS OIDC (OpenID Connect) federation for secure deployments without long-lived credentials.

## Architecture

- **GitHub OIDC**: GitHub acts as an identity provider that AWS trusts
- **IAM Role**: GitHub Actions assumes an AWS IAM role via temporary credentials
- **No Secrets**: No AWS access keys stored in GitHub - only the role ARN

## Workflows

### 1. Deploy Web to Dev (`deploy-web-dev.yml`)

Triggers on:

- Push to `main` branch affecting `apps/web/**` or `packages/**`
- Manual workflow dispatch

Steps:

1. Build the web app using Vite
2. Configure AWS credentials via OIDC
3. Sync built files to S3 bucket
4. Invalidate CloudFront cache

### 2. Deploy API to Dev (`deploy-api-dev.yml`)

Triggers on:

- Push to `main` branch affecting `services/api/**` or `packages/contracts/**`
- Manual workflow dispatch

Steps:

1. Build Docker image for the API
2. Configure AWS credentials via OIDC
3. Push image to Amazon ECR
4. Update ECS service with new task definition

## Setup Instructions

### 1. Deploy Terraform Infrastructure

First, deploy the AWS infrastructure including the OIDC provider:

```bash
cd infra/terraform/environments/dev

# Initialize Terraform
terraform init

# Set required variables
export TF_VAR_github_org="your-github-org"
export TF_VAR_github_repo="your-repo-name"

# Plan and apply
terraform plan
terraform apply
```

### 2. Configure GitHub Repository Secrets

After Terraform deployment, add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

#### Required Secrets

```bash
# Get from Terraform outputs
AWS_ROLE_ARN=$(terraform output -raw github_actions_role_arn)
WEB_BUCKET_NAME=$(terraform output -raw web_bucket_name)
CLOUDFRONT_DISTRIBUTION_ID=$(terraform output -raw cloudfront_distribution_id)
CLOUDFRONT_DOMAIN=$(terraform output -raw cloudfront_url)
ECR_REPOSITORY_NAME=$(terraform output -raw ecr_repository_url | cut -d'/' -f2)
ECS_CLUSTER_NAME=$(terraform output -raw ecs_cluster_name)
ECS_SERVICE_NAME=$(terraform output -raw ecs_service_name)
ECS_TASK_FAMILY="unifocus-dev-api"

# Add build-time environment variables
VITE_API_URL="https://$(terraform output -raw api_url)"
```

Add these to GitHub:

```bash
gh secret set AWS_ROLE_ARN --body "$AWS_ROLE_ARN"
gh secret set WEB_BUCKET_NAME --body "$WEB_BUCKET_NAME"
gh secret set CLOUDFRONT_DISTRIBUTION_ID --body "$CLOUDFRONT_DISTRIBUTION_ID"
gh secret set CLOUDFRONT_DOMAIN --body "$CLOUDFRONT_DOMAIN"
gh secret set ECR_REPOSITORY_NAME --body "$ECR_REPOSITORY_NAME"
gh secret set ECS_CLUSTER_NAME --body "$ECS_CLUSTER_NAME"
gh secret set ECS_SERVICE_NAME --body "$ECS_SERVICE_NAME"
gh secret set ECS_TASK_FAMILY --body "$ECS_TASK_FAMILY"
gh secret set VITE_API_URL --body "$VITE_API_URL"
```

### 3. Test Deployments

#### Manual Trigger

Go to Actions tab in GitHub and manually trigger workflows:

- **Deploy Web to Dev**: Builds and deploys the web app
- **Deploy API to Dev**: Builds and deploys the API

#### Automatic Trigger

Push changes to the `main` branch:

```bash
# Deploy web changes
git add apps/web/
git commit -m "Update web app"
git push origin main

# Deploy API changes
git add services/api/
git commit -m "Update API"
git push origin main
```

## Security Features

### OIDC Authentication Flow

1. GitHub Actions requests a JWT token from GitHub
2. Token contains claims about the workflow (repo, branch, etc.)
3. AWS validates the token against the OIDC provider
4. AWS verifies the token claims match the IAM role trust policy
5. AWS issues temporary credentials (valid for 1 hour)
6. Workflow uses temporary credentials for AWS API calls

### IAM Permissions

The GitHub Actions IAM role has least-privilege permissions:

**Web Deployment**:

- `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on web bucket
- `cloudfront:CreateInvalidation` on CloudFront distribution

**API Deployment**:

- `ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:PutImage` on ECR repository
- `ecs:UpdateService`, `ecs:DescribeServices`, `ecs:RegisterTaskDefinition` on ECS cluster/service
- `iam:PassRole` limited to ECS task execution and task roles

### Trust Policy

The IAM role can only be assumed by:

- GitHub's OIDC provider
- Workflows in the specified repository (`github_org/github_repo`)
- Any branch/tag (restricted by `repo:org/repo:*`)

To further restrict (e.g., main branch only):

```hcl
# In infra/terraform/modules/github-oidc/main.tf
condition {
  test     = "StringEquals"
  variable = "token.actions.githubusercontent.com:sub"
  values   = ["repo:${var.github_org}/${var.github_repo}:ref:refs/heads/main"]
}
```

## Monitoring

### Workflow Status

- View workflow runs: `https://github.com/ORG/REPO/actions`
- Each workflow shows detailed logs for debugging

### AWS Resources

Check deployment status:

```bash
# Web deployment
aws s3 ls s3://BUCKET_NAME/
aws cloudfront get-distribution --id DISTRIBUTION_ID

# API deployment
aws ecr describe-images --repository-name REPO_NAME
aws ecs describe-services --cluster CLUSTER_NAME --services SERVICE_NAME
```

### CloudWatch Logs

API logs are available in CloudWatch:

```bash
aws logs tail /ecs/unifocus-dev-api --follow
```

## Troubleshooting

### "Not authorized to perform sts:AssumeRoleWithWebIdentity"

- Verify GitHub org/repo match Terraform variables
- Check IAM role trust policy in AWS Console
- Ensure OIDC provider thumbprint is correct

### "Error: No space left on device" (Docker build)

- GitHub Actions runners have limited space
- Add cleanup step before build:

```yaml
- name: Clean up space
  run: |
    docker system prune -af
    sudo rm -rf /usr/local/lib/android
```

### CloudFront cache not invalidating

- Invalidations can take 5-15 minutes to propagate
- Check invalidation status:

```bash
aws cloudfront get-invalidation --distribution-id ID --id INVALIDATION_ID
```

### ECS service failing to stabilize

- Check ECS task logs in CloudWatch
- Verify security groups allow ALB → ECS traffic
- Ensure database is accessible from ECS tasks
- Check Secrets Manager secrets are configured

## Additional Resources

- [GitHub Actions OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS IAM OIDC Identity Providers](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
- [ECS Task Definition Parameters](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html)
