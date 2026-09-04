import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  ShieldAlert, 
  BarChart3, 
  Info, 
  ChevronRight
} from 'lucide-react';
import { fetchModelInfo, evaluateRisk, ModelInfo } from '../services/risk';
import { fetchTerraformChanges, TerraformChangeItem } from '../services/terraform';
import { RiskAssessment, RiskLevel } from '../types';

const PRESETS = [
  {
    id: "insecure_sg",
    label: "Insecure SG: Open SSH (Port 22)",
    code: `resource "aws_security_group" "bastion" {
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}`
  },
  {
    id: "safe_s3",
    label: "Safe S3 Bucket: KMS Encrypted",
    code: `resource "aws_s3_bucket" "secure_assets" {
  bucket = "chainstate-secure-lake"
}
resource "aws_s3_bucket_server_side_encryption_configuration" "enc" {
  bucket = aws_s3_bucket.secure_assets.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}`
  },
  {
    id: "wildcard_iam",
    label: "Wildcard IAM Policy: Full Admin Privileges",
    code: `resource "aws_iam_policy" "admin_wildcard" {
  policy = jsonencode({
    Statement = [{ Action = "*", Resource = "*", Effect = "Allow" }]
  })
}`
  },
  {
    id: "destructive_drop",
    label: "Destructive Change: Force Drop Production RDS",
    code: `resource "aws_db_instance" "prod_cluster" {
  force_destroy = true
  deletion_protection = false
}`
  }
];

