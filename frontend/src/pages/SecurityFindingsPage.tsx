import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  BookOpen, 
  ListFilter,
  CheckCircle
} from 'lucide-react';
import { fetchAllFindings, fetchSecurityRules, SecurityRule } from '../services/terraform';
import { SecurityFinding, SeverityLevel } from '../types';

export const SecurityFindingsPage: React.FC = () => {
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [rules, setRules] = useState<SecurityRule[]>([]);
  const [activeTab, setActiveTab] = useState<'findings' | 'rules'>('findings');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [findingsData, rulesData] = await Promise.all([
        fetchAllFindings(selectedSeverity),
        fetchSecurityRules()
      ]);
      setFindings(findingsData);
      setRules(rulesData.rules);
    } catch (err) {
      console.error("Failed to load security findings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedSeverity]);

  const totalViolations = findings.filter(f => !f.passed).length;
  const criticalCount = findings.filter(f => !f.passed && f.severity === 'CRITICAL').length;
  const highCount = findings.filter(f => !f.passed && f.severity === 'HIGH').length;

  const getSeverityBadge = (severity: SeverityLevel) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="badge badge-critical">CRITICAL</span>;
      case 'HIGH':
        return <span className="badge badge-high">HIGH</span>;
      case 'MEDIUM':
        return <span className="badge badge-medium">MEDIUM</span>;
      case 'LOW':
        return <span className="badge badge-low">LOW</span>;
      default:
        return <span className="badge badge-medium">{severity}</span>;
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Security Scanning & Findings</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Checkov static analysis and built-in CIS AWS benchmark compliance engine.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className={`btn ${activeTab === 'findings' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem' }}
            onClick={() => setActiveTab('findings')}
          >
            <ShieldAlert size={16} />
            <span>Violations & Findings ({totalViolations})</span>
          </button>
          <button 
            className={`btn ${activeTab === 'rules' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem' }}
            onClick={() => setActiveTab('rules')}
          >
            <BookOpen size={16} />
            <span>Active CIS Rules ({rules.length})</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-title">Total Active Findings</div>
          <div className="metric-value">{totalViolations}</div>
          <div className="metric-subtitle">Across governed Terraform changes</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">Critical Severity</div>
          <div className="metric-value" style={{ color: 'var(--risk-critical)' }}>{criticalCount}</div>
          <div className="metric-subtitle">Wildcard IAM & unrestricted ports</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">High Severity</div>
          <div className="metric-value" style={{ color: 'var(--risk-high)' }}>{highCount}</div>
          <div className="metric-subtitle">Public SSH (22) & Public S3 buckets</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">Rules Enforced</div>
          <div className="metric-value" style={{ color: 'var(--accent-cyan)' }}>{rules.length}</div>
          <div className="metric-subtitle">Checkov CLI + CIS Rules Engine</div>
        </div>
      </div>

      {activeTab === 'findings' ? (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <ListFilter size={18} color="var(--accent-cyan)" />
              Detected Security Policy Violations
            </h3>

            {/* Severity Filter Chips */}
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
                <button
                  key={sev}
                  className={`btn btn-secondary ${selectedSeverity === sev ? 'active' : ''}`}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.3rem 0.65rem',
                    borderColor: selectedSeverity === sev ? 'var(--accent-cyan)' : undefined,
                    color: selectedSeverity === sev ? 'var(--accent-cyan)' : undefined
                  }}
                  onClick={() => setSelectedSeverity(sev)}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Scanning database...</div>
          ) : findings.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <CheckCircle size={36} color="var(--risk-low)" style={{ margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No security violations in this category</p>
              <p style={{ fontSize: '0.85rem' }}>All scanned infrastructure adheres to active baseline policies.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Check ID</th>
                    <th>Severity</th>
                    <th>Resource</th>
                    <th>Violation Details & Remediation</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.map((f, i) => (
                    <tr key={i}>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                          {f.check_id}
                        </span>
                      </td>
                      <td>{getSeverityBadge(f.severity)}</td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {f.resource}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{f.title}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                          {f.message}
                        </div>
                        {f.remediation && (
                          <div style={{
                            background: 'rgba(6, 182, 212, 0.08)',
                            borderLeft: '3px solid var(--accent-cyan)',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            color: 'var(--text-primary)'
                          }}>
                            <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>Remediation: </span>
                            {f.remediation}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Rules Reference View */
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <BookOpen size={18} color="var(--accent-cyan)" />
              Active Checkov & CIS Benchmark Policy Catalog
            </h3>
            <span className="badge badge-low">Engine Active</span>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Policy ID</th>
                  <th>Severity</th>
                  <th>Rule Name</th>
                  <th>Category</th>
                  <th>Compliance Benchmark</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.check_id}>
                    <td style={{ fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {r.check_id}
                    </td>
                    <td>{getSeverityBadge(r.severity as SeverityLevel)}</td>
                    <td style={{ fontWeight: 500 }}>{r.name}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{r.category}</td>
                    <td>
                      <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                        {r.benchmark}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
