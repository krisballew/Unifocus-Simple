terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "Terraform"
    }
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# VPC and Networking
module "vpc" {
  source = "../../modules/vpc"

  project_name = var.project_name
  environment  = var.environment
  vpc_cidr     = var.vpc_cidr
  azs          = data.aws_availability_zones.available.names
}

# Security Groups
module "security_groups" {
  source = "../../modules/security-groups"

  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.vpc.vpc_id
}

# RDS Postgres
module "rds" {
  source = "../../modules/rds"

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  db_security_group_id  = module.security_groups.rds_security_group_id
  db_name               = var.db_name
  db_username           = var.db_username
  db_instance_class     = var.db_instance_class
  db_allocated_storage  = var.db_allocated_storage
}

# Secrets Manager
module "secrets" {
  source = "../../modules/secrets-manager"

  project_name = var.project_name
  environment  = var.environment
  db_host      = module.rds.db_endpoint
  db_port      = module.rds.db_port
  db_name      = var.db_name
  db_username  = var.db_username
  db_password  = module.rds.db_password
}

# ECR Repository
module "ecr" {
  source = "../../modules/ecr"

  project_name = var.project_name
  environment  = var.environment
}

# CloudWatch Log Groups
module "cloudwatch" {
  source = "../../modules/cloudwatch"

  project_name = var.project_name
  environment  = var.environment
}

# ECS Fargate with ALB
module "ecs" {
  source = "../../modules/ecs"

  project_name             = var.project_name
  environment              = var.environment
  vpc_id                   = module.vpc.vpc_id
  public_subnet_ids        = module.vpc.public_subnet_ids
  private_subnet_ids       = module.vpc.private_subnet_ids
  alb_security_group_id    = module.security_groups.alb_security_group_id
  ecs_security_group_id    = module.security_groups.ecs_security_group_id
  ecr_repository_url       = module.ecr.repository_url
  log_group_name           = module.cloudwatch.ecs_log_group_name
  db_secret_arn            = module.secrets.db_secret_arn
  cognito_secret_arn       = module.secrets.cognito_secret_arn
  aws_region               = var.aws_region
  cpu                      = var.ecs_task_cpu
  memory                   = var.ecs_task_memory
  desired_count            = var.ecs_desired_count
}

# S3 and CloudFront for Web Hosting
module "web_hosting" {
  source = "../../modules/web-hosting"

  project_name = var.project_name
  environment  = var.environment
  domain_name  = var.web_domain_name
}

# GitHub OIDC for GitHub Actions deployments
module "github_oidc" {
  source = "../../modules/github-oidc"

  project_name                = var.project_name
  environment                 = var.environment
  github_org                  = var.github_org
  github_repo                 = var.github_repo
  aws_region                  = var.aws_region
  aws_account_id              = data.aws_caller_identity.current.account_id
  web_bucket_arn              = module.web_hosting.s3_bucket_arn
  cloudfront_distribution_arn = module.web_hosting.cloudfront_distribution_arn
  ecr_repository_arn          = module.ecr.repository_arn
  ecs_cluster_name            = module.ecs.cluster_name
  ecs_service_arn             = module.ecs.service_arn
  ecs_execution_role_arn      = module.ecs.execution_role_arn
  ecs_task_role_arn           = module.ecs.task_role_arn
}