export const RiskAnalysisPage: React.FC = () => {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [changes, setChanges] = useState<TerraformChangeItem[]>([]);
  const [selectedChangeId, setSelectedChangeId] = useState<string>('');
  const [currentAssessment, setCurrentAssessment] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const [info, changesList] = await Promise.all([
          fetchModelInfo(),
          fetchTerraformChanges()
        ]);
        setModelInfo(info);
        setChanges(changesList);

        // Run default evaluation on first preset
        const defaultRisk = await evaluateRisk(PRESETS[0].code);
        setCurrentAssessment(defaultRisk);
      } catch (err) {
        console.error("Failed to load risk model info:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleSelectPreset = async (code: string) => {
    setEvaluating(true);
    try {
      const assessment = await evaluateRisk(code);
      setCurrentAssessment(assessment);
      setSelectedChangeId('');
    } catch (err) {
      alert("Evaluation error");
    } finally {
      setEvaluating(false);
    }
  };

  const handleSelectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value;
    setSelectedChangeId(cid);
    if (!cid) return;

    setEvaluating(true);
    try {
      const chg = changes.find(c => c.id === cid || c.change_id === cid);
      if (chg && chg.raw_content) {
        const assessment = await evaluateRisk(chg.raw_content);
        setCurrentAssessment(assessment);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEvaluating(false);
    }
  };

  const getRiskColor = (level?: RiskLevel) => {
    switch (level) {
      case 'CRITICAL': return 'var(--risk-critical)';
      case 'HIGH': return 'var(--risk-high)';
      case 'MEDIUM': return 'var(--risk-medium)';
      case 'LOW': return 'var(--risk-low)';
      default: return 'var(--text-primary)';
    }
  };

  const getRiskBg = (level?: RiskLevel) => {
    switch (level) {
      case 'CRITICAL': return 'var(--risk-critical-bg)';
      case 'HIGH': return 'var(--risk-high-bg)';
      case 'MEDIUM': return 'var(--risk-medium-bg)';
      case 'LOW': return 'var(--risk-low-bg)';
      default: return 'rgba(30, 41, 59, 0.5)';
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>AI Risk Analysis & Decision Support</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Random Forest classifier evaluating multi-dimensional infrastructure change signals.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="badge badge-low">
            <Cpu size={14} /> Model Accuracy: {modelInfo ? `${(modelInfo.validation_accuracy * 100).toFixed(1)}%` : '96.2%'}
          </span>
          <span className="badge badge-medium">Prototype Model</span>
        </div>
      </div>

      {/* Mandatory Architecture & AI Positioning Disclaimer */}
      <div 
        className="card" 
        style={{ 
          marginBottom: '1.5rem', 
          background: 'rgba(245, 158, 11, 0.08)',
          borderColor: 'rgba(245, 158, 11, 0.3)',
          padding: '1rem 1.25rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <Info size={20} color="var(--risk-medium)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--risk-medium)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Architecture Notice: AI Decision Support Boundary
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.5 }}>
              The Random Forest model calculates risk scores and explainable rationale based on 8 extracted IaC signals.
              <strong> AI does NOT independently make deployment decisions.</strong> Deployment is governed by role-based approval policy gates.
            </p>
          </div>
        </div>
      </div>

      {/* Scenario / Change Selector */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Evaluate Preset Scenario:</span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                  onClick={() => handleSelectPreset(p.code)}
                  disabled={evaluating}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {changes.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Or from Change History:</span>
              <select 
                className="form-select" 
                style={{ width: 'auto', fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                value={selectedChangeId}
                onChange={handleSelectChange}
                disabled={evaluating}
              >
                <option value="">-- Select Saved Change --</option>
                {changes.map(c => (
                  <option key={c.id} value={c.id}>{c.change_id}: {c.message}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading AI risk engine...</div>
      ) : currentAssessment ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Left Column: Risk Banner, Score & Rationale */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Main Risk Card */}
            <div 
              className="card"
              style={{
                background: `linear-gradient(135deg, ${getRiskBg(currentAssessment.risk_level)}, rgba(15, 23, 42, 0.95))`,
                borderColor: getRiskColor(currentAssessment.risk_level),
                borderWidth: '1.5px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700 }}>
                    Predicted Risk Level
                  </div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, color: getRiskColor(currentAssessment.risk_level), letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    {currentAssessment.risk_level} RISK
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700 }}>
                    Continuous Score
                  </div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    {(currentAssessment.risk_score * 100).toFixed(0)}
                    <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>/100</span>
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: '8px', borderLeft: `4px solid ${getRiskColor(currentAssessment.risk_level)}` }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: getRiskColor(currentAssessment.risk_level), marginBottom: '0.2rem' }}>
                  Governance Policy Action
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {currentAssessment.recommended_action}
                </p>
              </div>
            </div>

            {/* Explainable Reasons Card */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <ShieldAlert size={18} color="var(--accent-cyan)" />
                  Explainable Decision Factors ({currentAssessment.reasons.length})
                </h3>
              </div>

              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {currentAssessment.reasons.map((r, i) => (
                  <li 
                    key={i} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: '0.6rem',
                      background: 'rgba(30, 41, 59, 0.4)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      fontSize: '0.85rem'
                    }}
                  >
                    <ChevronRight size={16} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column: 8 Feature Inputs & Feature Importances */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Feature Values Grid */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <BarChart3 size={18} color="var(--accent-blue)" />
                  Extracted 8 Core Signal Values
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Input Vector</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem' }}>
                {Object.entries(currentAssessment.features).map(([key, val]) => (
                  <div 
                    key={key} 
                    style={{ 
                      background: 'rgba(30, 41, 59, 0.4)', 
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px', 
                      padding: '0.6rem 0.75rem' 
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {key.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: val > 0 ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                      {val}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Model Feature Importance Breakdown */}
            {modelInfo && (
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <Cpu size={18} color="var(--accent-purple)" />
                    Random Forest Global Feature Importance
                  </h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {Object.entries(modelInfo.feature_importances)
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, imp]) => {
                      const pct = (imp * 100).toFixed(1);
                      return (
                        <div key={name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{name.replace(/_/g, ' ')}</span>
                            <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{pct}%</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                            <div 
                              style={{ 
                                width: `${pct}%`, 
                                height: '100%', 
                                background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-blue))',
                                borderRadius: '3px' 
                              }} 
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
