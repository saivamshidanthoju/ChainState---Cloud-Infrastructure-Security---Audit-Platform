import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Enum, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.enums import ApprovalDecision, UserRole


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    change_id = Column(String(36), ForeignKey("terraform_changes.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    reviewer_name = Column(String(128), nullable=False)
    reviewer_role = Column(Enum(UserRole), nullable=False)
    decision = Column(Enum(ApprovalDecision), default=ApprovalDecision.PENDING, nullable=False)
    comments = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    terraform_change = relationship("TerraformChange", back_populates="approvals")
    reviewer = relationship("User", back_populates="approvals")
