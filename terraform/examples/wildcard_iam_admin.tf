# Overly Permissive IAM Policy: Wildcard Action & Resource (CRITICAL Risk)
resource "aws_iam_policy" "wildcard_admin" {
  name        = "overly-permissive-admin-policy"
  description = "Dangerous wildcard admin permissions policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "*"
        Resource = "*"
      }
    ]
  })
}
