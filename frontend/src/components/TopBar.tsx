import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Bell, User as UserIcon, LogOut, LogIn, ChevronDown } from 'lucide-react';
import { LoginModal } from './LoginModal';
import { UserRole } from '../types';

interface TopBarProps {
  title: string;
}

export const TopBar: React.FC<TopBarProps> = ({ title }) => {
  const { user, role, logout, demoUsers, switchRole } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  return (
    <>
      <header className="topbar">
        <div className="topbar-title-section">
          <h1 className="page-title">{title}</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            <Shield size={16} color="var(--accent-cyan)" />
            <span>Hyperledger Fabric Audit Active</span>
          </div>

          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.4rem 0.6rem' }}
            title="Notifications"
          >
            <Bell size={16} />
          </button>

          {user ? (
            <div style={{ position: 'relative' }}>
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  cursor: 'pointer',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '8px',
                  background: 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid var(--border-subtle)'
                }}
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
              >
                <div className="user-avatar">
                  <UserIcon size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {user.full_name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                    {role}
                  </div>
                </div>
                <ChevronDown size={14} color="var(--text-muted)" />
              </div>

              {/* Quick Role Switcher Dropdown */}
              {isRoleDropdownOpen && (
                <div 
                  className="card"
                  style={{
                    position: 'absolute',
                    top: '110%',
                    right: 0,
                    width: '240px',
                    padding: '0.75rem',
                    zIndex: 50,
                    boxShadow: 'var(--shadow-lg)',
                    borderColor: 'var(--border-accent)'
                  }}
                >
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 700 }}>
                    Switch Demo Persona
                  </div>
                  {demoUsers?.roles.map((r) => (
                    <button
                      key={r.role}
                      type="button"
                      className={`btn btn-secondary ${role === r.role ? 'active' : ''}`}
                      style={{
                        width: '100%',
                        fontSize: '0.8rem',
                        justifyContent: 'flex-start',
                        padding: '0.4rem 0.6rem',
                        marginBottom: '0.25rem',
                        border: role === r.role ? '1px solid var(--accent-cyan)' : undefined,
                        color: role === r.role ? 'var(--accent-cyan)' : undefined
                      }}
                      onClick={() => {
                        switchRole(r.role as UserRole);
                        setIsRoleDropdownOpen(false);
                      }}
                    >
                      <span>{r.name}</span>
                    </button>
                  ))}

                  <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ width: '100%', fontSize: '0.8rem', color: 'var(--risk-critical)', justifyContent: 'center' }}
                      onClick={() => {
                        logout();
                        setIsRoleDropdownOpen(false);
                      }}
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              className="btn btn-primary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
              onClick={() => setIsLoginOpen(true)}
            >
              <LogIn size={16} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </>
  );
};
