from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.enums import SeverityLevel


class FindingResponse(BaseModel):
    id: Optional[str] = None
    change_id: Optional[str] = None
    check_id: str
    title: str
    severity: SeverityLevel
    resource: str
    message: str
    remediation: Optional[str] = None
    passed: bool = False
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SecurityScanRequest(BaseModel):
    change_id: Optional[str] = None
    raw_content: Optional[str] = None
    plan_json: Optional[Dict[str, Any]] = None


class SecurityScanResult(BaseModel):
    scanner_used: str  # "Checkov CLI" or "ChainState Built-in CIS Rules Engine"
    total_findings: int
    failed_count: int
    passed_count: int
    high_critical_count: int
    findings: List[FindingResponse]
