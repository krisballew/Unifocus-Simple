# Terraform Infrastructure Deployment - Summary

## Overview

This document summarizes the Terraform infrastructure setup for Unifocus, including deployment automation, state backend configuration, GitHub Actions OIDC integration, and infrastructure outputs.

**Status:** ✅ Ready for Deployment (Scaffolding Complete)

## Current Environment

- **AWS Region:** us-east-1 (for Cognito compatibility)
- **Environment:** dev
- **Terraform Version:** >= 1.5.0
- **AWS Provider Version:** ~> 5.0

## Deployment Scaffolding Complete

### What Has Been Set Up

#### 1. ✅ S3 + DynamoDB State Backend

- **S3 Bucket:** `unifocus-terraform-state-dev`
  - Versioning enabled
  - Server-side encryption (AES256)
  - Public access blocked
  - Purpose: Stores Terraform state securely
- **DynamoDB Table:** `unifocus-terraform-locks-dev`
  - Prevents concurrent modifications
  - Pay-per-request billing

#### 2. ✅ GitHub Actions OIDC Provider

- **OIDC Provider ARN:** `arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com`
- **GitHub Actions Role:** `unifocus-github-actions-dev`
- **Trust Policy:** Limited to `krisballew/Unifocus-Simple` repository
- **Attached Policies:**
  - ECR push/pull for images
  - ECS service updates
  - S3 web app deployment
  - CloudFront cache invalidation

#### 3. ✅ Terraform Modules (Pre-built)

All modules are fully implemented and ready:

| Module            | Resources                           | Status   |
| ----------------- | ----------------------------------- | -------- |
| `vpc`             | VPC, subnets, NAT Gateway, routing  | ✅ Ready |
| `security-groups` | ALB, ECS, RDS security groups       | ✅ Ready |
| `rds`             | PostgreSQL database (db.t3.micro)   | ✅ Ready |
| `ecs`             | Fargate cluster, service, ALB       | ✅ Ready |
| `ecr`             | Docker image repository             | ✅ Ready |
| `web-hosting`     | S3 bucket + CloudFront distribution | ✅ Ready |
| `secrets-manager` | Database and Cognito secrets        | ✅ Ready |
| `cloudwatch`      | Log groups for monitoring           | ✅ Ready |
| `github-oidc`     | OIDC provider and IAM roles         | ✅ Ready |
| `route53-acm`     | Custom domains and SSL (optional)   | ✅ Ready |
| `alarms`          | CloudWatch alarms for monitoring    | ✅ Ready |

#### 4. ✅ Deployment Automation

**Scripts Created:**

- `scripts/terraform-deploy.sh` - Full deployment orchestration
  - S3 bucket creation
  - DynamoDB table creation
  - Terraform initialization
  - Workspace management
  - Plan and apply
  - Output capture

- `scripts/terraform-preflight.sh` - Pre-deployment validation
  - Tool verification (terraform, aws cli, git)
  - AWS credentials check
  - Repository structure validation
  - Module existence verification
  - Environment readiness checks

**Documentation Created:**

- `docs/TERRAFORM_DEPLOYMENT.md` - Complete deployment guide
  - Prerequisites and setup
  - State backend configuration
  - Deployment process
  - GitHub Actions OIDC setup
  - Troubleshooting guide
  - Cleanup procedures

- `docs/TERRAFORM_OUTPUTS.md` - Infrastructure outputs reference
  - Output descriptions
  - Usage examples
  - Secret formats
  - Cost estimates
  - Manual AWS console steps
  - Deployment checklist

## Expected Infrastructure Outputs

When you run `terraform apply`, you will receive these outputs:

### Core Infrastructure

```
VPC ID:                    vpc-xxxxxxxxxxxxx
API Endpoint:              https://unifocus-alb-xxxxx.us-east-1.elb.amazonaws.com
CloudFront URL:            d123456789.cloudfront.net
ECR Repository:            ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/unifocus-api
RDS Endpoint:              unifocus-dev.xxxxx.us-east-1.rds.amazonaws.com:5432
```

### Services

```
ECS Cluster Name:          unifocus-dev
ECS Service Name:          unifocus-api-dev
CloudFront Distribution:   E123456789ABCDEF
S3 Bucket Name:           unifocus-web-dev-xxxxx
```

### Security & Access

```
GitHub OIDC Role ARN:      arn:aws:iam::ACCOUNT_ID:role/unifocus-github-actions-dev
DB Secret ARN:             arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:unifocus-db-dev-xxxxx
Cognito Secret ARN:        arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:unifocus-cognito-dev-xxxxx
```

## Deployment Steps

### Option 1: Automated Deployment (Recommended)

```bash
# From project root
./scripts/terraform-deploy.sh dev
```

This script handles:

- Prerequisites verification
- S3 bucket creation
- DynamoDB table setup
- Terraform initialization
- Workspace creation
- Plan review (with 10-second pause)
- Apply configuration
- Output capture

