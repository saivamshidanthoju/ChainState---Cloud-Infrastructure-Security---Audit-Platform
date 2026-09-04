import React, { useEffect, useState } from 'react';
import { WorkflowPipeline } from '../components/WorkflowPipeline';
import { 
  Activity, 
  ShieldCheck,
  Server,
  AlertTriangle
} from 'lucide-react';
import { getHealth, getDashboardSummary } from '../services/api';
import { DashboardSummary } from '../types';

export const DashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sumRes, healthRes] = await Promise.all([
          getDashboardSummary(),
          getHealth()
        ]);
        setSummary(sumRes);
        setHealth(healthRes);
      } catch (err) {
        console.warn('Backend connecting or starting up:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      {/* Workflow Visual Pipeline */}
      <WorkflowPipeline currentStage={3} />

      {/* Platform Status Alert */}
      <div 
        className="card" 
        style={{ 
          marginBottom: '2rem', 
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(15, 23, 42, 0.9))',
          borderColor: 'rgba(6, 182, 212, 0.3)' 
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'rgba(6, 182, 212, 0.2)', padding: '0.75rem', borderRadius: '10px' }}>
              <Server size={24} color="var(--accent-cyan)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>ChainState Platform Environment</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {loading ? 'Initializing telemetry...' : (health?.integrations?.aws || 'DEMO Mode Active')} • Hyperledger Fabric Smart Contract Adapter Online
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span className="badge badge-low">
              <ShieldCheck size={14} /> Backend Healthy
            </span>
            <span className="badge badge-medium">
              <AlertTriangle size={14} /> DEMO Mode
            </span>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-title">Terraform Changes</div>
          <div className="metric-value">{summary?.total_changes ?? 0}</div>
          <div className="metric-subtitle">Governed IaC proposals</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">Pending Approvals</div>
          <div className="metric-value" style={{ color: 'var(--risk-medium)' }}>
            {summary?.pending_approvals ?? 0}
          </div>
          <div className="metric-subtitle">Awaiting security sign-off</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">High/Critical Risks</div>
          <div className="metric-value" style={{ color: 'var(--risk-critical)' }}>
            {summary?.high_critical_risks ?? 0}
          </div>
          <div className="metric-subtitle">AI & Checkov identified</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">AWS Deployments</div>
          <div className="metric-value" style={{ color: 'var(--accent-cyan)' }}>
            {summary?.successful_deployments ?? 0}
          </div>
          <div className="metric-subtitle">Verified cloud provisions</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">Drift Events</div>
          <div className="metric-value" style={{ color: 'var(--risk-high)' }}>
            {summary?.drift_events ?? 0}
          </div>
          <div className="metric-subtitle">Out-of-band AWS anomalies</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">Audit Records</div>
          <div className="metric-value">{summary?.audit_records ?? 0}</div>
          <div className="metric-subtitle">SHA-256 Fabric ledger events</div>
        </div>
      </div>

      {/* Recent Activity Stub / Instructions */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Activity size={18} color="var(--accent-cyan)" />
            Next Governance Step: Phase 2 Database & Authentication
          </h3>
          <span className="badge badge-low">Phase 1 Foundation Active</span>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          FastAPI backend, React 18 TypeScript dashboard shell, and full project structure are initialized.
          The complete 12-phase pipeline is being built incrementally.
        </p>
      </div>
    </div>
  );
};
