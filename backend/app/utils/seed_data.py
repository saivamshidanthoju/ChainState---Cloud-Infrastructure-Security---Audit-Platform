import logging
import hashlib
import json
from datetime import datetime
from sqlalchemy.orm import Session
from app.database import Base, engine, SessionLocal
from app.models import (
    User,
    UserRole,
    TerraformChange,
    SecurityFinding,
    RiskAssessment,
    Approval,
    Deployment,
    DriftEvent,
    AuditRecord,
    SeverityLevel,
    RiskLevel,
    ApprovalDecision,
    DeploymentState,
    DriftType,
    BlockchainStatus
)
from app.utils.security import get_password_hash

logger = logging.getLogger("chainstate.seed")


def init_db():
    """Creates database tables if they do not exist."""
    logger.info("Initializing database schema...")
    Base.metadata.create_all(bind=engine)


def seed_data(db: Session):
    """Seeds initial demonstration users and sample infrastructure governance records."""
    default_password = "ChainState2026!"
    hashed_pass = get_password_hash(default_password)

    # 1. Seed Users
    users_to_seed = [
        {
            "email": "dev@chainstate.io",
            "full_name": "David Dev",
            "role": UserRole.DEVELOPER
        },
        {
            "email": "security@chainstate.io",
            "full_name": "Sarah SecOps",
            "role": UserRole.SECURITY_REVIEWER
        },
        {
            "email": "approver@chainstate.io",
            "full_name": "Alex Approver",
            "role": UserRole.APPROVER
        },
        {
            "email": "admin@chainstate.io",
            "full_name": "Alice Admin",
            "role": UserRole.ADMINISTRATOR
        }
    ]

    for u in users_to_seed:
        existing = db.query(User).filter(User.email == u["email"]).first()
        if not existing:
            user = User(
                email=u["email"],
                full_name=u["full_name"],
                hashed_password=hashed_pass,
                role=u["role"],
                is_active=True
            )
            db.add(user)
            logger.info(f"Seeded user: {u['email']} [{u['role'].value}]")

    db.commit()

    # 2. Seed Baseline Sample Terraform Changes if none exist
    if db.query(TerraformChange).count() == 0:
        logger.info("Seeding baseline Terraform governance demo changes...")
        
        # Change 1: High-Risk Insecure Security Group (Open Port 22 SSH)
        chg1 = TerraformChange(
            change_id="CHG-2026-001",
            repository="chainstate/cloud-governed-vpc",
            branch="feat/bastion-access",
            commit_hash="a7f83b2",
            author="David Dev (dev@chainstate.io)",
            message="Add public ingress rule for administrative bastion node",
            files_changed=["security_groups.tf", "main.tf"],
            raw_content="""resource "aws_security_group" "bastion_ingress" {
  name        = "bastion-external-sg"
  description = "Allows direct SSH administrative access"
  vpc_id      = "vpc-09823412"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}""",
            resource_count=1,
            is_destructive=False,
            status=DeploymentState.APPROVAL_REQUIRED,
            risk_level=RiskLevel.HIGH
        )
        db.add(chg1)
        db.flush()

        # Findings for Change 1
        finding1 = SecurityFinding(
            change_id=chg1.id,
            check_id="CKV_AWS_24",
            title="Ensure no security groups allow ingress from 0.0.0.0:0 to port 22",
            severity=SeverityLevel.HIGH,
            resource="aws_security_group.bastion_ingress",
            message="Security group allows SSH (port 22) ingress open to the entire internet (0.0.0.0/0).",
            remediation="Restrict CIDR block to authorized corporate bastion IP ranges or utilize AWS Systems Manager Session Manager.",
            passed=False
        )
        db.add(finding1)

        # Risk assessment for Change 1
        risk1 = RiskAssessment(
            change_id=chg1.id,
            risk_level=RiskLevel.HIGH,
            risk_score=0.82,
            reasons=[
                "Exposed sensitive administrative port: SSH (22)",
                "CIDR range open to world (0.0.0.0/0)",
                "High severity Checkov policy failure (CKV_AWS_24)"
            ],
            recommended_action="Explicit approval required from Security Reviewer or Approver before deployment.",
            features={
                "public_access": 1,
                "exposed_port": 1,
                "cidr_open": 1,
                "iam_change": 0,
                "destructive_change": 0,
                "security_findings": 1,
                "resource_count": 1,
                "resource_type_risk": 2
            },
            model_type="RandomForestClassifier",
            is_demo=True
        )
        db.add(risk1)

        # Approval pending for Change 1
        appr1 = Approval(
            change_id=chg1.id,
            reviewer_name="Pending Assignment",
            reviewer_role=UserRole.SECURITY_REVIEWER,
            decision=ApprovalDecision.PENDING,
            comments="Waiting for security team review of open port 22 justification."
        )
        db.add(appr1)

        # Change 2: Safe S3 Bucket with SSE-KMS & Public Access Block (LOW Risk, Deployed)
        chg2 = TerraformChange(
            change_id="CHG-2026-002",
            repository="chainstate/data-lake-storage",
            branch="main",
            commit_hash="c3e109d",
            author="David Dev (dev@chainstate.io)",
            message="Provision secure audit logs archive bucket with default KMS encryption",
            files_changed=["s3_audit.tf"],
            raw_content="""resource "aws_s3_bucket" "audit_bucket" {
  bucket = "chainstate-audit-archive-us-east-1"
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
}""",
            resource_count=3,
            is_destructive=False,
            status=DeploymentState.DEPLOYED,
            risk_level=RiskLevel.LOW
        )
        db.add(chg2)
        db.flush()

        # Risk assessment for Change 2
        risk2 = RiskAssessment(
            change_id=chg2.id,
            risk_level=RiskLevel.LOW,
            risk_score=0.12,
            reasons=[
                "Zero public access detected",
                "Server-side encryption enabled (AWS KMS)",
                "All public access explicitly blocked"
            ],
            recommended_action="Safe infrastructure change; eligible for automatic deployment.",
            features={
                "public_access": 0,
                "exposed_port": 0,
                "cidr_open": 0,
                "iam_change": 0,
                "destructive_change": 0,
                "security_findings": 0,
                "resource_count": 3,
                "resource_type_risk": 0
            },
            model_type="RandomForestClassifier",
            is_demo=True
        )
        db.add(risk2)

        # Deployment for Change 2
        dep2 = Deployment(
            change_id=chg2.id,
            state=DeploymentState.DEPLOYED,
            target_environment="prod",
            aws_region="us-east-1",
            resources_provisioned=[
                "arn:aws:s3:::chainstate-audit-archive-us-east-1",
                "arn:aws:s3:::chainstate-audit-archive-us-east-1/encryption",
                "arn:aws:s3:::chainstate-audit-archive-us-east-1/public-access-block"
            ],
            logs=[
                "Terraform init: Success",
                "Terraform plan: 3 to add, 0 to change, 0 to destroy",
                "Terraform apply: aws_s3_bucket.audit_bucket created",
                "Terraform apply: encryption and public access block applied",
                "Deployment verification: 200 OK"
            ]
        )
        db.add(dep2)
        db.flush()

        # Drift Event for Change 2 (Simulated out-of-band manual drift)
        drift1 = DriftEvent(
            deployment_id=dep2.id,
            resource_id="chainstate-audit-archive-us-east-1",
            resource_type="aws_s3_bucket",
            expected_state={"block_public_acls": True, "restrict_public_buckets": True},
            actual_state={"block_public_acls": False, "restrict_public_buckets": False},
            drift_type=DriftType.SECURITY_DRIFT,
            severity=SeverityLevel.CRITICAL
        )
        db.add(drift1)

        # Audit Record for Change 2
        payload_data = {
            "change_id": "CHG-2026-002",
            "event": "DEPLOYMENT_COMPLETED",
            "environment": "prod",
            "actor": "dev@chainstate.io",
            "status": "SUCCESS",
            "resources": ["arn:aws:s3:::chainstate-audit-archive-us-east-1"]
        }
        canonical_str = json.dumps(payload_data, sort_keys=True, separators=(",", ":"))
        digest = hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

        audit1 = AuditRecord(
            event_type="DEPLOYMENT_COMPLETED",
            actor="dev@chainstate.io",
            change_id="CHG-2026-002",
            payload=payload_data,
            sha256_hash=digest,
            blockchain_status=BlockchainStatus.DEMO,
            blockchain_transaction_id="tx_demo_8f92ac01948271038291048201948291"
        )
        db.add(audit1)

        db.commit()
        logger.info("Baseline seed data initialized successfully.")
