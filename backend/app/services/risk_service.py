import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.risk_assessment import RiskAssessment
from app.models.terraform_change import TerraformChange
from app.models.security_finding import SecurityFinding
from app.models.enums import RiskLevel, DeploymentState
from app.schemas.risk import RiskAssessmentResponse
from app.schemas.security import FindingResponse
from app.schemas.terraform import TerraformPlanSummary
from app.services.terraform_service import terraform_service
from app.services.security_service import security_scanner
from app.ml.model import risk_model

logger = logging.getLogger("chainstate.risk")


class RiskService:
    """Orchestrates AI Risk Classification using Random Forest model."""

    def assess_plan(
        self, 
        plan_summary: TerraformPlanSummary, 
        findings: List[FindingResponse],
        change_id: Optional[str] = None
    ) -> RiskAssessmentResponse:
        """Evaluates risk for a given plan and findings without persisting to DB."""
        features = risk_model.extract_features(plan_summary, findings)
        risk_level, risk_score, reasons, action = risk_model.predict(features)

        model_info = {
            "model_type": risk_model.metadata.get("model_type", "RandomForestClassifier"),
            "is_demo": risk_model.metadata.get("is_demo", True),
            "validation_accuracy": risk_model.metadata.get("validation_accuracy", 0.96),
            "notice": risk_model.metadata.get("notice", "")
        }

        return RiskAssessmentResponse(
            change_id=change_id,
            risk_level=risk_level,
            risk_score=risk_score,
            reasons=reasons,
            recommended_action=action,
            features=features,
            detected_security_findings=findings,
            model_info=model_info
        )

    def assess_change(self, change_id: str, db: Session) -> RiskAssessmentResponse:
        """Evaluates risk for an existing TerraformChange in the database and persists assessment."""
        change = db.query(TerraformChange).filter(
            (TerraformChange.id == change_id) | (TerraformChange.change_id == change_id)
        ).first()
        if not change:
            raise ValueError(f"Terraform change '{change_id}' not found.")

        # 1. Parse plan and scan security
        plan_summary = terraform_service.analyze(raw_content=change.raw_content, plan_json=change.plan_json)
        scan_result = security_scanner.scan(plan_summary)

        # 2. Extract features & predict
        features = risk_model.extract_features(plan_summary, scan_result.findings)
        risk_level, risk_score, reasons, action = risk_model.predict(features)

        # 3. Persist RiskAssessment record
        db_assessment = RiskAssessment(
            change_id=change.id,
            risk_level=risk_level,
            risk_score=risk_score,
            reasons=reasons,
            recommended_action=action,
            features=features,
            model_type=risk_model.metadata.get("model_type", "RandomForestClassifier"),
            is_demo=True
        )
        db.add(db_assessment)

        # 4. Update change risk level and governance gate status
        change.risk_level = risk_level
        if risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL] and change.status == DeploymentState.PENDING:
            change.status = DeploymentState.APPROVAL_REQUIRED
        elif risk_level == RiskLevel.LOW and change.status == DeploymentState.PENDING:
            # Low risk can proceed
            pass

        db.commit()
        db.refresh(db_assessment)

        model_info = {
            "model_type": risk_model.metadata.get("model_type", "RandomForestClassifier"),
            "is_demo": True,
            "validation_accuracy": risk_model.metadata.get("validation_accuracy", 0.96),
            "notice": risk_model.metadata.get("notice", "")
        }

        return RiskAssessmentResponse(
            id=db_assessment.id,
            change_id=change.change_id,
            risk_level=risk_level,
            risk_score=risk_score,
            reasons=reasons,
            recommended_action=action,
            features=features,
            detected_security_findings=scan_result.findings,
            model_info=model_info,
            created_at=db_assessment.created_at
        )


risk_service = RiskService()
