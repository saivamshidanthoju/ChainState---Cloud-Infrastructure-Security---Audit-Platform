import { apiClient } from './api';
import { DeploymentListItem, DeploymentResponse, TerraformChange } from '../types';

export interface TriggerDeploymentPayload {
  change_id: string;
  environment?: string;
  region?: string;
  dry_run?: boolean;
}

export const getDeployments = async (): Promise<DeploymentListItem[]> => {
  const response = await apiClient.get<DeploymentListItem[]>('/deployments');
  return response.data;
};

export const getDeploymentDetails = async (id: string): Promise<DeploymentResponse> => {
  const response = await apiClient.get<DeploymentResponse>(`/deployments/${id}`);
  return response.data;
};

export const triggerDeployment = async (payload: TriggerDeploymentPayload): Promise<DeploymentResponse> => {
  const response = await apiClient.post<DeploymentResponse>('/deployments', payload);
  return response.data;
};

export const getApprovedChanges = async (): Promise<TerraformChange[]> => {
  // Fetch all changes and filter by APPROVED status
  const response = await apiClient.get<TerraformChange[]>('/terraform/changes');
  return response.data.filter((c) => c.status === 'APPROVED');
};
