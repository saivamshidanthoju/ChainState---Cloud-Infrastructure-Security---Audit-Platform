import React, { useState, useEffect } from 'react';
import { 
  GitPullRequest, 
  Play, 
  Send, 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  FileCode, 
  Lock, 
  Unlock,
  Trash2,
  Eye,
  X
} from 'lucide-react';
import { 
  analyzeTerraformCode, 
  submitTerraformChange, 
  fetchTerraformChanges, 
  fetchChangeDetail,
  TerraformPlanSummary, 
  TerraformChangeItem 
} from '../services/terraform';
import { SecurityFinding } from '../types';

const TEMPLATES: Record<string, { label: string; code: string; message: string }> = {
  insecure_sg: {
    label: "Insecure SG: Open SSH Port 22 (HIGH Risk)",
    message: "Add bastion host security group for external access",
    code: `resource "aws_security_group" "bastion_ingress" {
  name        = "bastion-external-sg"
  description = "Allows direct SSH administrative access"
  vpc_id      = "vpc-09823412"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}`
  },
  safe_s3: {
    label: "Safe S3: KMS Encrypted & Public Blocked (LOW Risk)",
    message: "Provision hardened audit logs archive bucket with default KMS",
    code: `resource "aws_s3_bucket" "audit_bucket" {
  bucket = "chainstate-audit-archive-us-east-1"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit_enc" {
  bucket = aws_s3_bucket.audit_bucket.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "block_public" {
  bucket                  = aws_s3_bucket.audit_bucket.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}`
  },
  wildcard_iam: {
    label: "Wildcard IAM: Overly Permissive Admin (CRITICAL Risk)",
    message: "Create administrative service account IAM policy",
    code: `resource "aws_iam_policy" "wildcard_admin" {
  name        = "overly-permissive-admin-policy"
  description = "Dangerous wildcard admin permissions policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "*"
        Resource = "*"
      }
    ]
  })
}`
  },
  destructive_rds: {
    label: "Destructive RDS: Force Destroy & No Protection (HIGH Risk)",
    message: "Decommission deprecated reporting database instance",
    code: `resource "aws_db_instance" "reporting_database" {
  allocated_storage   = 100
  engine              = "postgres"
  instance_class      = "db.t3.medium"
  db_name             = "reporting_db"
  force_destroy       = true
  deletion_protection = false
}`
  }
};

