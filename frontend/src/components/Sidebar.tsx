import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  GitPullRequest, 
  ShieldAlert, 
  Cpu, 
  CheckCircle2, 
  CloudUpload, 
  Activity, 
  FileText, 
  Settings as SettingsIcon,
  Layers
} from 'lucide-react';

interface SidebarProps {
  demoMode?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ demoMode = true }) => {
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/changes', label: 'Terraform Changes', icon: GitPullRequest },
    { to: '/security', label: 'Security Findings', icon: ShieldAlert },
    { to: '/risk', label: 'AI Risk Analysis', icon: Cpu },
    { to: '/approvals', label: 'Approvals Gate', icon: CheckCircle2 },
    { to: '/deployments', label: 'AWS Deployments', icon: CloudUpload },
    { to: '/drift', label: 'Drift Detection', icon: Activity },
    { to: '/audit', label: 'Audit Ledger', icon: FileText },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-badge">
          <Layers size={20} />
        </div>
        <div>
          <div className="logo-title">ChainState</div>
          <div className="logo-subtitle">Cloud Security & Audit</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              end={item.to === '/'}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="mode-badge">
          <span className="mode-dot"></span>
          <span>{demoMode ? 'DEMO MODE ACTIVE' : 'REAL INFRASTRUCTURE'}</span>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          ChainState Platform v1.0.0
        </div>
      </div>
    </aside>
  );
};
