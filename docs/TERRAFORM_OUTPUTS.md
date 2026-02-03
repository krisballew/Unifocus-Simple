# Infrastructure Deployment Outputs Template

This document provides a template for capturing and documenting the outputs from Terraform deployment.

## Quick Start

```bash
# From dev environment
cd infra/terraform/environments/dev

# Get all outputs
terraform output

# Save outputs to file
terraform output -json > terraform-outputs.json
```

## Environment: Development

**Deployment Date:** ******\_\_\_******  
**Deployed By:** ******\_\_\_******  
**AWS Account ID:** ******\_\_\_******  
**AWS Region:** us-east-1  
**Terraform Workspace:** dev

## Core Infrastructure Outputs

### VPC & Networking

| Resource        | Value                    | Purpose                        |
| --------------- | ------------------------ | ------------------------------ |
| VPC ID          | `vpc-xxxxxxxxxxxxx`      | Main network                   |
| Public Subnets  | `subnet-xxx, subnet-xxx` | ALB placement                  |
| Private Subnets | `subnet-xxx, subnet-xxx` | ECS & RDS placement            |
| NAT Gateway     | `nat-xxxxxxxxxxxxx`      | Private subnet internet access |

### API Endpoint

| Resource             | Value                                                    | Purpose                  |
| -------------------- | -------------------------------------------------------- | ------------------------ |
| ALB DNS Name         | `unifocus-alb-xxxxx.us-east-1.elb.amazonaws.com`         | API access (temporary)   |
| API Endpoint (HTTPS) | `https://unifocus-alb-xxxxx.us-east-1.elb.amazonaws.com` | Production API URL       |
| Target Group ARN     | `arn:aws:elasticloadbalancing:...`                       | ALB target configuration |

**Usage:**

```bash
# Test API connectivity
curl -i https://unifocus-alb-xxxxx.us-east-1.elb.amazonaws.com/health

# Get from Terraform
terraform output -raw api_endpoint
```

### Container Registry (ECR)

| Resource           | Value                                                      | Purpose                  |
| ------------------ | ---------------------------------------------------------- | ------------------------ |
| ECR Repository URL | `ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/unifocus-api`  | Docker image push target |
| Repository ARN     | `arn:aws:ecr:us-east-1:ACCOUNT_ID:repository/unifocus-api` | IAM permissions          |

**Usage:**

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build and push image
docker build -t ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/unifocus-api:latest .
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/unifocus-api:latest

# Get from Terraform
terraform output -raw ecr_repository_url
```

### Web Hosting (S3 + CloudFront)

| Resource                   | Value                                 | Purpose                    |
| -------------------------- | ------------------------------------- | -------------------------- |
| S3 Bucket Name             | `unifocus-web-dev-xxxxx`              | Static web app storage     |
| S3 Bucket ARN              | `arn:aws:s3:::unifocus-web-dev-xxxxx` | IAM permissions            |
| CloudFront Domain          | `d123456789.cloudfront.net`           | Web app access (temporary) |
| CloudFront Distribution ID | `E123456789ABCDEF`                    | Cache invalidation         |
| Origin Access Identity     | `arn:aws:iam::cloudfront:...`         | Secure S3 access from CDN  |

**Usage:**

```bash
# Upload built web app
aws s3 sync apps/web/dist/ \
  s3://$(terraform output -raw web_bucket_name)/ \
  --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $(terraform output -raw cloudfront_distribution_id) \
  --paths "/*"

# Get from Terraform
terraform output -raw cloudfront_url
terraform output -raw web_bucket_name
```

### Database (RDS PostgreSQL)

| Resource           | Value                                                 | Purpose                |
| ------------------ | ----------------------------------------------------- | ---------------------- |
| DB Instance ID     | `unifocus-dev`                                        | Database identifier    |
| DB Endpoint        | `unifocus-dev.xxxxx.us-east-1.rds.amazonaws.com:5432` | Connection string host |
| DB Port            | `5432`                                                | PostgreSQL port        |
| DB Name            | `unifocus`                                            | Initial database name  |
| DB Username        | `unifocus_admin`                                      | Master username        |
| DB Parameter Group | `unifocus-dev-params`                                 | Database configuration |
| DB Subnet Group    | `unifocus-dev-subnet-group`                           | Multi-AZ subnets       |
| Backup Retention   | `7 days`                                              | Automated backups      |
| RDS Security Group | `sg-xxxxxxxxxxxxx`                                    | Network access control |

**Connection String:**

```
postgresql://unifocus_admin:PASSWORD@unifocus-dev.xxxxx.us-east-1.rds.amazonaws.com:5432/unifocus

# Password is in Secrets Manager secret
```

**Usage:**

```bash
# Get endpoint
terraform output -raw rds_endpoint

# Test connection (from EC2 or bastion in VPC)
psql -h unifocus-dev.xxxxx.us-east-1.rds.amazonaws.com \
  -U unifocus_admin \
  -d unifocus

# Backup database
aws rds create-db-snapshot \
  --db-instance-identifier unifocus-dev \
  --db-snapshot-identifier unifocus-dev-backup-$(date +%s)
