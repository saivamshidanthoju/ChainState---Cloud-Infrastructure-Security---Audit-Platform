import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ShieldAlert, 
  History, 
  ShieldCheck, 
  Lock, 
  UserCheck, 
  X
} from 'lucide-react';
import { 
  fetchPendingApprovals, 
  fetchApprovalHistory, 
  submitApproval, 
  PendingApprovalItem 
} from '../services/approvals';
import { ApprovalRecord, ApprovalDecision } from '../types';

export const ApprovalsPage: React.FC = () => {
  const { user, role, switchRole } = useAuth();
  const [pendingList, setPendingList] = useState<PendingApprovalItem[]>([]);
  const [historyList, setHistoryList] = useState<ApprovalRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [loading, setLoading] = useState(true);

  // Review Modal State
  const [selectedChange, setSelectedChange] = useState<PendingApprovalItem | null>(null);
  const [decision, setDecision] = useState<ApprovalDecision>('APPROVED');
  const [comments, setComments] = useState<string>('');
  const [overrideRationale, setOverrideRationale] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [pendingData, historyData] = await Promise.all([
        fetchPendingApprovals(),
        fetchApprovalHistory()
      ]);
      setPendingList(pendingData);
      setHistoryList(historyData);
    } catch (err) {
      console.error("Error loading approvals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openReviewModal = (item: PendingApprovalItem) => {
    setSelectedChange(item);
    setDecision('APPROVED');
    setComments('');
    setOverrideRationale('');
    setErrorMsg('');
  };

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChange) return;
    setErrorMsg('');
    setSubmitting(true);

    try {
      await submitApproval({
        change_id: selectedChange.change_id,
        decision,
        comments,
        override_rationale: overrideRationale || undefined
      });
      setSelectedChange(null);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to submit approval decision');
    } finally {
      setSubmitting(false);
    }
  };

  const isDev = role === 'Developer';
  const isCritical = selectedChange?.risk_level === 'CRITICAL';
  const canApproveCritical = role === 'Approver' || role === 'Administrator';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Role-Based Change Approval Gate</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Enforce mandatory human security governance before Terraform changes can apply to AWS.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem' }}
            onClick={() => setActiveTab('pending')}
          >
            <ShieldAlert size={16} />
            <span>Pending Review Queue ({pendingList.length})</span>
          </button>
          <button 
            className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem' }}
            onClick={() => setActiveTab('history')}
          >
            <History size={16} />
            <span>Decision Audit History ({historyList.length})</span>
          </button>
        </div>
      </div>

      {/* RBAC Active Role Notice */}
      <div 
        className="card" 
        style={{ 
          marginBottom: '1.5rem', 
          background: isDev ? 'rgba(239, 68, 68, 0.08)' : 'rgba(6, 182, 212, 0.08)',
          borderColor: isDev ? 'rgba(239, 68, 68, 0.3)' : 'rgba(6, 182, 212, 0.3)',
          padding: '1rem 1.25rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <UserCheck size={20} color={isDev ? 'var(--risk-critical)' : 'var(--accent-cyan)'} />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: isDev ? 'var(--risk-critical)' : 'var(--accent-cyan)' }}>
                Active Governance Persona: {user?.full_name} ({role})
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {isDev 
                  ? "Developers have read-only access to approvals. To approve or reject changes, switch to 'Security Reviewer' or 'Approver'."
                  : role === 'Security Reviewer'
                  ? "Authorized to review, approve, and reject LOW, MEDIUM, and HIGH risk changes."
                  : "Authorized to approve all changes, including granting executive overrides for CRITICAL infrastructure."
                }
              </p>
            </div>
          </div>

          {isDev && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }}
                onClick={() => switchRole('Security Reviewer')}
              >
                Switch to Security Reviewer
              </button>
              <button 
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', borderColor: 'var(--risk-low)', color: 'var(--risk-low)' }}
                onClick={() => switchRole('Approver')}
              >
                Switch to Approver
              </button>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'pending' ? (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Lock size={18} color="var(--accent-cyan)" />
              Changes Requiring Explicit Security Sign-Off
            </h3>
            <button 
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
              onClick={loadData}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading pending queue...</div>
          ) : pendingList.length === 0 ? (
            <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ShieldCheck size={40} color="var(--risk-low)" style={{ margin: '0 auto 1rem' }} />
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.35rem' }}>No Pending Approvals</h4>
              <p style={{ fontSize: '0.85rem' }}>All submitted infrastructure changes have been reviewed and approved.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pendingList.map((item) => (
                <div 
                  key={item.id}
                  style={{
                    background: 'rgba(30, 41, 59, 0.4)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--accent-cyan)' }}>
                        {item.change_id}
                      </span>
                      <span className={`badge badge-${(item.risk_level || 'MEDIUM').toLowerCase()}`}>
                        {item.risk_level || 'MEDIUM'} RISK
                      </span>
                      {item.is_destructive && (
                        <span className="badge badge-critical" style={{ fontSize: '0.7rem' }}>
                          Destructive
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button 
                        className="btn btn-primary"
                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
                        onClick={() => openReviewModal(item)}
                        disabled={isDev}
                        title={isDev ? "Developers cannot approve changes" : "Review and submit approval"}
                      >
                        <UserCheck size={14} />
                        <span>Review & Decide</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.message}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {item.repository} ({item.branch}) • Authored by {item.author}
                    </div>
                  </div>

                  {item.findings.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Policy Flags:</span>
                      {item.findings.map((f, idx) => (
                        <span key={idx} className="badge badge-medium" style={{ fontSize: '0.7rem' }}>
                          {f.check_id}: {(f.title || f.message || 'Finding').substring(0, 45)}...
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Decision History Tab */
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <History size={18} color="var(--accent-cyan)" />
              Governance Sign-Off Audit Trail
            </h3>
            <span className="badge badge-low">Tamper-Evident SHA-256 Logged</span>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Change ID</th>
                  <th>Decision</th>
                  <th>Reviewer</th>
                  <th>Role</th>
                  <th>Reviewer Comments & Rationale</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {historyList.map((rec) => (
                  <tr key={rec.id}>
                    <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{rec.change_id}</td>
                    <td>
                      {rec.decision === 'APPROVED' ? (
                        <span className="badge badge-low"><CheckCircle2 size={12} /> Approved</span>
                      ) : (
                        <span className="badge badge-critical"><XCircle size={12} /> {rec.decision}</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 500 }}>{rec.reviewer_name}</td>
                    <td>
                      <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                        {rec.reviewer_role || rec.role || 'Reviewer'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{rec.comments}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(rec.created_at || rec.timestamp || Date.now()).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Decision Submission Modal */}
      {selectedChange && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: '560px', width: '100%', position: 'relative', border: '1px solid var(--border-accent)' }}>
            <button 
              onClick={() => setSelectedChange(null)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div className="logo-badge">
                <UserCheck size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                  Review Decision: {selectedChange.change_id}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Signing off as: <strong>{user?.full_name}</strong> ({role})
                </p>
              </div>
            </div>

            {errorMsg && (
              <div style={{
                background: 'var(--risk-critical-bg)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: 'var(--risk-critical)',
                padding: '0.75rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem'
              }}>
                <AlertTriangle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {isCritical && (
              <div style={{
                background: 'var(--risk-critical-bg)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                padding: '0.75rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.8rem'
              }}>
                <div style={{ fontWeight: 700, color: 'var(--risk-critical)', textTransform: 'uppercase' }}>
                  ⚠️ CRITICAL RISK WARNING
                </div>
                <p style={{ color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  This change contains critical security policy violations. Approving this change requires role <strong>Approver</strong> or <strong>Administrator</strong> and an explicit executive override justification.
                </p>
              </div>
            )}

            <form onSubmit={handleDecisionSubmit}>
              <div className="form-group">
                <label className="form-label">Governance Decision</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input 
                      type="radio" 
                      name="decision" 
                      value="APPROVED" 
                      checked={decision === 'APPROVED'}
                      onChange={() => setDecision('APPROVED')}
                    />
                    <span style={{ color: 'var(--risk-low)', fontWeight: 600 }}>Approve Change</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input 
                      type="radio" 
                      name="decision" 
                      value="REJECTED" 
                      checked={decision === 'REJECTED'}
                      onChange={() => setDecision('REJECTED')}
                    />
                    <span style={{ color: 'var(--risk-critical)', fontWeight: 600 }}>Reject / Block Change</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reviewer Comments & Technical Rationale</label>
                <textarea 
                  className="form-textarea"
                  rows={4}
                  placeholder="Provide technical evaluation, justification, or required remediation..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  required
                />
              </div>

              {isCritical && decision === 'APPROVED' && (
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--risk-critical)' }}>
                    Executive Override Justification (Mandatory)
                  </label>
                  <input 
                    type="text"
                    className="form-input"
                    style={{ borderColor: 'var(--risk-critical)' }}
                    placeholder="E.g., Authorized disaster recovery emergency ticket SEC-9912 by VP Eng"
                    value={overrideRationale}
                    onChange={(e) => setOverrideRationale(e.target.value)}
                    required
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setSelectedChange(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={decision === 'APPROVED' ? 'btn btn-primary' : 'btn btn-danger'}
                  disabled={submitting || (isCritical && decision === 'APPROVED' && !canApproveCritical)}
                >
                  {submitting ? 'Recording on Ledger...' : `Confirm ${decision}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
