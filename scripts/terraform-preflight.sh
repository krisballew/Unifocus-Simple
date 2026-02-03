#!/bin/bash
# Terraform Deployment Checklist
# Verifies all prerequisites and infrastructure before deployment

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

check() {
    echo -e "${BLUE}→${NC} $1"
}

pass() {
    echo -e "${GREEN}✓${NC} $1"
}

fail() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo "╔══════════════════════════════════════════════════════╗"
echo "║  Terraform Deployment Pre-flight Checklist           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# 1. Check tools
echo "1. Checking required tools..."
check "Terraform"
if ! command -v terraform &> /dev/null; then
    fail "Terraform not found. Install from https://www.terraform.io/downloads"
fi
pass "Terraform $(terraform version -json | jq -r .terraform_version) installed"

check "AWS CLI"
if ! command -v aws &> /dev/null; then
    fail "AWS CLI not found. Install from https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
fi
pass "AWS CLI installed"

check "Git"
if ! command -v git &> /dev/null; then
    fail "Git not found. Install from https://git-scm.com/downloads"
fi
pass "Git installed"

check "jq (optional)"
if ! command -v jq &> /dev/null; then
    warn "jq not installed (optional, for JSON parsing)"
else
    pass "jq installed"
fi

echo ""
echo "2. Checking AWS credentials..."
check "AWS credentials"
if ! AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null); then
    fail "AWS credentials not configured. Run 'aws configure'"
fi
pass "AWS Account: $AWS_ACCOUNT_ID"

check "AWS permissions"
if ! aws iam get-user 2>/dev/null > /dev/null; then
    warn "May not have IAM permissions to create all resources"
fi
pass "AWS account accessible"

echo ""
echo "3. Checking repository structure..."
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
check "Project root: $PROJECT_ROOT"

TERRAFORM_DIR="$PROJECT_ROOT/infra/terraform"
if [ ! -d "$TERRAFORM_DIR" ]; then
    fail "Terraform directory not found at $TERRAFORM_DIR"
fi
pass "Terraform directory found"

for env in dev stage prod; do
    ENV_DIR="$TERRAFORM_DIR/environments/$env"
    if [ ! -d "$ENV_DIR" ]; then
        fail "Environment directory not found: $ENV_DIR"
    fi
    pass "Environment '$env' directory found"
done

echo ""
echo "4. Checking Terraform configuration..."
check "Terraform files in dev environment"

DEV_DIR="$TERRAFORM_DIR/environments/dev"
for file in backend.tf main.tf variables.tf outputs.tf; do
    if [ ! -f "$DEV_DIR/$file" ]; then
        fail "Missing $file in $DEV_DIR"
    fi
    pass "Found $file"
done

echo ""
echo "5. Checking module structure..."
MODULES_DIR="$TERRAFORM_DIR/modules"
expected_modules=(
    "vpc"
    "security-groups"
    "rds"
    "ecs"
    "ecr"
    "web-hosting"
    "secrets-manager"
    "cloudwatch"
    "github-oidc"
    "route53-acm"
    "alarms"
)

for module in "${expected_modules[@]}"; do
    if [ ! -d "$MODULES_DIR/$module" ]; then
        fail "Missing module: $module"
    fi
    pass "Module '$module' found"
done

echo ""
echo "6. Checking environment variables..."
check "Required AWS resources"

# Check S3 bucket
BUCKET_NAME="unifocus-terraform-state-dev"
if aws s3 ls "s3://${BUCKET_NAME}" 2>&1 | grep -q 'NoSuchBucket'; then
    warn "S3 bucket '$BUCKET_NAME' does not exist (will be created)"
else
    pass "S3 bucket '$BUCKET_NAME' exists"
fi

# Check DynamoDB table
DYNAMODB_TABLE="unifocus-terraform-locks-dev"
if ! aws dynamodb describe-table --table-name "$DYNAMODB_TABLE" 2>/dev/null > /dev/null; then
    warn "DynamoDB table '$DYNAMODB_TABLE' does not exist (will be created)"
else
    pass "DynamoDB table '$DYNAMODB_TABLE' exists"
fi

echo ""
echo "7. Checking GitHub repository..."
check "Git repository"

if [ -d "$PROJECT_ROOT/.git" ]; then
    pass "Git repository found"

    GITHUB_REPO=$(cd "$PROJECT_ROOT" && git config --get remote.origin.url | sed 's/.*\///' | sed 's/\.git$//')
    GITHUB_ORG=$(cd "$PROJECT_ROOT" && git config --get remote.origin.url | sed 's/.*://' | sed 's/\/.*//')

    if [ -n "$GITHUB_REPO" ] && [ -n "$GITHUB_ORG" ]; then
        pass "GitHub org: $GITHUB_ORG"
        pass "GitHub repo: $GITHUB_REPO"
    fi
else
    warn "Not a git repository"
fi

echo ""
echo "8. Pre-deployment recommendations..."
echo ""
echo "Before running 'terraform apply':"
echo "  1. Review terraform/environments/dev/main.tf"
echo "  2. Check terraform/environments/dev/variables.tf for custom values"
echo "  3. Ensure AWS region is set correctly (default: us-east-1)"
echo "  4. Verify RDS instance class (default: db.t3.micro)"
echo "  5. Set appropriate values for GitHub org and repo"
echo ""

echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✓ All pre-flight checks passed!                    ║"
echo "║  Ready to proceed with deployment                  ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo ""
echo "  1. Review variables:               "
echo "     cd $DEV_DIR && cat variables.tf"
echo ""
echo "  2. Initialize Terraform:           "
echo "     cd $DEV_DIR && terraform init"
echo ""
echo "  3. Create/select workspace:        "
echo "     terraform workspace new dev || terraform workspace select dev"
echo ""
echo "  4. Plan deployment:                "
echo "     terraform plan -out=tfplan"
echo ""
echo "  5. Apply configuration:            "
echo "     terraform apply tfplan"
echo ""
echo "Or use the deployment script:        "
echo "  ./scripts/terraform-deploy.sh dev"
echo ""
