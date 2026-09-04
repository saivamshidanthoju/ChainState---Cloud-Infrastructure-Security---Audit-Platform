import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Enum, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.enums import DriftType, SeverityLevel


class DriftEvent(Base):
    __tablename__ = "drift_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    deployment_id = Column(String(36), ForeignKey("deployments.id", ondelete="SET NULL"), nullable=True, index=True)

    resource_id = Column(String(255), nullable=False) # e.g. sg-0abc1234, s3://my-bucket
    resource_type = Column(String(128), nullable=False) # e.g. aws_security_group, aws_s3_bucket
    expected_state = Column(JSON, default=dict, nullable=False)
    actual_state = Column(JSON, default=dict, nullable=False)
    drift_type = Column(Enum(DriftType), nullable=False)
    severity = Column(Enum(SeverityLevel), default=SeverityLevel.MEDIUM, nullable=False)

    detected_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    deployment = relationship("Deployment", back_populates="drift_events")
