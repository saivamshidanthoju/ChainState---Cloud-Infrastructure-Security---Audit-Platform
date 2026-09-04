import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Enum, Text, JSON
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.enums import DeploymentState, RiskLevel


class TerraformChange(Base):
    __tablename__ = "terraform_changes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    change_id = Column(String(64), unique=True, index=True, nullable=False) # e.g. CHG-2026-001
    repository = Column(String(255), nullable=False, default="chainstate/infra-core")
    branch = Column(String(128), nullable=False, default="main")
    commit_hash = Column(String(64), nullable=False, default="HEAD")
    author = Column(String(128), nullable=False)
    message = Column(String(512), nullable=False)
    
    # Content & parsed representation
    files_changed = Column(JSON, default=list, nullable=False)
    raw_content = Column(Text, nullable=True)
    plan_json = Column(JSON, nullable=True)
    resource_count = Column(Integer, default=0, nullable=False)
    is_destructive = Column(Boolean, default=False, nullable=False)

    # Lifecycle state
    status = Column(Enum(DeploymentState), default=DeploymentState.PENDING, nullable=False)
    risk_level = Column(Enum(RiskLevel), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    security_findings = relationship("SecurityFinding", back_populates="terraform_change", cascade="all, delete-orphan")
    risk_assessments = relationship("RiskAssessment", back_populates="terraform_change", cascade="all, delete-orphan")
    approvals = relationship("Approval", back_populates="terraform_change", cascade="all, delete-orphan")
    deployments = relationship("Deployment", back_populates="terraform_change", cascade="all, delete-orphan")
