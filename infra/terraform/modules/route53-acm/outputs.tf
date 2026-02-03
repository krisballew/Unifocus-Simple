output "web_certificate_arn" {
  description = "ARN of the ACM certificate for web (CloudFront)"
  value       = var.domain_name != "" ? aws_acm_certificate.web[0].arn : ""
}

output "alb_certificate_arn" {
  description = "ARN of the ACM certificate for ALB"
  value       = var.api_domain_name != "" ? aws_acm_certificate.alb[0].arn : ""
}

output "web_domain" {
  description = "Full web domain name"
  value       = var.domain_name
}

output "api_domain" {
  description = "Full API domain name"
  value       = var.api_domain_name
}
