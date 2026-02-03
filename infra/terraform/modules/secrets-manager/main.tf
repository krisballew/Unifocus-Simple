# Secrets Manager Module

# Database credentials secret
resource "aws_secretsmanager_secret" "db_credentials" {
  name_prefix             = "${var.project_name}-${var.environment}-db-credentials-"
  description             = "Database credentials for ${var.project_name} ${var.environment}"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-${var.environment}-db-credentials"
  }
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username           = var.db_username
    password           = var.db_password
    host               = var.db_host
    port               = var.db_port
    dbname             = var.db_name
    engine             = "postgres"
    dbConnectionString = "postgresql://${var.db_username}:${var.db_password}@${var.db_host}:${var.db_port}/${var.db_name}?sslmode=require"
  })
}

# Cognito configuration secret
resource "aws_secretsmanager_secret" "cognito_config" {
  name_prefix             = "${var.project_name}-${var.environment}-cognito-config-"
  description             = "Cognito configuration for ${var.project_name} ${var.environment}"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-${var.environment}-cognito-config"
  }
}

resource "aws_secretsmanager_secret_version" "cognito_config" {
  secret_id = aws_secretsmanager_secret.cognito_config.id
  secret_string = jsonencode({
    userPoolId     = "REPLACE_WITH_COGNITO_USER_POOL_ID"
    clientId       = "REPLACE_WITH_COGNITO_CLIENT_ID"
    region         = "us-east-1"
    issuer         = "REPLACE_WITH_COGNITO_ISSUER_URL"
    jwtSecret      = "REPLACE_WITH_JWT_SECRET"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
