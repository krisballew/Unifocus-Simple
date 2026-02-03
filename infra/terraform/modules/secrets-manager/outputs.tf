output "db_secret_arn" {
  description = "ARN of database credentials secret"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "cognito_secret_arn" {
  description = "ARN of Cognito configuration secret"
  value       = aws_secretsmanager_secret.cognito_config.arn
}
