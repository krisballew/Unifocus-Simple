output "ecs_log_group_name" {
  description = "ECS log group name"
  value       = aws_cloudwatch_log_group.ecs.name
}

output "ecs_log_group_arn" {
  description = "ECS log group ARN"
  value       = aws_cloudwatch_log_group.ecs.arn
}

output "rds_log_group_name" {
  description = "RDS log group name"
  value       = aws_cloudwatch_log_group.rds.name
}

output "alb_log_group_name" {
  description = "ALB log group name"
  value       = aws_cloudwatch_log_group.alb.name
}
