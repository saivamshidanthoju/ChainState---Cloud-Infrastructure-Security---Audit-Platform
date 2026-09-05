from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.enums import ApprovalDecision, UserRole, RiskLevel, DeploymentState
from app.schemas.security import FindingResponse


class ApprovalCreateRequest(BaseModel):
    change_id: str
    decision: ApprovalDecision
    comments: str = Field(..., min_length=3, description="Mandatory review comments and technical rationale.")
    override_rationale: Optional[str] = Field(
        None, 
        description="Mandatory executive override rationale when approving CRITICAL risk infrastructure."
    )


class ApprovalRecordResponse(BaseModel):
    id: str
    change_id: str
    reviewer_id: Optional[str] = None
    reviewer_name: str
    reviewer_role: UserRole
    decision: ApprovalDecision
    comments: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PendingChangeItem(BaseModel):
    id: str
    change_id: str
    repository: str
    branch: str
    commit_hash: str
    author: str
    message: str
    files_changed: List[str]
    resource_count: int
    is_destructive: bool
    status: DeploymentState
    risk_level: Optional[RiskLevel] = None
    risk_score: Optional[float] = None
    findings_count: int = 0
    findings: List[FindingResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
