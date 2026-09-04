import enum


class UserRole(str, enum.Enum):
    DEVELOPER = "Developer"
    SECURITY_REVIEWER = "Security Reviewer"
    APPROVER = "Approver"
    ADMINISTRATOR = "Administrator"


class SeverityLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ApprovalDecision(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    BLOCKED = "BLOCKED"


class DeploymentState(str, enum.Enum):
    PENDING = "PENDING"
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"
    APPROVED = "APPROVED"
    DEPLOYING = "DEPLOYING"
    DEPLOYED = "DEPLOYED"
    FAILED = "FAILED"
    BLOCKED = "BLOCKED"
    DRIFT_DETECTED = "DRIFT_DETECTED"


class DriftType(str, enum.Enum):
    ADDED = "ADDED"
    REMOVED = "REMOVED"
    MODIFIED = "MODIFIED"
    SECURITY_DRIFT = "SECURITY_DRIFT"


class BlockchainStatus(str, enum.Enum):
    DEMO = "DEMO"
    CONFIRMED = "CONFIRMED"
    FAILED = "FAILED"
