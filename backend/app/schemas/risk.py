from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.enums import RiskLevel
from app.schemas.security import FindingResponse


class RiskAssessmentResponse(BaseModel):
    id: Optional[str] = None
    change_id: Optional[str] = None
    risk_level: RiskLevel
    risk_score: float
    reasons: List[str]
    recommended_action: str
    features: Dict[str, float]
    detected_security_findings: List[FindingResponse] = []
    model_info: Dict[str, Any]
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class RiskEvaluationRequest(BaseModel):
    change_id: Optional[str] = None
    raw_content: Optional[str] = None
    plan_json: Optional[Dict[str, Any]] = None


class ModelInfoResponse(BaseModel):
    model_type: str
    features: List[str]
    classes: List[str]
    validation_accuracy: float
    feature_importances: Dict[str, float]
    is_demo: bool
    notice: str
