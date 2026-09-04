import json
from fastapi.testclient import TestClient
from app.main import app
from app.services.terraform_service import terraform_service
from app.services.security_service import security_scanner
from app.models.enums import SeverityLevel

client = TestClient(app)

SAMPLE_INSECURE_SG = """
resource "aws_security_group" "bastion_ingress" {
  name        = "bastion-sg"
  description = "Allows SSH"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
"""

SAMPLE_SAFE_S3 = """
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
"""


def test_terraform_hcl_parser_insecure_sg():
    """Verify HCL parser detects open SSH port 22 and 0.0.0.0/0 CIDR."""
    summary = terraform_service.parse_hcl(SAMPLE_INSECURE_SG)
    assert summary.total_resources == 1
    res = summary.resources[0]
    assert res.resource_type == "aws_security_group"
    assert res.public_access is True
    assert 22 in res.exposed_ports
    assert "0.0.0.0/0" in res.cidr_ranges


def test_terraform_hcl_parser_safe_s3():
    """Verify HCL parser detects encryption for safe S3 bucket."""
    summary = terraform_service.parse_hcl(SAMPLE_SAFE_S3)
    assert summary.total_resources == 2
    # At least one resource should have encryption enabled
    assert any(r.encryption_enabled for r in summary.resources)


def test_security_scanner_rules():
    """Verify built-in security rules flag CKV_AWS_24 on open port 22."""
    summary = terraform_service.parse_hcl(SAMPLE_INSECURE_SG)
    result = security_scanner.scan(summary)
    assert result.failed_count >= 1
    check_ids = [f.check_id for f in result.findings]
    assert "CKV_AWS_24" in check_ids
    ssh_finding = next(f for f in result.findings if f.check_id == "CKV_AWS_24")
    assert ssh_finding.severity == SeverityLevel.HIGH


def test_api_terraform_analyze_endpoint():
    """Test POST /api/terraform/analyze endpoint."""
    with TestClient(app) as tc:
        response = tc.post(
            "/api/terraform/analyze",
            json={"raw_content": SAMPLE_INSECURE_SG}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_resources"] == 1
        assert data["resources"][0]["public_access"] is True


def test_api_security_scan_endpoint():
    """Test POST /api/security/scan endpoint."""
    with TestClient(app) as tc:
        response = tc.post(
            "/api/security/scan",
            json={"raw_content": SAMPLE_INSECURE_SG}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["failed_count"] >= 1
        assert "CKV_AWS_24" in [f["check_id"] for f in data["findings"]]


def test_submit_terraform_change_authenticated():
    """Test POST /api/terraform/changes requires auth and creates change record."""
    with TestClient(app) as tc:
        # 1. Login to get token
        login_res = tc.post(
            "/api/auth/login",
            json={"email": "dev@chainstate.io", "password": "ChainState2026!"}
        )
        token = login_res.json()["access_token"]

        # 2. Submit change with token
        res = tc.post(
            "/api/terraform/changes",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "repository": "chainstate/governance-demo",
                "branch": "feat/ssh-access",
                "commit_hash": "b8f2190",
                "message": "Add administrative ingress rule",
                "raw_content": SAMPLE_INSECURE_SG,
                "files_changed": ["security.tf"]
            }
        )
        assert res.status_code == 201
        data = res.json()
        assert "change_id" in data
        assert data["status"] == "APPROVAL_REQUIRED"
        assert data["risk_level"] == "HIGH"