export const TerraformChangesPage: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("insecure_sg");
  const [tfCode, setTfCode] = useState<string>(TEMPLATES["insecure_sg"].code);
  const [commitMessage, setCommitMessage] = useState<string>(TEMPLATES["insecure_sg"].message);
  const [repository, setRepository] = useState<string>("chainstate/infra-core");
  const [branch, setBranch] = useState<string>("feat/ingress-update");

  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<TerraformPlanSummary | null>(null);

  const [changesList, setChangesList] = useState<TerraformChangeItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Detail Modal
  const [selectedDetail, setSelectedDetail] = useState<{
    change: TerraformChangeItem;
    summary: TerraformPlanSummary;
    findings: SecurityFinding[];
  } | null>(null);

  const loadChanges = async () => {
    try {
      setLoadingList(true);
      const data = await fetchTerraformChanges();
      setChangesList(data);
    } catch (err) {
      console.error("Failed to load changes:", err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadChanges();
  }, []);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    setSelectedTemplate(key);
    if (TEMPLATES[key]) {
      setTfCode(TEMPLATES[key].code);
      setCommitMessage(TEMPLATES[key].message);
      setAnalysisResult(null);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await analyzeTerraformCode(tfCode);
      setAnalysisResult(res);
    } catch (err: any) {
      alert("Analysis failed: " + (err?.response?.data?.detail || err.message));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmitChange = async () => {
    setSubmitting(true);
    try {
      const res = await submitTerraformChange({
        repository,
        branch,
        message: commitMessage,
        raw_content: tfCode,
        files_changed: ["main.tf"]
      });
      alert(`Terraform Change ${res.change_id} submitted to governance pipeline! Status: ${res.status}`);
      await loadChanges();
    } catch (err: any) {
      alert("Submission error: " + (err?.response?.data?.detail || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleInspect = async (id: string) => {
    try {
      const detail = await fetchChangeDetail(id);
      setSelectedDetail(detail);
    } catch (err) {
      alert("Failed to fetch change details");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DEPLOYED':
        return <span className="badge badge-low"><CheckCircle size={12} /> Deployed</span>;
      case 'APPROVAL_REQUIRED':
        return <span className="badge badge-high"><AlertTriangle size={12} /> Approval Required</span>;
      case 'APPROVED':
        return <span className="badge badge-low"><CheckCircle size={12} /> Approved</span>;
      case 'BLOCKED':
        return <span className="badge badge-critical"><ShieldAlert size={12} /> Blocked</span>;
      default:
        return <span className="badge badge-medium">{status}</span>;
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Terraform Change Management</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Parse, validate, and govern Infrastructure-as-Code changes before cloud deployment.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Left Column: Code Ingestion Form */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <FileCode size={18} color="var(--accent-cyan)" />
              Terraform Configuration Source (.tf)
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Load Preset:</span>
              <select 
                className="form-select" 
                style={{ width: 'auto', fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                value={selectedTemplate}
                onChange={handleTemplateChange}
              >
                {Object.entries(TEMPLATES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Commit Description / Rationale</label>
            <input 
              type="text" 
              className="form-input" 
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Describe the infrastructure change..."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label className="form-label">Repository</label>
              <input 
                type="text" 
                className="form-input" 
                value={repository}
                onChange={(e) => setRepository(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Target Branch</label>
              <input 
                type="text" 
                className="form-input" 
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">HCL Source Code</label>
            <textarea
              className="form-textarea font-mono"
              rows={12}
              style={{ fontSize: '0.85rem', lineHeight: 1.4 }}
              value={tfCode}
              onChange={(e) => setTfCode(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              <Play size={16} />
              <span>{analyzing ? 'Analyzing AST...' : 'Analyze IaC Plan'}</span>
            </button>
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={handleSubmitChange}
              disabled={submitting}
            >
              <Send size={16} />
              <span>{submitting ? 'Submitting...' : 'Submit to Governance Pipeline'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Live Plan Inspector Preview */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <GitPullRequest size={18} color="var(--accent-blue)" />
              Extracted Resource Plan Signals
            </h3>
            {analysisResult && (
              <span className="badge badge-low">
                {analysisResult.total_resources} Resources Detected
              </span>
            )}
          </div>

          {analysisResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>To Add</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--risk-low)' }}>+{analysisResult.to_add}</div>
                </div>
                <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>To Change</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--risk-medium)' }}>~{analysisResult.to_change}</div>
                </div>
                <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>To Destroy</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--risk-critical)' }}>-{analysisResult.to_destroy}</div>
                </div>
              </div>

              {analysisResult.is_destructive && (
                <div style={{ background: 'var(--risk-critical-bg)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.75rem', borderRadius: '8px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <Trash2 size={18} color="var(--risk-critical)" />
                  <span style={{ fontSize: '0.85rem', color: 'var(--risk-critical)', fontWeight: 600 }}>
                    Caution: Destructive action detected!
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
                {analysisResult.resources.map((r, i) => (
                  <div 
                    key={i} 
                    style={{ 
                      background: 'rgba(30, 41, 59, 0.5)', 
                      border: '1px solid var(--border-subtle)', 
                      borderRadius: '8px', 
                      padding: '0.85rem' 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
                        {r.resource_type}.{r.resource_name}
                      </span>
                      <span className="badge badge-medium" style={{ fontSize: '0.7rem' }}>
                        {r.action}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                      {r.public_access ? (
                        <span className="badge badge-high" style={{ fontSize: '0.7rem' }}>
                          <Unlock size={10} /> Public Ingress
                        </span>
                      ) : (
                        <span className="badge badge-low" style={{ fontSize: '0.7rem' }}>
                          <Lock size={10} /> Private
                        </span>
                      )}

                      {r.encryption_enabled ? (
                        <span className="badge badge-low" style={{ fontSize: '0.7rem' }}>
                          <CheckCircle size={10} /> Encrypted
                        </span>
                      ) : (
                        <span className="badge badge-medium" style={{ fontSize: '0.7rem' }}>
                          No SSE Confirmed
                        </span>
                      )}

                      {r.exposed_ports.length > 0 && (
                        <span className="badge badge-high" style={{ fontSize: '0.7rem' }}>
                          Ports: {r.exposed_ports.join(', ')}
                        </span>
                      )}

                      {r.cidr_ranges.length > 0 && (
                        <span className="badge badge-medium" style={{ fontSize: '0.7rem' }}>
                          CIDR: {r.cidr_ranges.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Play size={32} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
              <p style={{ fontSize: '0.9rem' }}>Click <strong>"Analyze IaC Plan"</strong> to parse and extract resource security metadata in real time.</p>
            </div>
          )}
        </div>
      </div>

      {/* Governed Changes History Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <GitPullRequest size={18} color="var(--accent-cyan)" />
            Governed Infrastructure Changes Directory
          </h3>
          <button 
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
            onClick={loadChanges}
          >
            Refresh Records
          </button>
        </div>

        {loadingList ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading changes...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Change ID</th>
                  <th>Commit Description</th>
                  <th>Author</th>
                  <th>Resources</th>
                  <th>Risk Level</th>
                  <th>Governance Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {changesList.map((chg) => (
                  <tr key={chg.id}>
                    <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{chg.change_id}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{chg.message}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {chg.repository} ({chg.branch})
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{chg.author}</td>
                    <td>{chg.resource_count} resources</td>
                    <td>
                      {chg.risk_level === 'HIGH' && <span className="badge badge-high">HIGH</span>}
                      {chg.risk_level === 'CRITICAL' && <span className="badge badge-critical">CRITICAL</span>}
                      {chg.risk_level === 'MEDIUM' && <span className="badge badge-medium">MEDIUM</span>}
                      {chg.risk_level === 'LOW' && <span className="badge badge-low">LOW</span>}
                      {!chg.risk_level && <span className="badge badge-medium">PENDING</span>}
                    </td>
                    <td>{getStatusBadge(chg.status)}</td>
                    <td>
                      <button 
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => handleInspect(chg.id)}
                      >
                        <Eye size={12} />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Change Detail Modal */}
      {selectedDetail && (
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
          padding: '1.5rem'
        }}>
          <div className="card" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button 
              onClick={() => setSelectedDetail(null)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--accent-cyan)' }}>
              {selectedDetail.change.change_id} Details
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
              {selectedDetail.change.message}
            </p>

            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              Security Findings ({selectedDetail.findings.length})
            </h4>
            {selectedDetail.findings.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {selectedDetail.findings.map((f, i) => (
                  <div key={i} style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--risk-high)', fontSize: '0.85rem' }}>{f.check_id}</span>
                      <span className={`badge badge-${f.severity.toLowerCase()}`}>{f.severity}</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', marginBottom: '0.4rem' }}>{f.message}</p>
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.1)', padding: '0.4rem', borderRadius: '6px' }}>
                      <strong>Remediation:</strong> {f.remediation}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--risk-low)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                ✓ No policy violations detected for this configuration.
              </p>
            )}

            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem' }}>HCL Configuration</h4>
            <pre className="font-mono" style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', fontSize: '0.8rem', overflowX: 'auto', border: '1px solid var(--border-subtle)' }}>
              {selectedDetail.change.raw_content || '// Structured plan JSON attached'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
