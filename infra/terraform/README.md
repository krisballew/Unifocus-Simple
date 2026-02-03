# Unifocus Terraform Infrastructure

This directory contains Terraform infrastructure as code for deploying Unifocus to AWS.

## Architecture Overview

The infrastructure includes:

- **VPC & Networking**: VPC with public/private subnets across 2 AZs, NAT Gateway, Internet Gateway
- **Security Groups**: Isolated security groups for ALB, ECS, and RDS
- **RDS PostgreSQL**: Managed PostgreSQL database in private subnets
- **ECS Fargate**: Containerized API running on Fargate with Application Load Balancer
- **ECR**: Container registry for API Docker images
- **S3 + CloudFront**: Static web hosting with CDN
- **Secrets Manager**: Secure storage for database credentials and Cognito configuration
- **CloudWatch**: Log groups for monitoring ECS, RDS, and ALB

## Directory Structure

```
terraform/
├── environments/
│   └── dev/              # Dev environment configuration
│       ├── backend.tf    # Terraform state backend (S3 + DynamoDB)
│       ├── main.tf       # Main configuration
│       ├── variables.tf  # Input variables
│       └── outputs.tf    # Output values
└── modules/
    ├── vpc/              # VPC, subnets, NAT, routing
    ├── security-groups/  # Security groups for ALB, ECS, RDS
    ├── rds/              # PostgreSQL database
    ├── ecs/              # ECS Fargate + ALB
    ├── ecr/              # Container registry
    ├── web-hosting/      # S3 + CloudFront
    ├── secrets-manager/  # Secrets storage
    └── cloudwatch/       # Log groups
```

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** >= 1.5.0 installed
3. **AWS Account** with permissions to create the resources

## Initial Setup

### 1. Create Terraform State Backend

Before deploying, create the S3 bucket and DynamoDB table for Terraform state:

```bash
# Create S3 bucket for state
aws s3 mb s3://unifocus-terraform-state-dev --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket unifocus-terraform-state-dev \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name unifocus-terraform-locks-dev \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### 2. Uncomment Backend Configuration

After creating the backend resources, uncomment the backend configuration in `environments/dev/backend.tf`.

## Deployment

### Initialize Terraform

```bash
cd environments/dev
terraform init
```

### Plan Changes

```bash
terraform plan
```

### Apply Infrastructure

```bash
terraform apply
```

### View Outputs

```bash
terraform output
```

## Key Outputs

After deployment, Terraform will output:

- `api_url` - API Application Load Balancer URL
- `api_endpoint` - API endpoint with HTTPS
- `cloudfront_url` - CloudFront distribution URL for web hosting
- `ecr_repository_url` - ECR repository URL for pushing Docker images
- `web_bucket_name` - S3 bucket name for web assets
- `rds_endpoint` - Database endpoint

## Deploying the Application

### 1. Build and Push API Container

```bash
# Get ECR login
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <ECR_REPOSITORY_URL>

# Build and push
cd ../../../services/api
docker build -t unifocus-api .
docker tag unifocus-api:latest <ECR_REPOSITORY_URL>:latest
docker push <ECR_REPOSITORY_URL>:latest
```

### 2. Deploy Web Assets

```bash
# Build web application
cd ../../../apps/web
npm run build

# Sync to S3
aws s3 sync dist/ s3://<WEB_BUCKET_NAME>/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id <CLOUDFRONT_DISTRIBUTION_ID> \
  --paths "/*"
```

## Configuration

### Update Cognito Configuration

After creating Cognito User Pool and Client:

```bash
# Update Cognito secret in Secrets Manager
aws secretsmanager update-secret \
  --secret-id <COGNITO_SECRET_ARN> \
  --secret-string '{
    "userPoolId": "us-east-1_xxxxx",
    "clientId": "xxxxx",
    "region": "us-east-1",
    "issuer": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_xxxxx"
  }'
```

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Warning**: This will delete all resources including the database. Make sure to backup any important data first.

## Cost Optimization for Dev

The dev environment is configured with cost-optimized settings:

- RDS: `db.t3.micro` instance
- ECS: 256 CPU, 512MB memory, 1 task
- NAT Gateway: Single NAT in one AZ
- CloudWatch: 7-day log retention

## Security Notes

1. Database is in private subnets with no public access
2. Secrets are stored in AWS Secrets Manager
3. S3 bucket has public access blocked (CloudFront OAI only)
4. Security groups follow principle of least privilege
5. All resources are encrypted at rest

## Monitoring

- CloudWatch Logs: `/ecs/unifocus-dev`, `/aws/rds/unifocus-dev`, `/aws/alb/unifocus-dev`
- ECS Container Insights enabled
- RDS Enhanced Monitoring enabled

## Troubleshooting

### ECS Tasks Not Starting

Check CloudWatch logs:

```bash
aws logs tail /ecs/unifocus-dev --follow
```

### Database Connection Issues

Verify security group rules and network connectivity from ECS to RDS.

### Web Assets Not Loading

Check S3 bucket policy and CloudFront distribution settings.

## Additional Resources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)

Add your infrastructure configuration files here.
