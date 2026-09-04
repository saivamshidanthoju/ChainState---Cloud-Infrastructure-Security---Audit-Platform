import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Enum, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.enums import DeploymentState


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    change_id = Column(String(36), ForeignKey("terraform_changes.id", ondelete="CASCADE"), nullable=False, index=True)

    state = Column(Enum(DeploymentState), default=DeploymentState.PENDING, nullable=False)
    target_environment = Column(String(64), default="dev", nullable=False)
    aws_region = Column(String(32), default="us-east-1", nullable=False)
    resources_provisioned = Column(JSON, default=list, nullable=False)
    logs = Column(JSON, default=list, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    terraform_change = relationship("TerraformChange", back_populates="deployments")
    drift_events = relationship("DriftEvent", back_populates="deployment")
