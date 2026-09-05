from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.enums import DeploymentState


class DeploymentTriggerRequest(BaseModel):
    change_id: str = Field(..., description="ID or change_id of the approved Terraform change to deploy")
    environment: str = Field(default="production", description="Target deployment environment (e.g. production, staging, dev)")
    region: str = Field(default="us-east-1", description="Target AWS region")
    dry_run: bool = Field(default=False, description="If true, generates execution plan without persisting resource state")


class ProvisionedResourceItem(BaseModel):
    resource_type: str
    resource_name: str
    physical_id: str
    arn: str
    action: str = "create"  # create, update, delete
    status: str = "PROVISIONED"  # PROVISIONED, FAILED, DESTROYED
    properties: Dict[str, Any] = Field(default_factory=dict)


class DeploymentListItem(BaseModel):
    id: str
    change_id: str
    change_identifier: str
    change_message: str
    author: str
    state: DeploymentState
    target_environment: str
    aws_region: str
    is_demo_mode: bool
    resource_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DeploymentResponse(BaseModel):
    id: str
    change_id: str
    change_identifier: str
    change_message: str
    author: str
    state: DeploymentState
    target_environment: str
    aws_region: str
    is_demo_mode: bool
    resources_provisioned: List[ProvisionedResourceItem]
    logs: List[str]
    audit_hash: Optional[str] = None
    blockchain_tx_id: Optional[str] = None
    duration_seconds: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
