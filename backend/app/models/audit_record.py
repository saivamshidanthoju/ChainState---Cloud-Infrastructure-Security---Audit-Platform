import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Enum, JSON
from app.database import Base
from app.models.enums import BlockchainStatus


class AuditRecord(Base):
    __tablename__ = "audit_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_type = Column(String(64), index=True, nullable=False) # e.g. CHANGE_SUBMITTED, RISK_CALCULATED, APPROVAL_GRANTED, DEPLOYMENT_COMPLETED, DRIFT_DETECTED
    actor = Column(String(128), nullable=False) # e.g. dev@chainstate.io, system, approver@chainstate.io
    change_id = Column(String(64), index=True, nullable=True)
    
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    payload = Column(JSON, default=dict, nullable=False) # Canonical JSON representation
    sha256_hash = Column(String(64), index=True, nullable=False)
    
    blockchain_status = Column(Enum(BlockchainStatus), default=BlockchainStatus.DEMO, nullable=False)
    blockchain_transaction_id = Column(String(128), index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
