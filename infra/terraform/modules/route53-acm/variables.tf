variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, stage, prod)"
  type        = string
}

variable "root_domain" {
  description = "Root domain name (e.g., example.com)"
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Full domain name for web hosting (e.g., app.example.com or dev.app.example.com)"
  type        = string
  default     = ""
}

variable "api_domain_name" {
  description = "Full domain name for API (e.g., api.example.com or dev.api.example.com)"
  type        = string
  default     = ""
}

variable "subject_alternative_names" {
  description = "Additional domains for the web certificate"
  type        = list(string)
  default     = []
}

variable "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  type        = string
  default     = ""
}

variable "cloudfront_zone_id" {
  description = "CloudFront distribution hosted zone ID"
  type        = string
  default     = ""
}

variable "alb_dns_name" {
  description = "ALB DNS name"
  type        = string
  default     = ""
}

variable "alb_zone_id" {
  description = "ALB hosted zone ID"
  type        = string
  default     = ""
}
