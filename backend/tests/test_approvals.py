import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.models.enums import DeploymentState, RiskLevel, ApprovalDecision
from app.models.terraform_change import TerraformChange
from app.models.audit_record import AuditRecord
from app.database import SessionLocal

client = TestClient(app)


def get_token_for(email: str) -> str:
    with TestClient(app) as tc:
        res = tc.post(
            "/api/auth/login",
            json={"email": email, "password": "ChainState2026!"}
        )
        return res.json()["access_token"]


def test_developer_cannot_approve_changes():
    """Test RBAC: Developers are rejected when attempting to approve changes."""
    dev_token = get_token_for("dev@chainstate.io")
    with TestClient(app) as tc:
        res = tc.post(
            "/api/approvals",
            headers={"Authorization": f"Bearer {dev_token}"},
            json={
                "change_id": "CHG-2026-001",
                "decision": "APPROVED",
                "comments": "Self approving my change"
            }
        )
        assert res.status_code == 403
        assert "Developers are not authorized" in res.json()["detail"]


def test_security_reviewer_approves_high_risk():
    """Test Security Reviewer can approve a HIGH risk change."""
    sec_token = get_token_for("security@chainstate.io")
    cid = f"CHG-HIGH-{uuid.uuid4().hex[:6]}"

    # Insert fresh change for this test run
    with SessionLocal() as db:
        chg = TerraformChange(
            change_id=cid,
            repository="chainstate/cloud-vpc",
            branch="feat/sg-rule",
            commit_hash="c198234",
            author="David Dev",
            message="Bastion security group change",
            files_changed=["main.tf"],
            raw_content='resource "aws_security_group" "sg" {}',
            status=DeploymentState.APPROVAL_REQUIRED,
            risk_level=RiskLevel.HIGH
        )
        db.add(chg)
        db.commit()

    with TestClient(app) as tc:
        res = tc.post(
            "/api/approvals",
            headers={"Authorization": f"Bearer {sec_token}"},
            json={
                "change_id": cid,
                "decision": "APPROVED",
                "comments": "Reviewed bastion security group. Approved with time-limited exception."
            }
        )
        assert res.status_code == 201
        data = res.json()
        assert data["decision"] == "APPROVED"
        assert data["reviewer_role"] == "Security Reviewer"

        # Verify change status updated to APPROVED
        with SessionLocal() as db:
            chg = db.query(TerraformChange).filter(TerraformChange.change_id == cid).first()
            assert chg.status == DeploymentState.APPROVED

            # Verify audit trail record was created
            audit = db.query(AuditRecord).filter(
                AuditRecord.change_id == cid,
                AuditRecord.event_type == "APPROVAL_DECISION"
            ).first()
            assert audit is not None
            assert len(audit.sha256_hash) == 64


def test_critical_change_mandates_approver_and_rationale():
    """Test CRITICAL change cannot be approved by SecOps or without override rationale."""
    sec_token = get_token_for("security@chainstate.io")
    appr_token = get_token_for("approver@chainstate.io")
    cid = f"CHG-CRIT-{uuid.uuid4().hex[:6]}"

    # Setup a fresh CRITICAL change in DB
    with SessionLocal() as db:
        crit_chg = TerraformChange(
            change_id=cid,
            repository="chainstate/core-auth",
            branch="main",
            commit_hash="f901234",
            author="David Dev",
            message="Apply wildcard admin IAM policy",
            files_changed=["iam.tf"],
            raw_content='resource "aws_iam_policy" "p" { policy = "wildcard" }',
            status=DeploymentState.APPROVAL_REQUIRED,
            risk_level=RiskLevel.CRITICAL
        )
        db.add(crit_chg)
        db.commit()

    with TestClient(app) as tc:
        # A: Security Reviewer attempt fails (403)
        res_sec = tc.post(
            "/api/approvals",
            headers={"Authorization": f"Bearer {sec_token}"},
            json={
                "change_id": cid,
                "decision": "APPROVED",
                "comments": "Trying to approve critical"
            }
        )
        assert res_sec.status_code == 403

        # B: Approver fails without override rationale (400)
        res_no_rationale = tc.post(
            "/api/approvals",
            headers={"Authorization": f"Bearer {appr_token}"},
            json={
                "change_id": cid,
                "decision": "APPROVED",
                "comments": "Approving as Approver"
            }
        )
        assert res_no_rationale.status_code == 400
        assert "override rationale" in res_no_rationale.json()["detail"]

        # C: Approver succeeds with explicit override rationale (201)
        res_success = tc.post(
            "/api/approvals",
            headers={"Authorization": f"Bearer {appr_token}"},
            json={
                "change_id": cid,
                "decision": "APPROVED",
                "comments": "Executive authorization granted for disaster recovery exercise.",
                "override_rationale": "VP of Engineering emergency authorization ticket SEC-9912."
            }
        )
        assert res_success.status_code == 201
        assert "EXECUTIVE OVERRIDE" in res_success.json()["comments"]


def test_pending_approvals_endpoint():
    """Test GET /api/approvals/pending returns awaiting changes."""
    sec_token = get_token_for("security@chainstate.io")
    with TestClient(app) as tc:
        res = tc.get("/api/approvals/pending", headers={"Authorization": f"Bearer {sec_token}"})
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
