import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime, Enum, JSON, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.enums import RiskLevel


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    change_id = Column(String(36), ForeignKey("terraform_changes.id", ondelete="CASCADE"), nullable=False, index=True)

    risk_level = Column(Enum(RiskLevel), nullable=False)
    risk_score = Column(Float, nullable=False) # 0.0 to 1.0
    reasons = Column(JSON, default=list, nullable=False)
    recommended_action = Column(Text, nullable=False)
    features = Column(JSON, default=dict, nullable=False) # 8 core features used by model

    model_type = Column(String(64), default="RandomForestClassifier", nullable=False)
    is_demo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    terraform_change = relationship("TerraformChange", back_populates="risk_assessments")
