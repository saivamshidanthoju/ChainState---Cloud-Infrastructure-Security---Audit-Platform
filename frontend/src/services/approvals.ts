import { apiClient } from './api';
import { ApprovalRecord, ApprovalDecision, RiskLevel, DeploymentState, SecurityFinding } from '../types';

export interface PendingApprovalItem {
  id: string;
  change_id: string;
  repository: string;
  branch: string;
  commit_hash: string;
  author: string;
  message: string;
  files_changed: string[];
  resource_count: number;
  is_destructive: boolean;
  status: DeploymentState;
  risk_level?: RiskLevel;
  risk_score?: number;
  findings_count: number;
  findings: SecurityFinding[];
  created_at: string;
}

export interface ApprovalPayload {
  change_id: string;
  decision: ApprovalDecision;
  comments: string;
  override_rationale?: string;
}

export const fetchPendingApprovals = async (): Promise<PendingApprovalItem[]> => {
  const response = await apiClient.get<PendingApprovalItem[]>('/approvals/pending');
  return response.data;
};

export const fetchApprovalHistory = async (changeId?: string): Promise<ApprovalRecord[]> => {
  const params: any = {};
  if (changeId) params.change_id = changeId;
  const response = await apiClient.get<ApprovalRecord[]>('/approvals', { params });
  return response.data;
};

export const submitApproval = async (payload: ApprovalPayload): Promise<ApprovalRecord> => {
  const response = await apiClient.post<ApprovalRecord>('/approvals', payload);
  return response.data;
};
