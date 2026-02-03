output "s3_bucket_name" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.web.id
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.web.arn
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.web.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.web.id
}

output "cloudfront_arn" {
  description = "CloudFront distribution ARN"
  value       = aws_cloudfront_distribution.web.arn
}

output "cloudfront_zone_id" {
  description = "CloudFront hosted zone ID"
  value       = aws_cloudfront_distribution.web.hosted_zone_id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN (alias for cloudfront_arn)"
  value       = aws_cloudfront_distribution.web.arn
}
