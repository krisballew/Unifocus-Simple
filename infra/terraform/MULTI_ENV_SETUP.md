# Multi-Environment Terraform Setup Guide

This guide explains how to deploy the Unifocus infrastructure across multiple environments (dev, stage, prod) with proper configuration for domains, certificates, backups, auto-scaling, and monitoring.

## Architecture Overview

### Environments

| Environment | Purpose               | Resources                  | Deployment               |
| ----------- | --------------------- | -------------------------- | ------------------------ |
| **dev**     | Development & testing | Minimal (t3.micro, 1 task) | Auto on push to main     |
| **stage**   | Pre-production UAT    | Medium (t3.small, 2 tasks) | Auto on tag `v*-stage`   |
| **prod**    | Production            | Full (r6g.large, 3+ tasks) | Manual approval required |

### Key Features

- **Multi-Environment**: Separate AWS resources for dev/stage/prod
- **Custom Domains**: ACM certificates + Route53 DNS (optional)
- **RDS Backups**: Configurable retention (7/14/30 days)
- **ECS Auto-Scaling**: CPU/memory/request-based scaling
- **CloudWatch Alarms**: CPU, memory, 5xx errors, RDS metrics
- **OIDC Deployment**: Secure GitHub Actions with no long-lived credentials

## Prerequisites

### Required Tools

```bash
# Install Terraform
brew install terraform  # macOS
# or download from https://www.terraform.io/downloads

# Install AWS CLI
brew install awscli

# Configure AWS credentials
aws configure
```

### AWS Account Setup

1. **AWS Account** with appropriate permissions
2. **Route53 Hosted Zone** (optional, for custom domains)
3. **GitHub Repository** for OIDC integration

## Environment Configuration

### 1. Dev Environment

