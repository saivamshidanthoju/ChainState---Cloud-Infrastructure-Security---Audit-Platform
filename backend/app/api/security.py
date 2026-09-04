from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.security_finding import SecurityFinding
from app.models.terraform_change import TerraformChange
from app.models.enums import SeverityLevel
from app.schemas.security import FindingResponse, SecurityScanRequest, SecurityScanResult
from app.services.terraform_service import terraform_service
from app.services.security_service import security_scanner

router = APIRouter(prefix="/security", tags=["Security Scanning & Findings"])


@router.post("/scan", response_model=SecurityScanResult)
def scan_terraform(request: SecurityScanRequest, db: Session = Depends(get_db)) -> Any:
    """Runs Checkov and built-in CIS Benchmark rules against raw HCL or plan JSON."""
    raw_content = request.raw_content
    plan_json = request.plan_json

    if request.change_id:
        change = db.query(TerraformChange).filter(
            (TerraformChange.id == request.change_id) | (TerraformChange.change_id == request.change_id)
        ).first()
        if not change:
            raise HTTPException(status_code=404, detail="Change ID not found")
        raw_content = change.raw_content
        plan_json = change.plan_json

    plan_summary = terraform_service.analyze(raw_content=raw_content, plan_json=plan_json)
    scan_result = security_scanner.scan(plan_summary)
    return scan_result


@router.get("/findings", response_model=List[FindingResponse])
def list_findings(
    severity: Optional[SeverityLevel] = None,
    passed: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
) -> Any:
    """Lists security findings across all changes with severity filters."""
    query = db.query(SecurityFinding)
    if severity:
        query = query.filter(SecurityFinding.severity == severity)
    if passed is not None:
        query = query.filter(SecurityFinding.passed == passed)
    return query.order_by(SecurityFinding.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/rules")
def list_active_rules():
    """Returns the CIS Benchmark & Checkov rules enforced by the ChainState platform."""
    return {
        "engine": "Checkov CLI + ChainState Built-in CIS Rules Engine",
        "rules": [
            {
                "check_id": "CKV_AWS_24",
                "name": "Ensure no security groups allow ingress from 0.0.0.0/0 to port 22",
                "severity": "HIGH",
                "category": "Networking & Access Control",
                "benchmark": "CIS AWS Benchmark 4.1"
            },
            {
                "check_id": "CKV_AWS_25",
                "name": "Ensure no security groups allow ingress from 0.0.0.0/0 to port 3389",
                "severity": "CRITICAL",
                "category": "Networking & Access Control",
                "benchmark": "CIS AWS Benchmark 4.2"
            },
            {
                "check_id": "CKV_AWS_260",
                "name": "Ensure no security groups allow unrestricted ingress to all ports",
                "severity": "CRITICAL",
                "category": "Networking & Access Control",
                "benchmark": "CIS AWS Benchmark 4.3"
            },
            {
                "check_id": "CKV_AWS_20",
                "name": "Ensure S3 bucket is not publicly accessible",
                "severity": "HIGH",
                "category": "Data Storage Protection",
                "benchmark": "CIS AWS Benchmark 2.1.5"
            },
            {
                "check_id": "CKV_AWS_19",
                "name": "Ensure S3 bucket has server-side encryption enabled",
                "severity": "MEDIUM",
                "category": "Data Encryption",
                "benchmark": "CIS AWS Benchmark 2.1.1"
            },
            {
                "check_id": "CKV_AWS_1",
                "name": "Ensure IAM policies do not allow full administrative privileges",
                "severity": "CRITICAL",
                "category": "Identity & Access Management",
                "benchmark": "CIS AWS Benchmark 1.16"
            },
            {
                "check_id": "CKV_AWS_3",
                "name": "Ensure EBS volume encryption is enabled",
                "severity": "MEDIUM",
                "category": "Data Encryption",
                "benchmark": "CIS AWS Benchmark 2.2.1"
            },
            {
                "check_id": "CKV_AWS_16",
                "name": "Ensure RDS database encryption is enabled",
                "severity": "MEDIUM",
                "category": "Data Encryption",
                "benchmark": "CIS AWS Benchmark 2.3.1"
            },
            {
                "check_id": "CKV_AWS_DESTRUCTIVE",
                "name": "Destructive infrastructure change detected",
                "severity": "HIGH",
                "category": "Operational Governance",
                "benchmark": "ChainState IaC Governance Policy"
            }
        ]
    }
