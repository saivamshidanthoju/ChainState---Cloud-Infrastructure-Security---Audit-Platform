output "vpc_id" {
  description = "The ID of the provisioned VPC"
  value       = aws_vpc.main.id
}

output "vpc_arn" {
  description = "The ARN of the provisioned VPC"
  value       = aws_vpc.main.arn
}