**infra/terraform/environments/dev/**

- VPC CIDR: `10.0.0.0/16`
- RDS: `db.t3.micro`, 20GB, 7-day backups
- ECS: 256 CPU, 512 MB memory, 1-4 tasks
- Auto-deploy: On push to `main`

### 2. Stage Environment

**infra/terraform/environments/stage/**

- VPC CIDR: `10.1.0.0/16`
- RDS: `db.t3.small`, 20GB, 14-day backups, Performance Insights
- ECS: 512 CPU, 1024 MB memory, 2-8 tasks
- Auto-deploy: On tag `v*-stage`

### 3. Prod Environment

**infra/terraform/environments/prod/**

- VPC CIDR: `10.2.0.0/16`
- RDS: `db.r6g.large`, 100GB, 30-day backups, deletion protection
- ECS: 1024 CPU, 2048 MB memory, 3-20 tasks
- Deploy: Manual approval required

## Deployment Steps

### Step 1: Prepare Backend Storage

Create S3 buckets and DynamoDB tables for Terraform state:

```bash
# For each environment (dev, stage, prod)
export ENV=dev  # or stage, prod

# Create S3 bucket
aws s3 mb s3://unifocus-terraform-state-${ENV} --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket unifocus-terraform-state-${ENV} \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket unifocus-terraform-state-${ENV} \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Create DynamoDB lock table
aws dynamodb create-table \
  --table-name unifocus-terraform-locks-${ENV} \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### Step 2: Uncomment Backend Configuration

Edit `backend.tf` in each environment and uncomment:

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

### Step 3: Configure Variables

Create `terraform.tfvars` in each environment:

**infra/terraform/environments/dev/terraform.tfvars**:

```hcl
# Project settings
project_name = "unifocus"
environment  = "dev"
aws_region   = "us-east-1"

# GitHub OIDC
github_org  = "your-github-org"
github_repo = "your-repo-name"

# Optional: Custom domains (leave empty to use AWS-generated URLs)
root_domain     = ""  # e.g., "example.com"
web_domain_name = ""  # e.g., "dev.app.example.com"
api_domain_name = ""  # e.g., "dev-api.example.com"

# Alarms
alarm_email = "alerts@example.com"
```

**infra/terraform/environments/stage/terraform.tfvars**:

```hcl
project_name = "unifocus"
environment  = "stage"
aws_region   = "us-east-1"

github_org  = "your-github-org"
github_repo = "your-repo-name"

# Stage domains
root_domain     = "example.com"
web_domain_name = "stage.app.example.com"
api_domain_name = "stage-api.example.com"

alarm_email = "alerts@example.com"
```

**infra/terraform/environments/prod/terraform.tfvars**:

```hcl
project_name = "unifocus"
environment  = "prod"
aws_region   = "us-east-1"

github_org  = "your-github-org"
github_repo = "your-repo-name"

# Production domains
root_domain     = "example.com"
web_domain_name = "app.example.com"
api_domain_name = "api.example.com"

alarm_email = "oncall@example.com"
```

### Step 4: Deploy Infrastructure

Deploy each environment:

```bash
# Deploy dev
cd infra/terraform/environments/dev
terraform init
terraform plan
terraform apply

# Deploy stage
cd ../stage
terraform init
terraform plan
terraform apply

# Deploy prod
cd ../prod
terraform init
terraform plan
terraform apply
```

### Step 5: Configure GitHub Secrets

After Terraform deployment, configure GitHub Actions secrets:

```bash
# Function to get outputs and set GitHub secrets
setup_github_secrets() {
  local ENV=$1
  cd infra/terraform/environments/${ENV}

  # Get Terraform outputs
  AWS_ROLE_ARN=$(terraform output -raw github_actions_role_arn)
  WEB_BUCKET=$(terraform output -raw web_bucket_name)
  CF_DIST_ID=$(terraform output -raw cloudfront_distribution_id)
  CF_DOMAIN=$(terraform output -raw cloudfront_url)
  ECR_REPO=$(terraform output -raw ecr_repository_url | cut -d'/' -f2)
  ECS_CLUSTER=$(terraform output -raw ecs_cluster_name)
  ECS_SERVICE=$(terraform output -raw ecs_service_name)
  API_URL=$(terraform output -raw api_endpoint)

  # Set GitHub secrets (uppercase environment name for secret suffix)
  ENV_UPPER=$(echo ${ENV} | tr '[:lower:]' '[:upper:]')

  gh secret set AWS_ROLE_ARN_${ENV_UPPER} --body "$AWS_ROLE_ARN"
  gh secret set WEB_BUCKET_NAME_${ENV_UPPER} --body "$WEB_BUCKET"
  gh secret set CLOUDFRONT_DISTRIBUTION_ID_${ENV_UPPER} --body "$CF_DIST_ID"
  gh secret set CLOUDFRONT_DOMAIN_${ENV_UPPER} --body "$CF_DOMAIN"
  gh secret set ECR_REPOSITORY_NAME_${ENV_UPPER} --body "$ECR_REPO"
  gh secret set ECS_CLUSTER_NAME_${ENV_UPPER} --body "$ECS_CLUSTER"
  gh secret set ECS_SERVICE_NAME_${ENV_UPPER} --body "$ECS_SERVICE"
  gh secret set ECS_TASK_FAMILY_${ENV_UPPER} --body "unifocus-${ENV}-api"
  gh secret set VITE_API_URL_${ENV_UPPER} --body "$API_URL"
}

# Run for each environment
setup_github_secrets dev
setup_github_secrets stage
setup_github_secrets prod
```

Or manually in GitHub UI (Settings → Secrets → Actions):

**For each environment** (DEV, STAGE, PROD):

- `AWS_ROLE_ARN_{ENV}`
- `WEB_BUCKET_NAME_{ENV}`
- `CLOUDFRONT_DISTRIBUTION_ID_{ENV}`
- `CLOUDFRONT_DOMAIN_{ENV}`
- `ECR_REPOSITORY_NAME_{ENV}`
- `ECS_CLUSTER_NAME_{ENV}`
- `ECS_SERVICE_NAME_{ENV}`
- `ECS_TASK_FAMILY_{ENV}` (e.g., "unifocus-prod-api")
- `VITE_API_URL_{ENV}`

### Step 6: Configure Production Approvals

Set up manual approval for production:

1. Go to GitHub repo → Settings → Environments
2. Click "New environment" → Name: "production"
3. Enable "Required reviewers"
4. Add team members who can approve prod deployments
5. Set "Wait timer" (optional, e.g., 5 minutes)
6. Save protection rules

## Custom Domain Setup

If using custom domains (recommended for stage/prod):

### Prerequisites

- Route53 hosted zone for your domain
- Domain name registered (can be in Route53 or external)

### Configuration

Set variables in `terraform.tfvars`:

```hcl
root_domain     = "example.com"          # Your hosted zone
web_domain_name = "app.example.com"      # Web app domain
api_domain_name = "api.example.com"      # API domain
```

### How It Works

1. **ACM Certificates**: Terraform creates SSL certificates
   - Web cert in `us-east-1` (required for CloudFront)
   - API cert in your region (for ALB)

2. **DNS Validation**: Route53 records automatically created for cert validation

3. **DNS Records**: A records created pointing to:
   - CloudFront distribution (web)
   - Application Load Balancer (API)

### Verify Setup

After deployment:

```bash
# Check certificate status
aws acm list-certificates --region us-east-1

# Verify DNS records
dig app.example.com
dig api.example.com

# Test connectivity
curl https://app.example.com
curl https://api.example.com/health
```

## Monitoring and Alarms

### CloudWatch Alarms

Automatically created for each environment:

**ECS Alarms**:

- CPU utilization > 80%
- Memory utilization > 80%

**ALB Alarms**:

- Target 5xx errors > 10/5min
- ALB 5xx errors > 10/5min
- Unhealthy target count > 0

**RDS Alarms**:

- CPU utilization > 80%
- Free storage < 5GB
- Database connections > 80

### Email Notifications

Alarms send to email specified in `alarm_email` variable.

**To confirm subscription**:

1. Check email after first Terraform apply
2. Click "Confirm subscription" link
3. Alarms will now send to this email

### View Alarms

```bash
# List alarms
aws cloudwatch describe-alarms --state-value ALARM

# View specific alarm
aws cloudwatch describe-alarms \
  --alarm-names unifocus-prod-ecs-cpu-high
```

## Auto-Scaling Configuration

### ECS Auto-Scaling

Each environment has different scaling limits:

| Environment | Min Tasks | Max Tasks | CPU Target | Memory Target |
| ----------- | --------- | --------- | ---------- | ------------- |
| dev         | 1         | 4         | 70%        | 80%           |
| stage       | 2         | 8         | 70%        | 80%           |
| prod        | 3         | 20        | 70%        | 80%           |

**Scaling Policies**:

- **CPU-based**: Scales when average CPU > 70%
- **Memory-based**: Scales when average memory > 80%
- **Request-based** (prod only): Scales when ALB requests > 1000/target

**Cooldown Periods**:

- Scale out: 60 seconds
- Scale in: 300 seconds (5 minutes)

### View Scaling Activity

```bash
# View current task count
aws ecs describe-services \
  --cluster unifocus-prod-cluster \
  --services unifocus-prod-api-service \
  --query 'services[0].{desired:desiredCount,running:runningCount}'

# View scaling activities
aws application-autoscaling describe-scaling-activities \
  --service-namespace ecs \
  --resource-id service/unifocus-prod-cluster/unifocus-prod-api-service
```

## RDS Backup and Retention

### Backup Configuration

| Environment | Retention | Final Snapshot | Deletion Protection | Monitoring |
| ----------- | --------- | -------------- | ------------------- | ---------- |
| dev         | 7 days    | Skip           | Disabled            | Basic      |
| stage       | 14 days   | Created        | Disabled            | Enhanced   |
| prod        | 30 days   | Created        | **Enabled**         | Enhanced   |

### Backup Windows

- **Backup window**: 03:00-04:00 UTC (automated backups)
- **Maintenance window**: Monday 04:00-05:00 UTC

### Manual Backup

```bash
# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier unifocus-prod-db \
  --db-snapshot-identifier unifocus-prod-manual-$(date +%Y%m%d-%H%M)

# List snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier unifocus-prod-db
```

### Restore from Backup

```bash
# Restore to new instance
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier unifocus-prod-db-restored \
  --db-snapshot-identifier <snapshot-id>
```

## Cost Optimization

### Dev Environment

- Uses smallest instances (t3.micro)
- Minimal task count (1)
- Short backup retention (7 days)
- **Estimated**: $50-100/month

### Stage Environment

- Small instances (t3.small)
- Moderate tasks (2)
- Medium backup retention (14 days)
- **Estimated**: $150-250/month

### Prod Environment

- Production instances (r6g.large)
- Multiple tasks (3+)
- Long backup retention (30 days)
- Deletion protection enabled
- **Estimated**: $500-800/month

### Cost Reduction Tips

1. **Dev environment**: Stop RDS instance overnight

   ```bash
   aws rds stop-db-instance --db-instance-identifier unifocus-dev-db
   ```

2. **Use Savings Plans** for predictable ECS/RDS usage

3. **Enable S3 Intelligent Tiering** for web assets

4. **Use ECR lifecycle policies** (already configured) to remove old images

## Troubleshooting

### Terraform State Locked

```bash
# View lock
aws dynamodb get-item \
  --table-name unifocus-terraform-locks-dev \
  --key '{"LockID":{"S":"unifocus-terraform-state-dev/dev/terraform.tfstate-md5"}}'

# Force unlock (use with caution)
terraform force-unlock <lock-id>
```

### Certificate Validation Timeout

ACM certificates require DNS validation:

```bash
# Check validation records
aws route53 list-resource-record-sets \
  --hosted-zone-id <zone-id> \
  --query "ResourceRecordSets[?Type=='CNAME']"
```

### ECS Tasks Not Starting

```bash
# View service events
aws ecs describe-services \
  --cluster unifocus-prod-cluster \
  --services unifocus-prod-api-service \
  --query 'services[0].events[0:5]'

# View task logs
aws logs tail /ecs/unifocus-prod-api --follow
```

## Maintenance

### Update Terraform

```bash
# Update providers
terraform init -upgrade

# Review changes
terraform plan

# Apply updates
terraform apply
```

### Update RDS

```bash
# Check available versions
aws rds describe-db-engine-versions \
  --engine postgres \
  --engine-version 15

# Update in terraform.tfvars or module, then apply
terraform apply
```

### Destroy Environment

⚠️ **Warning**: This will delete all resources!

```bash
cd infra/terraform/environments/dev
terraform destroy
```

Note: Production environment has deletion protection - must disable in RDS module first.

## Next Steps

1. Deploy to dev and verify functionality
2. Configure CI/CD secrets
3. Test deployments with a push to main
4. Deploy to stage with a tag
5. Set up production approvals
6. Deploy to production with approval
7. Configure monitoring dashboards
8. Set up backup restoration procedures

## Additional Resources

- [RELEASE_FLOW.md](../RELEASE_FLOW.md) - Detailed release process
- [GitHub Actions README](.github/workflows/README.md) - CI/CD setup
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
