import { apiClient } from './api';
import { RiskAssessment } from '../types';

export interface ModelInfo {
  model_type: string;
  features: string[];
  classes: string[];
  validation_accuracy: number;
  feature_importances: Record<string, number>;
  is_demo: boolean;
  notice: string;
}

export const fetchModelInfo = async (): Promise<ModelInfo> => {
  const response = await apiClient.get<ModelInfo>('/risk/model/info');
  return response.data;
};

export const fetchChangeRisk = async (changeId: string): Promise<RiskAssessment> => {
  const response = await apiClient.get<RiskAssessment>(`/risk/${changeId}`);
  return response.data;
};

export const evaluateRisk = async (rawContent?: string, planJson?: any): Promise<RiskAssessment> => {
  const response = await apiClient.post<RiskAssessment>('/risk/analyze', {
    raw_content: rawContent,
    plan_json: planJson,
  });
  return response.data;
};
