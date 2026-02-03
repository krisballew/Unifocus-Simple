variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "stage"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "unifocus"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.1.0.0/16"
}

# Database variables
variable "db_name" {
  description = "Database name"
  type        = string
  default     = "unifocus"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "unifocus_admin"
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.small"
}

variable "db_allocated_storage" {
  description = "Allocated storage for RDS in GB"
  type        = number
  default     = 20
}

# ECS variables
variable "ecs_task_cpu" {
  description = "CPU units for ECS task"
  type        = string
  default     = "512"
}

variable "ecs_task_memory" {
  description = "Memory for ECS task in MB"
  type        = string
  default     = "1024"
}

variable "ecs_desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
}

# Web hosting variables
variable "web_domain_name" {
  description = "Domain name for web hosting (optional)"
  type        = string
  default     = ""
}

# GitHub OIDC variables
variable "github_org" {
  description = "GitHub organization name"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
}

# Domain and DNS variables
variable "root_domain" {
  description = "Root domain name (e.g., example.com)"
  type        = string
  default     = ""
}

variable "api_domain_name" {
  description = "Full domain name for API (e.g., stage-api.example.com)"
  type        = string
  default     = ""
}

# Alarm variables
variable "alarm_email" {
  description = "Email address for CloudWatch alarm notifications"
  type        = string
  default     = ""
}
