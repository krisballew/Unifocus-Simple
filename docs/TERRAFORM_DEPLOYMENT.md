# Terraform Infrastructure Deployment Guide

This guide provides step-by-step instructions for deploying Unifocus infrastructure to AWS using Terraform, including state backend setup and GitHub Actions OIDC configuration.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [State Backend Setup](#state-backend-setup)
3. [Terraform Initialization](#terraform-initialization)
4. [Deployment Process](#deployment-process)
5. [GitHub Actions OIDC Setup](#github-actions-oidc-setup)
6. [Infrastructure Outputs](#infrastructure-outputs)
7. [Manual AWS Console Steps](#manual-aws-console-steps)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **Terraform** >= 1.5.0: [Install Terraform](https://www.terraform.io/downloads)
- **AWS CLI** >= 2.0: [Install AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- **Git** for version control
- **jq** (optional, for parsing JSON output)

### AWS Account Requirements

- Active AWS account with appropriate permissions
- IAM user or role with permissions to create:
  - S3 buckets
  - DynamoDB tables
  - VPC resources (subnets, gateways, route tables)
  - RDS database instances
  - ECS services and tasks
  - ECR repositories
  - IAM roles and policies
  - CloudWatch log groups
  - Secrets Manager secrets
  - Application Load Balancers
  - CloudFront distributions

### Install Terraform (Local Machine)

```bash
# macOS with Homebrew
brew install terraform

# macOS with direct download
wget https://releases.hashicorp.com/terraform/1.7.0/terraform_1.7.0_darwin_amd64.zip
unzip terraform_1.7.0_darwin_amd64.zip
sudo mv terraform /usr/local/bin/

# Linux
wget https://releases.hashicorp.com/terraform/1.7.0/terraform_1.7.0_linux_amd64.zip
unzip terraform_1.7.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# Windows (via Chocolatey)
choco install terraform
```

### Configure AWS CLI

```bash
# Configure AWS credentials
aws configure

# You'll be prompted for:
# AWS Access Key ID
# AWS Secret Access Key
# Default region (us-east-1)
# Default output format (json)

# Verify credentials
aws sts get-caller-identity
```

## State Backend Setup

Terraform state is stored in S3 with DynamoDB locking for safe concurrent operations.

### Automated Setup (Using Script)

```bash
# From project root
./scripts/terraform-deploy.sh dev
```

The script automatically:

- Creates S3 bucket if needed
- Enables versioning on S3
- Encrypts S3 bucket
- Blocks public access on S3
- Creates DynamoDB table if needed
- Initializes Terraform workspace

### Manual Setup (If Script Unavailable)

#### 1. Create S3 Bucket for State

```bash
# Create bucket
aws s3 mb s3://unifocus-terraform-state-dev --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket unifocus-terraform-state-dev \
  --versioning-configuration Status=Enabled

# Enable server-side encryption
aws s3api put-bucket-encryption \
  --bucket unifocus-terraform-state-dev \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Block public access (critical for security)
aws s3api put-public-access-block \
  --bucket unifocus-terraform-state-dev \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

#### 2. Create DynamoDB Table for State Locking

```bash
aws dynamodb create-table \
  --table-name unifocus-terraform-locks-dev \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

#### 3. Enable Backend Configuration

Once S3 and DynamoDB are created, uncomment the backend block in `infra/terraform/environments/dev/backend.tf`:

```hcl
terraform {
  backend "s3" {
    bucket         = "unifocus-terraform-state-dev"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "unifocus-terraform-locks-dev"
  }
}
```

## Terraform Initialization

### Initialize Terraform

```bash
cd infra/terraform/environments/dev

# Initialize Terraform
terraform init
```

**Output should show:**

```
Terraform has been successfully initialized!
```

### Create/Select Workspace

Workspaces allow managing multiple environments with separate state:

```bash
# List workspaces
terraform workspace list

# Create dev workspace if it doesn't exist
terraform workspace new dev

# Select the dev workspace
terraform workspace select dev

# Current workspace is marked with *
terraform workspace list
# Output:
# default
# * dev
# prod
# stage
```

## Deployment Process

### 1. Review Configuration

```bash
# Review what will be created
cd infra/terraform/environments/dev
terraform plan
```

**Key resources that will be created:**

- VPC with public/private subnets across 2 AZs
- NAT Gateway for private subnet internet access
- RDS PostgreSQL database instance (db.t3.micro)
- ECS Fargate cluster and service
- Application Load Balancer
- ECR repository for Docker images
- S3 bucket and CloudFront distribution for web hosting
- Security groups and network ACLs
- CloudWatch log groups
- Secrets Manager secrets
- IAM roles for ECS and GitHub Actions

### 2. Apply Configuration

```bash
cd infra/terraform/environments/dev

# Create a plan file first (recommended for safety)
terraform plan -out=tfplan

# Review the plan, then apply
terraform apply tfplan

# Or apply directly (skips saving plan file)
terraform apply
```

**First deployment takes 10-15 minutes.** Monitor progress in the terminal.

### 3. Capture Outputs

```bash
# Display all outputs
terraform output

# Get specific outputs
terraform output -raw api_url
terraform output -raw ecr_repository_url
terraform output -raw rds_endpoint

# Save outputs to file
terraform output -json > ../../../terraform-outputs-dev.json
```

### 4. Verify Deployment

```bash
# Check VPC was created
aws ec2 describe-vpcs \
  --filters "Name=tag:Project,Values=unifocus" \
  --query 'Vpcs[0].VpcId' \
  --region us-east-1

# Check RDS instance
aws rds describe-db-instances \
  --db-instance-identifier unifocus-dev \
  --query 'DBInstances[0].DBInstanceStatus' \
  --region us-east-1

# Check ECS service
aws ecs describe-services \
  --cluster unifocus-dev \
  --services unifocus-api-dev \
  --region us-east-1
```

## GitHub Actions OIDC Setup

GitHub Actions OIDC allows secure, keyless deployment without storing AWS credentials as secrets.

### 1. Enable GitHub OIDC Provider in AWS

This is created automatically by Terraform (`modules/github-oidc`), but verify:

```bash
# List OIDC providers
aws iam list-open-id-connect-providers

# Should show GitHub OIDC provider:
# arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com
```

### 2. GitHub Actions Role

The role is created by Terraform with policies to:

- Push to ECR repository
- Update ECS service
- Sync web assets to S3
- Invalidate CloudFront

**Role ARN:** (get from Terraform output)

```bash
terraform output -raw github_oidc_role_arn
```

### 3. Configure GitHub Repository Secrets

Add the following secrets to your GitHub repository:

```bash
# Repository > Settings > Secrets and variables > Actions > New repository secret

# AWS Role ARN
AWS_ROLE_TO_ASSUME = arn:aws:iam::ACCOUNT_ID:role/unifocus-github-actions-dev

# AWS Region
AWS_REGION = us-east-1

# AWS Account ID
AWS_ACCOUNT_ID = ACCOUNT_ID

# ECR Repository
ECR_REPOSITORY = unifocus-api

# ECS Cluster
ECS_CLUSTER = unifocus-dev

# ECS Service
ECS_SERVICE = unifocus-api-dev
```

### 4. GitHub Actions Workflow Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS

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

      - name: Push image to ECR
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

## Infrastructure Outputs

After successful deployment, Terraform provides outputs for all resources.

### Get All Outputs

```bash
terraform output
```

### Key Outputs Explained

#### API Endpoint

```
api_endpoint: https://unifocus-alb-XXXXX.us-east-1.elb.amazonaws.com
```

- Application Load Balancer DNS name
- Used for API access
- In production, create Route53 alias to custom domain

#### CloudFront URL

```
cloudfront_url: d123456789.cloudfront.net
```

- CloudFront distribution domain
- Used for web app hosting
- In production, create Route53 alias to custom domain

#### ECR Repository

```
ecr_repository_url: ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/unifocus-api
```

- Docker image repository
- Push API images: `docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/unifocus-api:latest`

#### RDS Endpoint

```
rds_endpoint: unifocus-dev.XXXXX.us-east-1.rds.amazonaws.com:5432
```

- PostgreSQL database endpoint
- Store in Secrets Manager or environment variables
- Connection string: `postgresql://username:password@endpoint:5432/unifocus`

#### Secrets Manager ARNs

```
db_secret_arn: arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:unifocus-db-dev-XXXXX
cognito_secret_arn: arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:unifocus-cognito-dev-XXXXX
```

- Secure storage for database credentials and Cognito configuration
- Used by ECS tasks to retrieve secrets
- Retrieved via IAM role permissions

#### ECS Resources

```
ecs_cluster_name: unifocus-dev
ecs_service_name: unifocus-api-dev
```

- Container orchestration cluster and service
- Update service to trigger new deployments
- Scale horizontally by modifying desired_count

#### GitHub Actions Role

```
github_oidc_role_arn: arn:aws:iam::ACCOUNT_ID:role/unifocus-github-actions-dev
```

- OIDC role for GitHub Actions
- Use with `aws-actions/configure-aws-credentials@v4`
- Enables keyless authentication

### Save Outputs for Reference

```bash
# JSON format (recommended)
terraform output -json > terraform-outputs.json

# Text format
terraform output > terraform-outputs.txt

# Individual values
echo "API URL: $(terraform output -raw api_endpoint)" >> deployment-info.txt
echo "ECR Repo: $(terraform output -raw ecr_repository_url)" >> deployment-info.txt
```

## Manual AWS Console Steps

Some tasks require manual AWS Console configuration.

### 1. Update RDS Database Credentials

After Terraform creates RDS:

1. Go to **AWS Secrets Manager** in the console
2. Find secret: `unifocus-db-dev`
3. Note the database password (shown in secret value)
4. Update application configuration with credentials

### 2. Store Cognito Configuration

1. Go to **Cognito** in AWS Console
2. Find your User Pool: `unifocus-dev`
3. Get:
   - User Pool ID
   - App Client ID
   - Cognito Domain
4. Update Secrets Manager secret: `unifocus-cognito-dev`
5. Or store in Parameter Store for build-time configuration

### 3. Upload Web App Build to S3

After building the web app:

```bash
# Build web app
cd apps/web
pnpm build

# Get S3 bucket name
WEB_BUCKET=$(terraform output -raw web_bucket_name)

# Upload to S3
aws s3 sync dist/ "s3://${WEB_BUCKET}/" --delete

# Get CloudFront distribution ID
DIST_ID=$(terraform output -raw cloudfront_distribution_id)

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/*"
```

### 4. Configure Custom Domain (Optional)

If using Route53 and custom domain:

1. Go to **Route53** in AWS Console
2. Create ALIAS record for web app:
   - Name: `app.example.com`
   - Type: A
   - Alias: CloudFront distribution
3. Create ALIAS record for API:
   - Name: `api.example.com`
   - Type: A
   - Alias: ALB

### 5. Configure SSL/TLS Certificate

If using custom domains:

1. Go to **ACM (Certificate Manager)** in AWS Console (us-east-1)
2. Request new certificate
3. Add domains: `example.com`, `*.example.com`
4. Validate via DNS (Route53 will have automated button)
5. Attach to CloudFront distribution
6. Update CloudFront behavior to use certificate

### 6. Create CloudWatch Alarms

Alarms are created by Terraform, but verify in **CloudWatch** console:

1. Go to **CloudWatch > Alarms**
2. Should see alarms for:
   - High CPU on ECS
   - High error rate on ALB
   - RDS database issues
   - Low disk space on RDS

### 7. Configure Health Check Notifications

1. Go to **CloudWatch > Alarms**
2. For each alarm, set SNS topic
3. Add email subscription to SNS topic
4. Confirm email subscription

## Troubleshooting

### Error: "Access Denied" when running Terraform

**Problem:** IAM user doesn't have required permissions

**Solution:**

```bash
# Attach AdministratorAccess (temporary, for dev only)
# Better: Attach specific policy for Terraform resources needed
# See AWS documentation for minimal permissions
```

### Error: "Bucket already exists"

**Problem:** Someone else created the bucket, or you ran deploy twice

**Solution:**

```bash
# Check bucket owner
aws s3api head-bucket --bucket unifocus-terraform-state-dev

# If it's your bucket, proceed - state file will update
# If it's someone else's, use different bucket name or region
```

### Error: "DynamoDB table already exists"

**Solution:**

```bash
# No action needed - Terraform will use existing table
# Just proceed with terraform init
```

### Error: "Terraform lock on state file"

**Problem:** Another deployment is in progress

**Solution:**

```bash
# Wait for other deployment to finish, or force unlock (dangerous)
terraform force-unlock LOCK_ID

# Better: Check who's deploying
aws dynamodb scan --table-name unifocus-terraform-locks-dev --region us-east-1
```

### RDS Still Creating (Stuck at "Creating")

**Problem:** RDS creation takes time (5-10 minutes for first deployment)

**Solution:**

```bash
# Check RDS status
aws rds describe-db-instances \
  --db-instance-identifier unifocus-dev \
  --query 'DBInstances[0].DBInstanceStatus' \
  --region us-east-1

# Wait for status to become "available"
# Monitor progress in AWS Console > RDS > Databases
```

### CloudFront Distribution Not Serving Content

**Problem:** S3 bucket or CloudFront not configured correctly

**Solution:**

```bash
# 1. Verify bucket has website hosting enabled
aws s3 website "s3://$(terraform output -raw web_bucket_name)" \
  --index-document index.html \
  --error-document index.html

# 2. Invalidate CloudFront cache
DIST_ID=$(terraform output -raw cloudfront_distribution_id)
aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/*"

# 3. Check origin access identity permissions
# (Should be set up by Terraform)
```

### ECS Task Not Starting

**Problem:** Task definition or environment configuration issue

**Solution:**

```bash
# Check task status
aws ecs describe-tasks \
  --cluster unifocus-dev \
  --tasks $(aws ecs list-tasks --cluster unifocus-dev --query 'taskArns[0]' --output text) \
  --region us-east-1

# Check logs
CONTAINER_INSTANCE=$(aws ecs describe-container-instances \
  --cluster unifocus-dev \
  --query 'containerInstances[0].containerInstanceArn' --output text)

# View ECS logs in CloudWatch
aws logs tail /ecs/unifocus-api-dev --follow
```

### GitHub Actions Deployment Fails

**Problem:** OIDC role configuration issue

**Solution:**

```bash
# 1. Verify OIDC provider exists
aws iam list-open-id-connect-providers | grep token.actions.githubusercontent.com

# 2. Check role trust relationship
aws iam get-role --role-name unifocus-github-actions-dev

# 3. Verify GitHub org and repo names match Terraform vars
# Check variables.tf for github_org and github_repo

# 4. Test role assumption
aws sts assume-role-with-web-identity \
  --role-arn arn:aws:iam::ACCOUNT_ID:role/unifocus-github-actions-dev \
  --role-session-name test-session \
  --web-identity-token $GITHUB_TOKEN

# (This requires GITHUB_TOKEN from Actions)
```

## Destroying Infrastructure (Cleanup)

To remove all AWS resources and avoid costs:

```bash
cd infra/terraform/environments/dev

# Preview what will be destroyed
terraform plan -destroy

# Delete all resources
terraform destroy

# Remove state files from S3 (optional, for complete cleanup)
aws s3 rm s3://unifocus-terraform-state-dev --recursive
aws dynamodb delete-table --table-name unifocus-terraform-locks-dev --region us-east-1
```

⚠️ **Warning:** This permanently deletes all infrastructure and data. Make sure this is intended.

## Additional Resources

- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/best_practices.html)
- [Terraform Best Practices](https://www.terraform.io/docs/cloud/guides/recommended-practices.html)
- [GitHub OIDC with AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
