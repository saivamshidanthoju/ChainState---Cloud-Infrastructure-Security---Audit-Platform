import uuid
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.terraform_change import TerraformChange
from app.models.security_finding import SecurityFinding
from app.models.enums import DeploymentState, RiskLevel, SeverityLevel
from app.schemas.terraform import (
    TerraformAnalysisRequest, 
    TerraformPlanSummary, 
    TerraformChangeCreate, 
    TerraformChangeResponse
)
from app.services.terraform_service import terraform_service
from app.services.security_service import security_scanner
from app.api.deps import get_current_user

router = APIRouter(prefix="/terraform", tags=["Terraform Governance & Analysis"])


@router.post("/analyze", response_model=TerraformPlanSummary)
def analyze_terraform(request: TerraformAnalysisRequest) -> Any:
    """Parses Terraform HCL or plan JSON and extracts resource actions, ports, CIDRs, and public exposures."""
    summary = terraform_service.analyze(
        raw_content=request.raw_content,
        plan_json=request.plan_json
    )
    return summary


@router.post("/changes", response_model=TerraformChangeResponse, status_code=status.HTTP_201_CREATED)
def submit_terraform_change(
    change_in: TerraformChangeCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
) -> Any:
    """Submits a new governed Terraform change, parses resources, and runs initial security inspection."""
    # 1. Parse Terraform Content
    summary = terraform_service.analyze(
        raw_content=change_in.raw_content,
        plan_json=change_in.plan_json
    )

    # 2. Run Security Scan
    scan_result = security_scanner.scan(summary)

    # 3. Create Change ID (e.g. CHG-2026-XXX)
    count = db.query(TerraformChange).count() + 1
    generated_change_id = f"CHG-2026-{count:03d}"

    author_name = change_in.author or f"{current_user.full_name} ({current_user.email})"

    # 4. Determine initial status
    initial_status = DeploymentState.PENDING
    if scan_result.high_critical_count > 0:
        initial_status = DeploymentState.APPROVAL_REQUIRED

    tf_change = TerraformChange(
        change_id=generated_change_id,
        repository=change_in.repository,
        branch=change_in.branch,
        commit_hash=change_in.commit_hash,
        author=author_name,
        message=change_in.message,
        files_changed=change_in.files_changed,
        raw_content=change_in.raw_content,
        plan_json=change_in.plan_json,
        resource_count=summary.total_resources,
        is_destructive=summary.is_destructive,
        status=initial_status,
        risk_level=RiskLevel.HIGH if scan_result.high_critical_count > 0 else RiskLevel.LOW
    )
    db.add(tf_change)
    db.flush()

    # 5. Persist Security Findings
    for f in scan_result.findings:
        finding = SecurityFinding(
            change_id=tf_change.id,
            check_id=f.check_id,
            title=f.title,
            severity=f.severity,
            resource=f.resource,
            message=f.message,
            remediation=f.remediation,
            passed=f.passed
        )
        db.add(finding)

    db.commit()
    db.refresh(tf_change)
    return tf_change


@router.get("/changes", response_model=List[TerraformChangeResponse])
def list_terraform_changes(
    status: Optional[DeploymentState] = None,
    risk_level: Optional[RiskLevel] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
) -> Any:
    """Lists all governed Terraform changes with optional lifecycle filtering."""
    query = db.query(TerraformChange)
    if status:
        query = query.filter(TerraformChange.status == status)
    if risk_level:
        query = query.filter(TerraformChange.risk_level == risk_level)
    return query.order_by(TerraformChange.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/changes/{change_id}")
def get_terraform_change(change_id: str, db: Session = Depends(get_db)) -> Any:
    """Retrieves complete details, parsed resources, and findings for a change."""
    change = db.query(TerraformChange).filter(
        (TerraformChange.id == change_id) | (TerraformChange.change_id == change_id)
    ).first()
    if not change:
        raise HTTPException(status_code=404, detail="Terraform change not found")

    findings = db.query(SecurityFinding).filter(SecurityFinding.change_id == change.id).all()
    summary = terraform_service.analyze(raw_content=change.raw_content, plan_json=change.plan_json)

    return {
        "change": change,
        "summary": summary,
        "findings": findings
    }
