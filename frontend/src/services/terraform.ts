import { apiClient } from './api';
import { SecurityFinding, RiskLevel, DeploymentState } from '../types';

export interface ParsedResource {
  resource_type: string;
  resource_name: string;
  action: string;
  public_access: boolean;
  exposed_ports: number[];
  cidr_ranges: string[];
  iam_change: boolean;
  encryption_enabled: boolean;
  is_destructive: boolean;
  details: Record<string, any>;
}

export interface TerraformPlanSummary {
  total_resources: number;
  to_add: number;
  to_change: number;
  to_destroy: number;
  is_destructive: boolean;
  resources: ParsedResource[];
  raw_plan_available: boolean;
}

export interface TerraformChangeItem {
  id: string;
  change_id: string;
  repository: string;
  branch: string;
  commit_hash: string;
  author: string;
  message: string;
  files_changed: string[];
  raw_content?: string;
  resource_count: number;
  is_destructive: boolean;
  status: DeploymentState;
  risk_level?: RiskLevel;
  created_at: string;
  updated_at: string;
}

export interface SecurityRule {
  check_id: string;
  name: string;
  severity: string;
  category: string;
  benchmark: string;
}

export const analyzeTerraformCode = async (raw_content?: string, plan_json?: any): Promise<TerraformPlanSummary> => {
  const response = await apiClient.post<TerraformPlanSummary>('/terraform/analyze', {
    raw_content,
    plan_json,
  });
  return response.data;
};

export const submitTerraformChange = async (payload: {
  repository?: string;
  branch?: string;
  commit_hash?: string;
  message: string;
  raw_content?: string;
  plan_json?: any;
  files_changed?: string[];
}): Promise<TerraformChangeItem> => {
  const response = await apiClient.post<TerraformChangeItem>('/terraform/changes', payload);
  return response.data;
};

export const fetchTerraformChanges = async (status?: string, risk_level?: string): Promise<TerraformChangeItem[]> => {
  const params: any = {};
  if (status) params.status = status;
  if (risk_level) params.risk_level = risk_level;
  const response = await apiClient.get<TerraformChangeItem[]>('/terraform/changes', { params });
  return response.data;
};

export const fetchChangeDetail = async (id: string): Promise<{
  change: TerraformChangeItem;
  summary: TerraformPlanSummary;
  findings: SecurityFinding[];
}> => {
  const response = await apiClient.get(`/terraform/changes/${id}`);
  return response.data;
};

export const fetchAllFindings = async (severity?: string): Promise<SecurityFinding[]> => {
  const params: any = {};
  if (severity && severity !== 'ALL') params.severity = severity;
  const response = await apiClient.get<SecurityFinding[]>('/security/findings', { params });
  return response.data;
};

export const fetchSecurityRules = async (): Promise<{ engine: string; rules: SecurityRule[] }> => {
  const response = await apiClient.get('/security/rules');
  return response.data;
};
