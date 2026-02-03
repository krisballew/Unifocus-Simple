output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "api_url" {
  description = "API Application Load Balancer URL"
  value       = module.ecs.alb_dns_name
}

output "api_endpoint" {
  description = "API endpoint with https"
  value       = "https://${module.ecs.alb_dns_name}"
}

output "cloudfront_url" {
  description = "CloudFront distribution URL for web hosting"
  value       = module.web_hosting.cloudfront_domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.web_hosting.cloudfront_distribution_id
}

output "web_bucket_name" {
  description = "S3 bucket name for web hosting"
  value       = module.web_hosting.s3_bucket_name
}

output "ecr_repository_url" {
  description = "ECR repository URL for API container images"
  value       = module.ecr.repository_url
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.db_endpoint
}

output "db_secret_arn" {
  description = "Secrets Manager ARN for database credentials"
  value       = module.secrets.db_secret_arn
  sensitive   = true
}

output "cognito_secret_arn" {
  description = "Secrets Manager ARN for Cognito configuration"
  value       = module.secrets.cognito_secret_arn
  sensitive   = true
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = module.ecs.service_name
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group for ECS"
  value       = module.cloudwatch.ecs_log_group_name
}
