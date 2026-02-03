variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, stage, prod)"
  type        = string
}

variable "alarm_email" {
  description = "Email address for alarm notifications"
  type        = string
  default     = ""
}

# ECS Alarms
variable "ecs_cluster_name" {
  description = "ECS cluster name"
  type        = string
}

variable "ecs_service_name" {
  description = "ECS service name"
  type        = string
}

variable "ecs_cpu_threshold" {
  description = "CPU utilization threshold percentage for ECS alarms"
  type        = number
  default     = 80
}

variable "ecs_memory_threshold" {
  description = "Memory utilization threshold percentage for ECS alarms"
  type        = number
  default     = 80
}

# ALB Alarms
variable "alb_arn_suffix" {
  description = "ALB ARN suffix for CloudWatch metrics"
  type        = string
}

variable "target_group_arn_suffix" {
  description = "Target group ARN suffix for CloudWatch metrics"
  type        = string
}

variable "alb_5xx_threshold" {
  description = "Threshold for 5xx errors count"
  type        = number
  default     = 10
}

# RDS Alarms
variable "rds_instance_id" {
  description = "RDS instance identifier"
  type        = string
  default     = ""
}

variable "rds_cpu_threshold" {
  description = "CPU utilization threshold percentage for RDS alarms"
  type        = number
  default     = 80
}

variable "rds_storage_threshold_bytes" {
  description = "Free storage space threshold in bytes (default 5GB)"
  type        = number
  default     = 5368709120
}

variable "rds_connections_threshold" {
  description = "Database connections threshold"
  type        = number
  default     = 80
}
