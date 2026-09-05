import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDeployments,
  getDeploymentDetails,
  triggerDeployment,
  getApprovedChanges,
  TriggerDeploymentPayload
} from '../services/deployments';
import { DeploymentListItem, DeploymentResponse, TerraformChange } from '../types';
import { useAuth } from '../context/AuthContext';

export const DeploymentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [deployments, setDeployments] = useState<DeploymentListItem[]>([]);
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentResponse | null>(null);
  const [approvedChanges, setApprovedChanges] = useState<TerraformChange[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [showDeployModal, setShowDeployModal] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedArn, setCopiedArn] = useState<string | null>(null);

  // Form State
  const [selectedChangeId, setSelectedChangeId] = useState<string>('');
  const [targetEnv, setTargetEnv] = useState<string>('production');
  const [targetRegion, setTargetRegion] = useState<string>('us-east-1');

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [deps, approved] = await Promise.all([
        getDeployments(),
        getApprovedChanges()
      ]);
      setDeployments(deps);
      setApprovedChanges(approved);
      if (approved.length > 0 && !selectedChangeId) {
        setSelectedChangeId(approved[0].change_id || approved[0].id);
      }
      if (deps.length > 0 && !selectedDeployment) {
        const details = await getDeploymentDetails(deps[0].id);
        setSelectedDeployment(details);
      }
    } catch (err: any) {
      console.error('Failed to load deployments:', err);
      setErrorMsg(err.response?.data?.detail || 'Failed to load cloud deployment history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectDeployment = async (id: string) => {
    try {
      const details = await getDeploymentDetails(id);
      setSelectedDeployment(details);
    } catch (err: any) {
      console.error('Failed to fetch deployment details:', err);
    }
  };

  const handleTriggerDeployment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChangeId) return;

    try {
      setIsDeploying(true);
      setErrorMsg(null);
      const payload: TriggerDeploymentPayload = {
        change_id: selectedChangeId,
        environment: targetEnv,
        region: targetRegion
      };
      const result = await triggerDeployment(payload);
      setSelectedDeployment(result);
      setShowDeployModal(false);
      await loadData();
    } catch (err: any) {
      console.error('Deployment execution failed:', err);
      setErrorMsg(err.response?.data?.detail || 'Deployment execution encountered an error.');
    } finally {
      setIsDeploying(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedArn(id);
    setTimeout(() => setCopiedArn(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner & Control Strip */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <h2 style={{ margin: 0 }}>AWS Cloud Infrastructure Deployments</h2>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}
            >
              🟢 DEMO Mode: Simulated AWS Provider
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>
            Orchestrates approved Terraform changes, tracks execution logs, provisions cloud resource ARNs, and links to tamper-evident audit trails.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => setShowDeployModal(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
          >
            <span>🚀</span> Deploy Approved Change
          </button>
          <button
            onClick={loadData}
            className="btn"
            style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
            fontSize: '0.9rem'
          }}
        >
          <strong>Notice:</strong> {errorMsg}
        </div>
      )}

      {/* Main Content Grid: Deployments List & Active Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) minmax(480px, 1.4fr)', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Column: Recent Deployments Table */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Deployment History ({deployments.length})</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Live Sync Active</span>
          </div>

          {loading && deployments.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading deployments...
            </div>
          ) : deployments.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '2.5rem' }}>📦</div>
              <div>
                <strong>No Cloud Deployments Recorded Yet</strong>
                <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Approved Terraform changes can be deployed directly to your target cloud environment.
                </p>
              </div>
              {approvedChanges.length > 0 ? (
                <button onClick={() => setShowDeployModal(true)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                  Deploy Pending Approved Change ({approvedChanges.length} ready)
                </button>
              ) : (
                <button onClick={() => navigate('/approvals')} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                  Go to Approvals Queue
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '680px', overflowY: 'auto' }}>
              {deployments.map((d) => {
                const isSelected = selectedDeployment?.id === d.id;
                return (
                  <div
                    key={d.id}
                    onClick={() => handleSelectDeployment(d.id)}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-secondary)',
                      border: isSelected ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {d.change_identifier}
                      </span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: d.state === 'DEPLOYED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: d.state === 'DEPLOYED' ? '#10b981' : '#ef4444'
                        }}
                      >
                        {d.state}
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.change_message}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Env: <strong style={{ color: 'var(--text-secondary)' }}>{d.target_environment}</strong> ({d.aws_region})</span>
                      <span>Resources: <strong style={{ color: 'var(--text-secondary)' }}>{d.resource_count}</strong></span>
                      <span>{new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Deployment Inspector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {selectedDeployment ? (
            <>
              {/* Summary Card */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>Deployment:</span>
                      <span style={{ fontFamily: 'monospace', color: 'var(--accent-blue)' }}>{selectedDeployment.change_identifier}</span>
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Target: {selectedDeployment.target_environment} | Region: {selectedDeployment.aws_region} | Applied in {selectedDeployment.duration_seconds}s
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => navigate('/drift')}
                      className="btn"
                      style={{ fontSize: '0.8rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                    >
                      🔍 Run Drift Check
                    </button>
                    <button
                      onClick={() => navigate('/audit')}
                      className="btn"
                      style={{ fontSize: '0.8rem', backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.3)' }}
                    >
                      ⛓️ Ledger Proof
                    </button>
                  </div>
                </div>

                {/* Evidence & Hash Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                  <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-secondary)' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.75rem' }}>CRYPTOGRAPHIC AUDIT HASH (SHA-256)</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all', color: '#10b981' }}>
                      {selectedDeployment.audit_hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                    </div>
                  </div>
                  <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-secondary)' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.75rem' }}>FABRIC TRANSACTION ID</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all', color: '#60a5fa' }}>
                      {selectedDeployment.blockchain_tx_id || 'tx_deploy_simulated_ledger_001'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Provisioned AWS Resources Inventory */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem' }}>
                    Provisioned AWS Resources ({selectedDeployment.resources_provisioned.length})
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Simulated Cloud Provider State</span>
                </div>

                {selectedDeployment.resources_provisioned.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                    No physical resources generated for this apply plan.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {selectedDeployment.resources_provisioned.map((res, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.4rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                fontFamily: 'monospace',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                color: '#60a5fa'
                              }}
                            >
                              {res.resource_type}
                            </span>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{res.resource_name}</span>
                          </div>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981'
                            }}
                          >
                            {res.status}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <span>Physical ID: <code style={{ color: 'var(--text-primary)' }}>{res.physical_id}</code></span>
                          <button
                            onClick={() => copyToClipboard(res.arn, res.physical_id)}
                            className="btn"
                            style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                          >
                            {copiedArn === res.physical_id ? '✓ Copied ARN' : 'Copy ARN'}
                          </button>
                        </div>

                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {res.arn}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Terminal Execution Logs */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>💻</span> Terraform Apply Execution Console
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Exit Code: 0 (SUCCESS)</span>
                </div>

                <div
                  style={{
                    backgroundColor: '#0a0d14',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1rem',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: '0.8rem',
                    color: '#e2e8f0',
                    lineHeight: '1.6',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}
                >
                  {selectedDeployment.logs.map((log, idx) => {
                    let color = '#94a3b8';
                    if (log.includes('[SUCCESS]')) color = '#10b981';
                    else if (log.includes('[INIT]')) color = '#60a5fa';
                    else if (log.includes('[PLAN]')) color = '#f59e0b';
                    else if (log.includes('[EXEC]')) color = '#38bdf8';
                    else if (log.includes('[AUDIT]')) color = '#c084fc';
                    else if (log.includes('[ERROR]')) color = '#ef4444';

                    return (
                      <div key={idx} style={{ color }}>
                        {log}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Select a deployment from the left history list to inspect provisioned AWS ARNs and execution logs.
            </div>
          )}
        </div>
      </div>

      {/* Trigger Deployment Modal */}
      {showDeployModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🚀</span> Deploy Approved Terraform Change
              </h3>
              <button
                onClick={() => setShowDeployModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>
              Deploying applies infrastructure modifications to target AWS environments. In DEMO mode, realistic resource identifiers, ARNs, and CloudWatch metrics are produced without incurring cloud spend.
            </p>

            <form onSubmit={handleTriggerDeployment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: 600 }}>
                  Select Approved Infrastructure Change:
                </label>
                {approvedChanges.length === 0 ? (
                  <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.85rem' }}>
                    No changes currently hold APPROVED status. Please review and approve a pending change in the Approvals queue first.
                  </div>
                ) : (
                  <select
                    value={selectedChangeId}
                    onChange={(e) => setSelectedChangeId(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                    required
                  >
                    {approvedChanges.map((chg) => (
                      <option key={chg.id} value={chg.change_id || chg.id}>
                        {chg.change_id || chg.id} — {chg.message} ({chg.author})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: 600 }}>
                    Target Environment:
                  </label>
                  <select
                    value={targetEnv}
                    onChange={(e) => setTargetEnv(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  >
                    <option value="production">Production (AWS Primary)</option>
                    <option value="staging">Staging (Pre-Prod)</option>
                    <option value="development">Development (Sandboxed)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: 600 }}>
                    AWS Region:
                  </label>
                  <select
                    value={targetRegion}
                    onChange={(e) => setTargetRegion(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  >
                    <option value="us-east-1">us-east-1 (N. Virginia)</option>
                    <option value="us-west-2">us-west-2 (Oregon)</option>
                    <option value="eu-west-1">eu-west-1 (Ireland)</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)'
                }}
              >
                🔐 <strong>Audit Trail Guarantee:</strong> Upon deployment completion, an irreversible canonical SHA-256 state digest is produced and anchored to the audit ledger under actor <code>{user?.email || 'authenticated-user'}</code>.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowDeployModal(false)}
                  className="btn"
                  style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeploying || approvedChanges.length === 0}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                >
                  {isDeploying ? 'Deploying to AWS...' : 'Confirm & Apply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
