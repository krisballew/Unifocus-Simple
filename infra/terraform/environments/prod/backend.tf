# Terraform Backend Configuration
# This stores the Terraform state in S3 with DynamoDB locking
#
# Prerequisites:
# 1. Create S3 bucket: aws s3 mb s3://unifocus-terraform-state-dev --region us-east-1
# 2. Enable versioning: aws s3api put-bucket-versioning --bucket unifocus-terraform-state-dev --versioning-configuration Status=Enabled
# 3. Create DynamoDB table: aws dynamodb create-table --table-name unifocus-terraform-locks-dev --attribute-definitions AttributeName=LockID,AttributeType=S --key-schema AttributeName=LockID,KeyType=HASH --billing-mode PAY_PER_REQUEST --region us-east-1
#
# Uncomment after creating the S3 bucket and DynamoDB table

# terraform {
#   backend "s3" {
#     bucket         = "unifocus-terraform-state-prod"
#     key            = "prod/terraform.tfstate"
#     region         = "us-east-1"
#     encrypt        = true
#     dynamodb_table = "unifocus-terraform-locks-prod"
#   }
# }
