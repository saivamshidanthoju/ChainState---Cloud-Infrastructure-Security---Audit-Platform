from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.api.deps import get_current_user
from app.schemas.deployment import (
    DeploymentTriggerRequest,
    DeploymentResponse,
    DeploymentListItem
)
from app.services.deployment_service import deployment_service

router = APIRouter()


@router.post("", response_model=DeploymentResponse)
def trigger_deployment(
    request: DeploymentTriggerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Triggers Terraform deployment for an APPROVED change.
    Enforces governance policy: only approved changes can be deployed.
    Generates canonical SHA-256 evidence in DEMO or REAL AWS mode.
    """
    return deployment_service.trigger_deployment(request, current_user, db)


@router.get("", response_model=List[DeploymentListItem])
def list_deployments(
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns history of executed infrastructure deployments."""
    return deployment_service.list_deployments(db, limit=limit)


@router.get("/{deployment_id}", response_model=DeploymentResponse)
def get_deployment_details(
    deployment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves full deployment log output, provisioned AWS ARNs, and canonical hash."""
    return deployment_service.get_deployment(deployment_id, db)
