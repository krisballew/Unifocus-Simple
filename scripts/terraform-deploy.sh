#!/bin/bash
# Terraform Dev Deployment Script
# This script sets up and deploys the Unifocus infrastructure to AWS using Terraform
#
# Prerequisites:
# - AWS CLI installed and configured with credentials
# - Terraform >= 1.5.0 installed
# - AWS account with appropriate permissions
#
# Usage: ./scripts/terraform-deploy.sh dev

set -e

ENVIRONMENT="${1:-dev}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TERRAFORM_DIR="$PROJECT_ROOT/infra/terraform"
ENV_DIR="$TERRAFORM_DIR/environments/$ENVIRONMENT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}→${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Verify prerequisites
log "Checking prerequisites..."

if ! command -v terraform &> /dev/null; then
    log_error "Terraform is not installed. Please install Terraform >= 1.5.0"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    log_error "AWS CLI is not installed. Please install AWS CLI"
    exit 1
fi

log_success "Terraform $(terraform version -json | jq -r .terraform_version) found"
log_success "AWS CLI version $(aws --version | cut -d' ' -f1) found"

# Verify AWS credentials
log "Verifying AWS credentials..."
if ! AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null); then
    log_error "AWS credentials not configured or invalid"
    exit 1
fi
log_success "AWS Account: $AWS_ACCOUNT_ID"

# Verify environment directory
if [ ! -d "$ENV_DIR" ]; then
    log_error "Environment directory not found: $ENV_DIR"
    exit 1
fi

log_success "Environment directory: $ENV_DIR"

# Setup S3 backend if needed
log "Setting up Terraform state backend..."

BUCKET_NAME="unifocus-terraform-state-${ENVIRONMENT}"
DYNAMODB_TABLE="unifocus-terraform-locks-${ENVIRONMENT}"
AWS_REGION="us-east-1"

# Check if bucket exists
if aws s3 ls "s3://${BUCKET_NAME}" 2>&1 | grep -q 'NoSuchBucket'; then
    log "Creating S3 bucket for Terraform state..."
    aws s3 mb "s3://${BUCKET_NAME}" --region "$AWS_REGION"
    log_success "S3 bucket created: $BUCKET_NAME"
else
    log_success "S3 bucket exists: $BUCKET_NAME"
fi

# Enable versioning
log "Enabling versioning on S3 bucket..."
aws s3api put-bucket-versioning \
    --bucket "$BUCKET_NAME" \
    --versioning-configuration Status=Enabled
log_success "S3 versioning enabled"

# Enable encryption
log "Enabling encryption on S3 bucket..."
aws s3api put-bucket-encryption \
    --bucket "$BUCKET_NAME" \
    --server-side-encryption-configuration '{
        "Rules": [
            {
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }
        ]
    }'
log_success "S3 encryption enabled"

# Block public access
log "Blocking public access on S3 bucket..."
aws s3api put-public-access-block \
    --bucket "$BUCKET_NAME" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
log_success "S3 public access blocked"

# Check if DynamoDB table exists
if aws dynamodb describe-table --table-name "$DYNAMODB_TABLE" --region "$AWS_REGION" 2>&1 | grep -q 'ResourceNotFoundException'; then
    log "Creating DynamoDB table for state locking..."
    aws dynamodb create-table \
        --table-name "$DYNAMODB_TABLE" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --region "$AWS_REGION"
    log_success "DynamoDB table created: $DYNAMODB_TABLE"
else
    log_success "DynamoDB table exists: $DYNAMODB_TABLE"
fi

# Navigate to environment directory
cd "$ENV_DIR"

# Initialize Terraform
log "Initializing Terraform..."
terraform init -upgrade

log_success "Terraform initialized"

# Check if workspace exists
WORKSPACE_EXISTS=$(terraform workspace list | grep -c "^ $ENVIRONMENT$" || echo 0)

if [ "$WORKSPACE_EXISTS" -eq 0 ]; then
    log "Creating Terraform workspace: $ENVIRONMENT"
    terraform workspace new "$ENVIRONMENT"
else
    log "Workspace $ENVIRONMENT already exists"
fi

# Select workspace
log "Selecting workspace: $ENVIRONMENT"
terraform workspace select "$ENVIRONMENT"
log_success "Workspace selected"

# Plan deployment
log "Planning Terraform deployment..."
terraform plan -out=tfplan

# Apply deployment
log_warning "Review the plan above. Continuing with apply in 10 seconds (Ctrl+C to cancel)..."
sleep 10

log "Applying Terraform configuration..."
terraform apply tfplan

# Capture outputs
log "Capturing Terraform outputs..."

cat > "$PROJECT_ROOT/terraform-outputs-${ENVIRONMENT}.json" << 'OUTPUTS'
{
  "outputs": {
    "vpc_id": "$(terraform output -raw vpc_id)",
    "api_url": "$(terraform output -raw api_url)",
    "api_endpoint": "$(terraform output -raw api_endpoint)",
    "cloudfront_url": "$(terraform output -raw cloudfront_url)",
    "cloudfront_distribution_id": "$(terraform output -raw cloudfront_distribution_id)",
    "web_bucket_name": "$(terraform output -raw web_bucket_name)",
    "ecr_repository_url": "$(terraform output -raw ecr_repository_url)",
    "rds_endpoint": "$(terraform output -raw rds_endpoint)",
    "ecs_cluster_name": "$(terraform output -raw ecs_cluster_name)",
    "ecs_service_name": "$(terraform output -raw ecs_service_name)",
    "github_oidc_role_arn": "$(terraform output -raw github_oidc_role_arn)"
  }
}
OUTPUTS

log_success "Terraform outputs saved to terraform-outputs-${ENVIRONMENT}.json"

# Print outputs
log "Deployment Summary"
echo ""
echo "=== Infrastructure Outputs ==="
terraform output

echo ""
log_success "Deployment completed successfully!"

echo ""
echo "=== Next Steps ==="
echo "1. Update the following in your GitHub repository secrets:"
echo "   - AWS_ROLE_TO_ASSUME: $(terraform output -raw github_oidc_role_arn)"
echo "   - AWS_REGION: us-east-1"
echo ""
echo "2. Build and push Docker images to ECR:"
echo "   - API: $(terraform output -raw ecr_repository_url):latest"
echo ""
echo "3. Update web app environment variables in CloudFront:"
echo "   - VITE_API_BASE_URL: $(terraform output -raw api_endpoint)"
echo ""
echo "4. Configure database in Secrets Manager:"
echo "   - Connection string stored in Secrets Manager"
echo ""
echo "5. Deploy with GitHub Actions or ECS CLI"
echo ""