**Time estimate:** 15-20 minutes (mostly RDS provisioning)

### Option 2: Manual Deployment

```bash
# 1. Run pre-flight checks
./scripts/terraform-preflight.sh

# 2. Navigate to dev environment
cd infra/terraform/environments/dev

# 3. Initialize Terraform
terraform init

# 4. Create/select workspace
terraform workspace new dev
terraform workspace select dev

# 5. Plan deployment
terraform plan -out=tfplan

# 6. Review plan, then apply
terraform apply tfplan

# 7. Capture outputs
terraform output -json > ../../../terraform-outputs-dev.json
```

### Option 3: Step-by-Step Setup (If Backend Not Available)

```bash
# 1. Create S3 bucket manually
aws s3 mb s3://unifocus-terraform-state-dev --region us-east-1
aws s3api put-bucket-versioning --bucket unifocus-terraform-state-dev \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket unifocus-terraform-state-dev \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-public-access-block --bucket unifocus-terraform-state-dev \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# 2. Create DynamoDB table manually
aws dynamodb create-table --table-name unifocus-terraform-locks-dev \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region us-east-1

# 3. Continue with Option 2 steps
```

## GitHub Actions OIDC Configuration

### What's Already Configured

The Terraform module `github-oidc` automatically creates:

1. **OIDC Provider** in your AWS account
   - Federated trust with GitHub
   - Configured for your GitHub organization and repository

2. **IAM Role** with permissions for:
   - Pushing images to ECR
   - Updating ECS services
   - Deploying to S3
   - Invalidating CloudFront
   - Reading parameter store and secrets

3. **Trust Relationship**
   - Limited to your specific GitHub repo
   - Pattern: `repo:krisballew/Unifocus-Simple:*`

### GitHub Repository Configuration Needed

After deployment, add these repository secrets:

```
AWS_ROLE_TO_ASSUME     = (GitHub OIDC role ARN from Terraform output)
AWS_REGION             = us-east-1
AWS_ACCOUNT_ID         = (Your AWS account ID)
ECR_REPOSITORY         = unifocus-api
ECS_CLUSTER            = unifocus-dev
ECS_SERVICE            = unifocus-api-dev
```

### GitHub Actions Workflow Example

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Login to ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Push image
        run: |
          docker build -t ${{ steps.login-ecr.outputs.registry }}/unifocus-api:latest .
          docker push ${{ steps.login-ecr.outputs.registry }}/unifocus-api:latest

      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster ${{ secrets.ECS_CLUSTER }} \
            --service ${{ secrets.ECS_SERVICE }} \
            --force-new-deployment
```

## Infrastructure Cost Estimate

**Monthly costs for dev environment:**

| Component       | Estimate     | Notes                         |
| --------------- | ------------ | ----------------------------- |
| ECS Fargate     | $10-15       | 1 task, 256 CPU, 512 MB mem   |
| RDS db.t3.micro | $20-30       | Multi-AZ backup, 20GB storage |
| ALB             | $15-20       | Always running                |
| NAT Gateway     | $30-50       | Data transfer costs included  |
| CloudFront + S3 | $1-5         | Low traffic                   |
| CloudWatch Logs | $5-10        | Log retention 7 days          |
| **Total**       | **~$80-130** | Standard usage assumptions    |

**Cost reduction options:**

- Use single-AZ RDS (not recommended for prod)
- Stop ECS tasks during off-hours
- Use AWS free tier services if eligible
- Consolidate log retention

## Manual AWS Console Steps Required

After running `terraform apply`, complete these manual steps:

### 1. RDS Database Access

- [ ] Go to AWS RDS console
- [ ] Find instance: `unifocus-dev`
- [ ] Note endpoint and port
- [ ] Retrieve password from Secrets Manager

### 2. Store Secrets Securely

- [ ] Go to Secrets Manager
- [ ] Find and review:
  - `unifocus-db-dev` - Database credentials
  - `unifocus-cognito-dev` - Cognito configuration
- [ ] Save credentials locally (e.g., 1Password)

### 3. Build and Push Docker Image

```bash
# Build
docker build -t unifocus-api:latest services/api

# Get ECR repo from Terraform output
ECR_REPO=$(terraform output -raw ecr_repository_url)

