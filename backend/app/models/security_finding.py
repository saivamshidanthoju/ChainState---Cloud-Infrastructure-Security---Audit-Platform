import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Enum, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.enums import SeverityLevel


class SecurityFinding(Base):
    __tablename__ = "security_findings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    change_id = Column(String(36), ForeignKey("terraform_changes.id", ondelete="CASCADE"), nullable=False, index=True)
    
    check_id = Column(String(64), nullable=False, index=True) # e.g. CKV_AWS_20, CIS_1.2
    title = Column(String(255), nullable=False)
    severity = Column(Enum(SeverityLevel), nullable=False)
    resource = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    remediation = Column(Text, nullable=True)
    passed = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    terraform_change = relationship("TerraformChange", back_populates="security_findings")
