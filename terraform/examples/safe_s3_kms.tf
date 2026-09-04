# Safe S3 Bucket with Server-Side KMS Encryption & Public Access Block (LOW Risk)
resource "aws_s3_bucket" "secure_assets" {
  bucket = "chainstate-enterprise-assets-2026"

  tags = {
    Environment = "production"
    Department  = "SecOps"
    Compliance  = "SOC2-HIPAA"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets_kms" {
  bucket = aws_s3_bucket.secure_assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = "arn:aws:kms:us-east-1:123456789012:key/chainstate-storage-key"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "assets_pab" {
  bucket                  = aws_s3_bucket.secure_assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