# Login
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  ${ECR_REPO%/*}

# Push
docker tag unifocus-api:latest $ECR_REPO:latest
docker push $ECR_REPO:latest
```

### 4. Build and Upload Web App

```bash
# Build
cd apps/web && pnpm build

# Upload to S3
S3_BUCKET=$(terraform output -raw web_bucket_name)
aws s3 sync dist/ "s3://${S3_BUCKET}/" --delete

# Invalidate CloudFront
DIST_ID=$(terraform output -raw cloudfront_distribution_id)
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"
```

### 5. Configure GitHub Actions Secrets

- [ ] Go to GitHub repo > Settings > Secrets and variables > Actions
- [ ] Add secrets (see section above)

### 6. Configure Custom Domain (Optional)

- [ ] Create Route53 hosted zone for your domain
- [ ] Create ALIAS record for web app pointing to CloudFront
- [ ] Create ALIAS record for API pointing to ALB
- [ ] Request ACM certificate (automated DNS validation)

### 7. Test Infrastructure

- [ ] API health: `curl https://<API_URL>/health`
- [ ] Web app: Visit `https://<CLOUDFRONT_URL>`
- [ ] Check CloudWatch logs for errors
- [ ] Test database connection (if accessible)

## Verification Checklist

After deployment, verify:

- [ ] **VPC created**

  ```bash
  aws ec2 describe-vpcs --filters "Name=tag:Project,Values=unifocus"
  ```

- [ ] **RDS instance running**

  ```bash
  aws rds describe-db-instances --db-instance-identifier unifocus-dev
  ```

- [ ] **ECS service running**

  ```bash
  aws ecs describe-services --cluster unifocus-dev --services unifocus-api-dev
  ```

- [ ] **ECR repository created**

  ```bash
  aws ecr describe-repositories --repository-names unifocus-api
  ```

- [ ] **S3 bucket created**

  ```bash
  aws s3 ls | grep unifocus-web-dev
  ```

- [ ] **CloudFront distribution created**

  ```bash
  aws cloudfront list-distributions | grep unifocus-web
  ```

- [ ] **GitHub OIDC provider configured**

  ```bash
  aws iam list-open-id-connect-providers | grep token.actions
  ```

- [ ] **CloudWatch log groups created**
  ```bash
  aws logs describe-log-groups --log-group-name-prefix /ecs/unifocus
  ```

## Troubleshooting

### Error: "Access Denied" during Terraform init

**Cause:** IAM user lacks S3 or DynamoDB permissions

**Solution:**

- Verify IAM user has `AmazonS3FullAccess` and `AmazonDynamoDBFullAccess` (dev only)
- For production, use least-privilege policies

### Error: "Bucket already exists in different region"

**Cause:** S3 bucket name collision

**Solution:**

```bash
# Check bucket owner
aws s3api head-bucket --bucket unifocus-terraform-state-dev --region us-east-1

# If needed, use regional prefix
# Update backend.tf with: "unifocus-terraform-state-dev-us-east-1"
```

### Error: "Module requires: terraform >= 1.5.0"

**Solution:**

```bash
# Update Terraform
brew upgrade terraform  # or appropriate installer

# Or download from https://www.terraform.io/downloads
```

### RDS creation stuck (>10 minutes)

**Note:** First RDS deployment can take 10-15 minutes

**Check status:**

```bash
aws rds describe-db-instances --db-instance-identifier unifocus-dev \
  --query 'DBInstances[0].DBInstanceStatus'
```

**Monitor in console:** AWS RDS > Databases > unifocus-dev

### CloudFront not serving content

**Solutions:**

1. Verify S3 bucket has website hosting enabled
2. Upload files to S3: `aws s3 sync dist/ s3://bucket-name/`
3. Invalidate cache: `aws cloudfront create-invalidation`
4. Wait for cache invalidation to complete (can take 5-30 minutes)

## Cleanup/Destruction

To remove all resources and stop incurring costs:

```bash
cd infra/terraform/environments/dev

# Preview what will be deleted
terraform plan -destroy

# Delete all resources
terraform destroy

# Remove state backend (optional)
aws s3 rm s3://unifocus-terraform-state-dev --recursive
aws dynamodb delete-table --table-name unifocus-terraform-locks-dev --region us-east-1
```

⚠️ **Warning:** This is permanent. Backups are deleted.

## Support & Additional Resources

- **Terraform Documentation:** https://www.terraform.io/docs
- **AWS Provider Documentation:** https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- **GitHub OIDC:** https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect
- **AWS ECS Best Practices:** https://docs.aws.amazon.com/AmazonECS/latest/developerguide/best_practices.html
- **Terraform Best Practices:** https://www.terraform.io/docs/cloud/guides/recommended-practices.html

## Next Steps

1. **Run Pre-flight Check:** `./scripts/terraform-preflight.sh`
2. **Deploy Infrastructure:** `./scripts/terraform-deploy.sh dev`
3. **Capture Outputs:** Save Terraform outputs for reference
4. **Build and Push Images:** Docker build and push to ECR
5. **Deploy Web App:** Build React app and upload to S3
6. **Configure GitHub:** Add repository secrets
7. **Test Deployment:** Verify all endpoints accessible
8. **Monitor:** Check CloudWatch logs and alarms

---

**Scaffolding Status:** ✅ COMPLETE  
**Ready for Deployment:** ✅ YES  
**Documentation:** ✅ COMPREHENSIVE  
**GitHub OIDC:** ✅ CONFIGURED  
**State Backend:** ✅ CONFIGURED
