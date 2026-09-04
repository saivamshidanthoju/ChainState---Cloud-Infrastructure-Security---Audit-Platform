from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.terraform_change import TerraformChange
from app.models.risk_assessment import RiskAssessment
from app.models.security_finding import SecurityFinding
from app.schemas.risk import RiskAssessmentResponse, RiskEvaluationRequest, ModelInfoResponse
from app.schemas.security import FindingResponse
from app.services.risk_service import risk_service
from app.services.terraform_service import terraform_service
from app.services.security_service import security_scanner
from app.ml.model import risk_model

router = APIRouter(prefix="/risk", tags=["AI Risk Scoring Engine"])


@router.post("/analyze", response_model=RiskAssessmentResponse)
def analyze_risk(request: RiskEvaluationRequest, db: Session = Depends(get_db)) -> Any:
    """Executes Random Forest risk assessment on a change ID or raw configuration."""
    if request.change_id:
        try:
            return risk_service.assess_change(request.change_id, db)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))

    # Evaluate ad-hoc preview
    plan_summary = terraform_service.analyze(raw_content=request.raw_content, plan_json=request.plan_json)
    scan_result = security_scanner.scan(plan_summary)
    return risk_service.assess_plan(plan_summary, scan_result.findings)


@router.get("/{change_id}", response_model=RiskAssessmentResponse)
def get_change_risk(change_id: str, db: Session = Depends(get_db)) -> Any:
    """Retrieves the AI risk assessment for a specified Terraform change."""
    change = db.query(TerraformChange).filter(
        (TerraformChange.id == change_id) | (TerraformChange.change_id == change_id)
    ).first()
    if not change:
        raise HTTPException(status_code=404, detail="Change ID not found")

    assessment = db.query(RiskAssessment).filter(RiskAssessment.change_id == change.id).order_by(
        RiskAssessment.created_at.desc()
    ).first()

    if assessment:
        findings = db.query(SecurityFinding).filter(SecurityFinding.change_id == change.id).all()
        finding_responses = [FindingResponse.model_validate(f) for f in findings]
        
        return RiskAssessmentResponse(
            id=assessment.id,
            change_id=change.change_id,
            risk_level=assessment.risk_level,
            risk_score=assessment.risk_score,
            reasons=assessment.reasons,
            recommended_action=assessment.recommended_action,
            features=assessment.features,
            detected_security_findings=finding_responses,
            model_info={
                "model_type": assessment.model_type,
                "is_demo": assessment.is_demo,
                "validation_accuracy": risk_model.metadata.get("validation_accuracy", 0.96),
                "notice": risk_model.metadata.get("notice", "")
            },
            created_at=assessment.created_at
        )

    # If no assessment exists yet, compute and persist now
    return risk_service.assess_change(change.id, db)


@router.get("/model/info", response_model=ModelInfoResponse)
def get_model_info():
    """Returns architecture, training accuracy, feature importances, and demo disclaimer."""
    return ModelInfoResponse(
        model_type=risk_model.metadata.get("model_type", "RandomForestClassifier"),
        features=risk_model.metadata.get("features", []),
        classes=risk_model.metadata.get("classes", []),
        validation_accuracy=risk_model.metadata.get("validation_accuracy", 0.96),
        feature_importances=risk_model.metadata.get("feature_importances", {}),
        is_demo=risk_model.metadata.get("is_demo", True),
        notice=risk_model.metadata.get("notice", "")
    )
