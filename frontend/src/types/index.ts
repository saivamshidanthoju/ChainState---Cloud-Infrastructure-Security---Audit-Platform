export type UserRole = 'Developer' | 'Security Reviewer' | 'Approver' | 'Administrator';

export interface User {
  id: string;
  email: string;
  full_name: string;
  name?: string;
  role: UserRole;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ApprovalDecision = 'PENDING' | 'APPROVED' | 'REJECTED' | 'BLOCKED';

export type DeploymentState = 
  | 'PENDING' 
  | 'APPROVAL_REQUIRED' 
  | 'APPROVED' 
  | 'DEPLOYING' 
  | 'DEPLOYED' 
  | 'FAILED' 
  | 'BLOCKED' 
  | 'DRIFT_DETECTED';

export type DriftType = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'SECURITY_DRIFT';

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SecurityFinding {
  id: string;
  check_id: string;
  title?: string;
  severity: SeverityLevel;
  resource: string;
  message: string;
  remediation?: string;
  passed: boolean;
}

export interface RiskAssessment {
  id: string;
  change_id: string;
  risk_level: RiskLevel;
  risk_score: number;
  reasons: string[];
  recommended_action: string;
  features: {
    public_access: number;
    exposed_port: number;
    cidr_open: number;
    iam_change: number;
    destructive_change: number;
    security_findings: number;
    resource_count: number;
    resource_type_risk: number;
  };
  model_info?: {
    model_type: string;
    is_demo: boolean;
    accuracy_notice: string;
  };
}

export interface TerraformChange {
  id: string;
  repository: string;
  commit_hash: string;
  author: string;
  message: string;
  files_changed: string[];
  resource_count: number;
  destructive: boolean;
  status: DeploymentState;
  risk_level?: RiskLevel;
  created_at: string;
}

export interface ApprovalRecord {
  id: string;
  change_id: string;
  reviewer_name: string;
  role: UserRole;
  decision: ApprovalDecision;
  comments: string;
  timestamp: string;
}

export interface DeploymentRecord {
  id: string;
  change_id: string;
  state: DeploymentState;
  target_environment: string;
  aws_region: string;
  resources_provisioned: string[];
  logs: string[];
  created_at: string;
  updated_at: string;
}

export interface DriftRecord {
  id: string;
  resource_id: string;
  resource_type: string;
  expected_state: Record<string, any>;
  actual_state: Record<string, any>;
  drift_type: DriftType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detected_at: string;
}

export interface AuditRecord {
  id: string;
  event_type: string;
  actor: string;
  change_id: string;
  timestamp: string;
  payload: Record<string, any>;
  sha256_hash: string;
  blockchain_status: 'DEMO' | 'CONFIRMED' | 'FAILED';
  blockchain_transaction_id: string;
  is_verified?: boolean;
}

export interface DashboardSummary {
  total_changes: number;
  pending_approvals: number;
  high_critical_risks: number;
  successful_deployments: number;
  drift_events: number;
  audit_records: number;
  blockchain_status: string;
  demo_mode: boolean;
}
