import json
import hashlib
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.approval import Approval
from app.models.terraform_change import TerraformChange
from app.models.risk_assessment import RiskAssessment
from app.models.security_finding import SecurityFinding
from app.models.audit_record import AuditRecord
from app.models.user import User
from app.models.enums import UserRole, ApprovalDecision, DeploymentState, RiskLevel, BlockchainStatus
from app.schemas.approval import ApprovalCreateRequest, ApprovalRecordResponse, PendingChangeItem
from app.schemas.security import FindingResponse


class ApprovalService:
    """Enforces role-based change governance policies and records approval decisions."""

    def process_approval(
        self,
        request: ApprovalCreateRequest,
        reviewer: User,
        db: Session
    ) -> ApprovalRecordResponse:
        """Evaluates policy gates and records human sign-off or rejection."""
        # 1. Fetch Target Change
        change = db.query(TerraformChange).filter(
            (TerraformChange.id == request.change_id) | (TerraformChange.change_id == request.change_id)
        ).first()
        if not change:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Terraform change '{request.change_id}' not found."
            )

        # 2. Enforce Role-Based Access Control (RBAC)
        if reviewer.role == UserRole.DEVELOPER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Developers are not authorized to approve infrastructure deployments. Required role: Security Reviewer, Approver, or Administrator."
            )

        # 3. Enforce Risk Governance Policy Gates
        risk = change.risk_level or RiskLevel.MEDIUM

        if risk == RiskLevel.CRITICAL and request.decision == ApprovalDecision.APPROVED:
            # Critical changes mandate Approver or Administrator role
            if reviewer.role not in [UserRole.APPROVER, UserRole.ADMINISTRATOR]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="CRITICAL risk infrastructure changes can only be approved by an Approver or Administrator with an executive override."
                )
            if not request.override_rationale or len(request.override_rationale.strip()) < 5:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Approving CRITICAL risk infrastructure requires explicit non-empty executive override rationale."
                )

        if risk == RiskLevel.HIGH and request.decision == ApprovalDecision.APPROVED:
            if reviewer.role not in [UserRole.SECURITY_REVIEWER, UserRole.APPROVER, UserRole.ADMINISTRATOR]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Explicit approval from Security Reviewer, Approver, or Administrator is required for HIGH risk changes."
                )

        # 4. Record Decision in Database
        full_comments = request.comments
        if request.override_rationale:
            full_comments += f" [EXECUTIVE OVERRIDE: {request.override_rationale}]"

        approval_record = Approval(
            change_id=change.id,
            reviewer_id=reviewer.id,
            reviewer_name=reviewer.full_name,
            reviewer_role=reviewer.role,
            decision=request.decision,
            comments=full_comments
        )
        db.add(approval_record)

        # 5. Transition Change Status
        if request.decision == ApprovalDecision.APPROVED:
            change.status = DeploymentState.APPROVED
        elif request.decision in [ApprovalDecision.REJECTED, ApprovalDecision.BLOCKED]:
            change.status = DeploymentState.BLOCKED

        # 6. Generate Canonical SHA-256 Audit Trail Record
        audit_payload = {
            "event_type": "APPROVAL_DECISION",
            "change_id": change.change_id,
            "decision": request.decision.value,
            "reviewer": reviewer.email,
            "reviewer_role": reviewer.role.value,
            "comments": full_comments,
            "risk_level": risk.value,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        canonical_str = json.dumps(audit_payload, sort_keys=True, separators=(",", ":"))
        sha256_digest = hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

        audit_entry = AuditRecord(
            event_type="APPROVAL_DECISION",
            actor=f"{reviewer.full_name} ({reviewer.email})",
            change_id=change.change_id,
            payload=audit_payload,
            sha256_hash=sha256_digest,
            blockchain_status=BlockchainStatus.DEMO,
            blockchain_transaction_id=f"tx_approval_{sha256_digest[:24]}"
        )
        db.add(audit_entry)

        db.commit()
        db.refresh(approval_record)
        return approval_record

    def list_pending_approvals(self, db: Session) -> List[PendingChangeItem]:
        """Lists all governed changes currently awaiting approval sign-off."""
        changes = db.query(TerraformChange).filter(
            TerraformChange.status.in_([
                DeploymentState.PENDING,
                DeploymentState.APPROVAL_REQUIRED
            ])
        ).order_by(TerraformChange.created_at.desc()).all()

        items: List[PendingChangeItem] = []
        for c in changes:
            # Fetch latest risk assessment if any
            assessment = db.query(RiskAssessment).filter(RiskAssessment.change_id == c.id).first()
            findings = db.query(SecurityFinding).filter(SecurityFinding.change_id == c.id).all()
            finding_responses = [FindingResponse.model_validate(f) for f in findings]

            items.append(PendingChangeItem(
                id=c.id,
                change_id=c.change_id,
                repository=c.repository,
                branch=c.branch,
                commit_hash=c.commit_hash,
                author=c.author,
                message=c.message,
                files_changed=c.files_changed,
                resource_count=c.resource_count,
                is_destructive=c.is_destructive,
                status=c.status,
                risk_level=c.risk_level or (assessment.risk_level if assessment else None),
                risk_score=assessment.risk_score if assessment else None,
                findings_count=len(findings),
                findings=finding_responses,
                created_at=c.created_at
            ))
        return items

    def list_approval_history(self, change_id: Optional[str], db: Session) -> List[ApprovalRecordResponse]:
        """Returns chronological history of approval records."""
        query = db.query(Approval)
        if change_id:
            change = db.query(TerraformChange).filter(
                (TerraformChange.id == change_id) | (TerraformChange.change_id == change_id)
            ).first()
            if change:
                query = query.filter(Approval.change_id == change.id)
            else:
                return []
        return query.order_by(Approval.created_at.desc()).all()


approval_service = ApprovalService()
