import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.terraform_change import TerraformChange
from app.models.deployment import Deployment
from app.models.audit_record import AuditRecord
from app.models.enums import DeploymentState, RiskLevel
from app.utils.security import create_access_token

client = TestClient(app)


def get_auth_headers(email: str = "approver@chainstate.io") -> dict:
    with TestClient(app) as tc:
        res = tc.post(
            "/api/auth/login",
            json={"email": email, "password": "ChainState2026!"}
        )
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}


def create_test_change(status: DeploymentState = DeploymentState.APPROVED, risk: RiskLevel = RiskLevel.LOW) -> TerraformChange:
    db = SessionLocal()
    unique_id = f"CHG-DEP-{uuid.uuid4().hex[:6].upper()}"
    change = TerraformChange(
        change_id=unique_id,
        repository="chainstate/infra-core",
        branch="main",
        commit_hash=uuid.uuid4().hex[:8],
        author="dev@chainstate.io",
        message="Deploy production VPC and security groups",
        files_changed=["vpc.tf", "security_groups.tf"],
        raw_content="resource \"aws_security_group\" \"web\" { ingress { from_port = 443 to_port = 443 } }",
        plan_json={
            "resources": [
                {
                    "type": "aws_security_group",
                    "name": "web_access_tier",
                    "action": "create",
                    "properties": {"ingress_ports": [443], "cidr": ["10.0.0.0/16"]}
                }
            ]
        },
        resource_count=1,
        status=status,
        risk_level=risk
    )
    db.add(change)
    db.commit()
    db.refresh(change)
    db.close()
    return change


def test_cannot_deploy_unapproved_change():
    """Governance Policy: Unapproved changes cannot be deployed to cloud environments."""
    change = create_test_change(status=DeploymentState.PENDING, risk=RiskLevel.HIGH)
    headers = get_auth_headers("dev@chainstate.io")

    payload = {
        "change_id": change.change_id,
        "environment": "production",
        "region": "us-east-1"
    }
    response = client.post("/api/deployments", json=payload, headers=headers)
    assert response.status_code == 400
    assert "Only APPROVED changes can be deployed" in response.json()["detail"]


def test_successful_deployment_in_demo_mode():
    """Approved changes can be successfully deployed, emitting realistic logs and provisioned ARNs."""
    change = create_test_change(status=DeploymentState.APPROVED, risk=RiskLevel.LOW)
    headers = get_auth_headers("dev@chainstate.io")

    payload = {
        "change_id": change.change_id,
        "environment": "production",
        "region": "us-east-1"
    }
    response = client.post("/api/deployments", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert data["state"] == "DEPLOYED"
    assert data["is_demo_mode"] is True
    assert data["target_environment"] == "production"
    assert data["aws_region"] == "us-east-1"
    assert len(data["resources_provisioned"]) > 0

    first_resource = data["resources_provisioned"][0]
    assert first_resource["resource_type"] == "aws_security_group"
    assert first_resource["arn"].startswith("arn:aws:ec2:us-east-1:123456789012:security-group/")
    assert first_resource["physical_id"].startswith("sg-")
    assert first_resource["status"] == "PROVISIONED"

    # Verify execution logs contain Terraform lifecycle events
    logs = data["logs"]
    assert any("[INIT]" in line for line in logs)
    assert any("[PLAN]" in line for line in logs)
    assert any("[EXEC]" in line for line in logs)
    assert any("[SUCCESS]" in line for line in logs)

    # Verify canonical SHA-256 evidence
    assert data["audit_hash"] is not None
    assert len(data["audit_hash"]) == 64
    assert data["blockchain_tx_id"].startswith("tx_deploy_")


def test_list_and_get_deployment_details():
    """List deployments endpoint and retrieve full log output by deployment ID."""
    change = create_test_change(status=DeploymentState.APPROVED, risk=RiskLevel.LOW)
    headers = get_auth_headers("admin@chainstate.io")

    deploy_res = client.post("/api/deployments", json={"change_id": change.change_id}, headers=headers)
    assert deploy_res.status_code == 200
    dep_id = deploy_res.json()["id"]

    # Test GET /api/deployments
    list_res = client.get("/api/deployments", headers=headers)
    assert list_res.status_code == 200
    deployments = list_res.json()
    assert isinstance(deployments, list)
    assert any(d["id"] == dep_id for d in deployments)

    # Test GET /api/deployments/{id}
    detail_res = client.get(f"/api/deployments/{dep_id}", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == dep_id
    assert detail["state"] == "DEPLOYED"
    assert len(detail["logs"]) > 0