```

### ECS Container Orchestration

| Resource           | Value                                       | Purpose                 |
| ------------------ | ------------------------------------------- | ----------------------- |
| ECS Cluster Name   | `unifocus-dev`                              | Container cluster       |
| ECS Service Name   | `unifocus-api-dev`                          | API service             |
| Task Definition    | `unifocus-api-dev:1`                        | Container + config      |
| Desired Count      | `1`                                         | Running tasks           |
| Launch Type        | `FARGATE`                                   | Serverless containers   |
| CPU                | `256`                                       | Per-task allocation     |
| Memory             | `512 MB`                                    | Per-task allocation     |
| Execution Role     | `arn:aws:iam::...role/ecsTaskExecutionRole` | ECR + secrets access    |
| Task Role          | `arn:aws:iam::...role/ecsTaskRole`          | Application permissions |
| Auto-scaling Group | `unifocus-dev-asg`                          | Min: 1, Max: 4          |

**Usage:**

```bash
# View running tasks
aws ecs list-tasks --cluster unifocus-dev

# View task details
aws ecs describe-tasks \
  --cluster unifocus-dev \
  --tasks arn:aws:ecs:...

# View logs
aws logs tail /ecs/unifocus-api-dev --follow

# Update service (new deployment)
aws ecs update-service \
  --cluster unifocus-dev \
  --service unifocus-api-dev \
  --force-new-deployment

# Scale service
aws ecs update-service \
  --cluster unifocus-dev \
  --service unifocus-api-dev \
  --desired-count 3

# Get from Terraform
terraform output -raw ecs_cluster_name
terraform output -raw ecs_service_name
```

### Secrets Manager

| Resource                     | Value                                                                           | Purpose            |
| ---------------------------- | ------------------------------------------------------------------------------- | ------------------ |
| DB Credentials Secret        | `arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:unifocus-db-dev-xxxxx`      | Database access    |
| Cognito Configuration Secret | `arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:unifocus-cognito-dev-xxxxx` | Auth configuration |

**Usage:**

```bash
# Get database credentials
aws secretsmanager get-secret-value \
  --secret-id unifocus-db-dev \
  --query SecretString --output text | jq .

# Get Cognito configuration
aws secretsmanager get-secret-value \
  --secret-id unifocus-cognito-dev \
  --query SecretString --output text | jq .

# Update secret (e.g., after DB password rotation)
aws secretsmanager update-secret \
  --secret-id unifocus-db-dev \
  --secret-string '{"username":"admin","password":"newpwd",...}'

# Get from Terraform
terraform output -raw db_secret_arn
terraform output -raw cognito_secret_arn
```

**Secret Format:**

Database Credentials:

```json
{
  "host": "unifocus-dev.xxxxx.us-east-1.rds.amazonaws.com",
  "port": 5432,
  "username": "unifocus_admin",
  "password": "auto-generated-password",
  "dbname": "unifocus"
}
```

Cognito Configuration:

```json
{
  "region": "us-east-1",
  "userPoolId": "us-east-1_Zzz9z99zZ",
  "clientId": "7e89f0d8a1b2c3d4e5f6g7h8i9j0k1l2",
  "issuer": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Zzz9z99zZ",
  "jwksUri": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Zzz9z99zZ/.well-known/jwks.json"
}
```

### CloudWatch Monitoring

| Resource      | Value                   | Purpose            |
| ------------- | ----------------------- | ------------------ |
| API Log Group | `/ecs/unifocus-api-dev` | ECS task logs      |
| ECS Log Group | `/ecs/unifocus-api-dev` | Container output   |
| ALB Log Group | `/aws/alb/unifocus-dev` | Load balancer logs |
| RDS Log Group | `/aws/rds/unifocus-dev` | Database logs      |

**Usage:**

```bash
# View logs
aws logs tail /ecs/unifocus-api-dev --follow

# Search logs for errors
aws logs filter-log-events \
  --log-group-name /ecs/unifocus-api-dev \
  --filter-pattern "ERROR"

# Get logs for specific time range
aws logs get-log-events \
  --log-group-name /ecs/unifocus-api-dev \
  --log-stream-name <stream-name> \
  --start-time $(date -d '1 hour ago' +%s)000
```

### GitHub Actions OIDC

| Resource            | Value                                                                       | Purpose                   |
| ------------------- | --------------------------------------------------------------------------- | ------------------------- |
| OIDC Provider ARN   | `arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com` | GitHub trust relationship |
| GitHub Actions Role | `arn:aws:iam::ACCOUNT_ID:role/unifocus-github-actions-dev`                  | Assume role from Actions  |
| Role Trust Policy   | See docs                                                                    | Limits to repo/org        |

**Usage:**

```bash
# In GitHub Actions workflow
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::ACCOUNT_ID:role/unifocus-github-actions-dev
    aws-region: us-east-1

