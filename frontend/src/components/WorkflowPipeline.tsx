import React from 'react';
import { 
  GitBranch, 
  FileCode, 
  ShieldCheck, 
  Cpu, 
  UserCheck, 
  Cloud, 
  Activity, 
  Link 
} from 'lucide-react';

interface WorkflowProps {
  currentStage?: number; // 0 to 7
}

export const WorkflowPipeline: React.FC<WorkflowProps> = ({ currentStage = 3 }) => {
  const steps = [
    { label: 'GitHub Push', icon: GitBranch },
    { label: 'Terraform Plan', icon: FileCode },
    { label: 'Checkov Scan', icon: ShieldCheck },
    { label: 'AI Risk Engine', icon: Cpu },
    { label: 'Approval Gate', icon: UserCheck },
    { label: 'AWS Deploy', icon: Cloud },
    { label: 'Drift Detect', icon: Activity },
    { label: 'Fabric Audit', icon: Link },
  ];

  return (
    <div className="card" style={{ marginBottom: '2rem' }}>
      <div className="card-header" style={{ marginBottom: '1rem' }}>
        <h3 className="card-title">
          <Link size={18} color="var(--accent-cyan)" />
          ChainState End-to-End Governance Lifecycle
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Automated CI/CD & Governance Pipeline
        </span>
      </div>

      <div className="workflow-stepper">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isCompleted = idx < currentStage;
          const isActive = idx === currentStage;

          return (
            <React.Fragment key={step.label}>
              <div className={`step-node ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                <div className="step-circle">
                  <Icon size={18} />
                </div>
                <div className="step-label">{step.label}</div>
              </div>
              {idx < steps.length - 1 && (
                <div 
                  className="step-connector"
                  style={{
                    backgroundColor: idx < currentStage ? 'var(--risk-low)' : 'var(--border-subtle)',
                    height: '2px'
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
