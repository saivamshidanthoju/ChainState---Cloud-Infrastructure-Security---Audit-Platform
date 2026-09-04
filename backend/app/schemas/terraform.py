from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.enums import DeploymentState, RiskLevel


class ParsedResource(BaseModel):
    resource_type: str
    resource_name: str
    action: str  # create, update, delete, no-op
    public_access: bool = False
    exposed_ports: List[int] = []
    cidr_ranges: List[str] = []
    iam_change: bool = False
    encryption_enabled: bool = False
    is_destructive: bool = False
    details: Dict[str, Any] = {}


class TerraformPlanSummary(BaseModel):
    total_resources: int
    to_add: int
    to_change: int
    to_destroy: int
    is_destructive: bool
    resources: List[ParsedResource]
    raw_plan_available: bool = False


class TerraformAnalysisRequest(BaseModel):
    raw_content: Optional[str] = None
    plan_json: Optional[Dict[str, Any]] = None
    file_name: Optional[str] = "main.tf"


class TerraformChangeCreate(BaseModel):
    repository: str = "chainstate/infra-core"
    branch: str = "main"
    commit_hash: str = "HEAD"
    author: Optional[str] = None
    message: str
    raw_content: Optional[str] = None
    plan_json: Optional[Dict[str, Any]] = None
    files_changed: List[str] = ["main.tf"]


class TerraformChangeResponse(BaseModel):
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
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
