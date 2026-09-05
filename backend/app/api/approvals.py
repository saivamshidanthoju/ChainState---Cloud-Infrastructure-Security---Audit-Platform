from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.enums import UserRole
from app.schemas.approval import ApprovalCreateRequest, ApprovalRecordResponse, PendingChangeItem
from app.services.approval_service import approval_service
from app.api.deps import get_current_user

router = APIRouter(prefix="/approvals", tags=["Role-Based Approval Governance"])


@router.post("", response_model=ApprovalRecordResponse, status_code=status.HTTP_201_CREATED)
def submit_approval_decision(
    request: ApprovalCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Submits an explicit approval or rejection decision. Enforces strict RBAC and risk policy gates."""
    return approval_service.process_approval(request, current_user, db)


@router.get("/pending", response_model=List[PendingChangeItem])
def get_pending_approvals(db: Session = Depends(get_db)) -> Any:
    """Lists all changes currently in the queue awaiting security review or executive approval."""
    return approval_service.list_pending_approvals(db)


@router.get("", response_model=List[ApprovalRecordResponse])
def get_all_approvals(
    change_id: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Any:
    """Retrieves full chronological history of approval records."""
    return approval_service.list_approval_history(change_id, db)


@router.get("/{change_id}", response_model=List[ApprovalRecordResponse])
def get_change_approvals(change_id: str, db: Session = Depends(get_db)) -> Any:
    """Retrieves approval history for a specific change."""
    return approval_service.list_approval_history(change_id, db)
