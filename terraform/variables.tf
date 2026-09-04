variable "aws_region" {
  description = "Target AWS region for governed resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment identifier (e.g. dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for the baseline VPC"
  type        = string
  default     = "10.0.0.0/16"
}