# Get from Terraform
terraform output -raw github_oidc_role_arn
```

## Security Groups

| Resource | ID                 | Purpose                            |
| -------- | ------------------ | ---------------------------------- |
| ALB SG   | `sg-xxxxxxxxxxxxx` | HTTP/HTTPS (443, 80) from anywhere |
| ECS SG   | `sg-xxxxxxxxxxxxx` | Port 3001 from ALB SG              |
| RDS SG   | `sg-xxxxxxxxxxxxx` | Port 5432 from ECS SG              |

## Cost Estimate

**Rough monthly costs (dev environment):**

- ECS Fargate: $10-15
- RDS db.t3.micro: $20-30
- ALB: $15-20
- NAT Gateway: $30-50
- CloudFront + S3: $1-5
- **Total: ~$75-120/month**

Reduce costs by:

- Using RDS free tier (if eligible)
- Stopping tasks during off-hours
- Using S3 for logs with short retention

## Manual AWS Console Steps Required

### 1. ✅ Verify VPC and Subnets

- [ ] Go to **VPC Dashboard**
- [ ] Confirm VPC created with CIDR 10.0.0.0/16
- [ ] Confirm 2 public subnets (10.0.1.0/24, 10.0.2.0/24)
- [ ] Confirm 2 private subnets (10.0.10.0/24, 10.0.11.0/24)

### 2. ✅ Configure RDS

- [ ] Go to **RDS > Databases > unifocus-dev**
- [ ] Note endpoint and port
- [ ] Confirm "Available" status (may take 5-10 min)
- [ ] Test connection from EC2/bastion in VPC (optional)

### 3. ✅ Store Database Password

- [ ] Go to **Secrets Manager**
- [ ] Find secret: `unifocus-db-dev`
- [ ] Note the password (used in connection string)
- [ ] Store securely (1Password, password manager, etc.)

### 4. ✅ Upload Web App

- [ ] Build web app: `cd apps/web && pnpm build`
- [ ] Upload to S3:
  ```bash
  aws s3 sync dist/ s3://unifocus-web-dev-xxxxx/ --delete
  ```
- [ ] Invalidate CloudFront cache (see CloudFront section)

### 5. ✅ Build and Push API Docker Image

- [ ] Build image: `docker build -t unifocus-api:latest .`
- [ ] Tag for ECR: `docker tag unifocus-api:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/unifocus-api:latest`
- [ ] Login to ECR and push:
  ```bash
  aws ecr get-login-password --region us-east-1 | \
    docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
  docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/unifocus-api:latest
  ```

### 6. ✅ Configure GitHub Secrets

- [ ] Go to **GitHub > Settings > Secrets and variables > Actions**
- [ ] Add secrets:
  - `AWS_ROLE_TO_ASSUME`: (GitHub OIDC role ARN)
  - `AWS_REGION`: us-east-1
  - `AWS_ACCOUNT_ID`: (Your AWS account ID)
  - `ECR_REPOSITORY`: unifocus-api
  - `ECS_CLUSTER`: unifocus-dev
  - `ECS_SERVICE`: unifocus-api-dev

### 7. ✅ Configure Custom Domain (Optional)

- [ ] Purchase domain or use existing
- [ ] Create Route53 hosted zone (or use existing)
- [ ] Create ALIAS record for web app:
  - Name: `app.example.com`
  - Type: A
  - Alias: CloudFront distribution
- [ ] Create ALIAS record for API:
  - Name: `api.example.com`
  - Type: A
  - Alias: ALB

### 8. ✅ Configure SSL/TLS Certificate (Optional)

- [ ] Go to **ACM (us-east-1 region)**
- [ ] Request certificate
- [ ] Add domains: `example.com`, `*.example.com`
- [ ] Validate via DNS (Route53 button)
- [ ] Update CloudFront behavior to use certificate

### 9. ✅ Test Infrastructure

- [ ] Test API: `curl https://[API_URL]/health`
- [ ] Test web app: Visit `https://[CLOUDFRONT_URL]`
- [ ] Check logs in CloudWatch
- [ ] Verify database connectivity

## Deployment Checklist

- [ ] S3 state bucket created and configured
- [ ] DynamoDB locks table created
- [ ] Terraform backend enabled (uncommented in backend.tf)
- [ ] `terraform init` completed
- [ ] Dev workspace created and selected
- [ ] `terraform plan` reviewed
- [ ] `terraform apply` completed successfully
- [ ] All outputs captured and documented
- [ ] VPC and networking verified
- [ ] RDS database created and verified
- [ ] ECS cluster and service created
- [ ] ECR repository created
- [ ] CloudFront distribution created
- [ ] GitHub OIDC provider verified
- [ ] Secrets Manager secrets verified
- [ ] CloudWatch log groups created
- [ ] GitHub repository secrets configured
- [ ] Docker image built and pushed to ECR
- [ ] Web app built and uploaded to S3
- [ ] API endpoint tested
- [ ] Web app endpoint tested
- [ ] CloudWatch alarms verified
- [ ] Custom domain configured (optional)
- [ ] SSL certificate configured (optional)
- [ ] GitHub Actions workflow tested

## Related Documentation

- [Terraform Deployment Guide](./TERRAFORM_DEPLOYMENT.md)
- [Deployment Development Guide](./DEPLOYMENT_DEV.md)
- [Infrastructure Architecture](../terraform/MULTI_ENV_SETUP.md)
- [Security Baseline](./SECURITY_BASELINE.md)
