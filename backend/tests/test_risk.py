from fastapi.testclient import TestClient
from app.main import app
from app.models.enums import RiskLevel
from app.services.terraform_service import terraform_service
from app.services.security_service import security_scanner
from app.services.risk_service import risk_service
from app.ml.model import risk_model

client = TestClient(app)

SAFE_S3_TF = """
resource "aws_s3_bucket" "audit_bucket" {
  bucket = "chainstate-audit-test"
}
resource "aws_s3_bucket_server_side_encryption_configuration" "audit_enc" {
  bucket = aws_s3_bucket.audit_bucket.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}
resource "aws_s3_bucket_public_access_block" "block_public" {
  bucket                  = aws_s3_bucket.audit_bucket.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
"""

PUBLIC_SSH_TF = """
resource "aws_security_group" "bastion_ingress" {
  name = "bastion-sg"
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
"""

WILDCARD_IAM_TF = """
resource "aws_iam_policy" "wildcard_admin" {
  name = "wildcard-admin"
  policy = jsonencode({
    Statement = [{
      Action = "*"
      Resource = "*"
      Effect = "Allow"
    }]
  })
}
"""

DESTRUCTIVE_TF = """
resource "aws_db_instance" "legacy_db" {
  instance_class = "db.t3.medium"
  force_destroy  = true
}
"""


def test_safe_s3_classifies_as_low_risk():
    """Test Case 1: Safe S3 bucket with KMS and public blocked -> LOW risk."""
    summary = terraform_service.parse_hcl(SAFE_S3_TF)
    findings = security_scanner.scan(summary).findings
    assessment = risk_service.assess_plan(summary, findings)
    assert assessment.risk_level == RiskLevel.LOW
    assert assessment.risk_score < 0.40
    assert "Safe" in assessment.recommended_action


def test_public_ssh_classifies_as_high_risk():
    """Test Case 2: Public SSH (port 22, 0.0.0.0/0) -> HIGH risk."""
    summary = terraform_service.parse_hcl(PUBLIC_SSH_TF)
    findings = security_scanner.scan(summary).findings
    assessment = risk_service.assess_plan(summary, findings)
    assert assessment.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]
    assert assessment.risk_score >= 0.60
    assert any("SSH" in r or "CIDR" in r for r in assessment.reasons)


def test_wildcard_iam_classifies_as_critical_risk():
    """Test Case 3: Wildcard IAM policy -> CRITICAL risk."""
    summary = terraform_service.parse_hcl(WILDCARD_IAM_TF)
    findings = security_scanner.scan(summary).findings
    assessment = risk_service.assess_plan(summary, findings)
    assert assessment.risk_level == RiskLevel.CRITICAL
    assert assessment.risk_score >= 0.70
    assert any("IAM" in r for r in assessment.reasons)


def test_destructive_infrastructure_classifies_as_high_risk():
    """Test Case 4: Destructive infrastructure drop -> HIGH/CRITICAL risk."""
    summary = terraform_service.parse_hcl(DESTRUCTIVE_TF)
    findings = security_scanner.scan(summary).findings
    assessment = risk_service.assess_plan(summary, findings)
    assert assessment.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]
    assert any("Destructive" in r for r in assessment.reasons)


def test_model_info_endpoint():
    """Test GET /api/risk/model/info endpoint metadata."""
    with TestClient(app) as tc:
        res = tc.get("/api/risk/model/info")
        assert res.status_code == 200
        data = res.json()
        assert data["model_type"] == "RandomForestClassifier"
        assert len(data["features"]) == 8
        assert "PROTOTYPE MODEL DISCLAIMER" in data["notice"]
        assert data["validation_accuracy"] > 0.90


def test_api_risk_analyze_endpoint():
    """Test POST /api/risk/analyze endpoint."""
    with TestClient(app) as tc:
        res = tc.post(
            "/api/risk/analyze",
            json={"raw_content": PUBLIC_SSH_TF}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["risk_level"] in ["HIGH", "CRITICAL"]
        assert data["risk_score"] > 0.50
        assert len(data["reasons"]) > 0
        assert "features" in data
