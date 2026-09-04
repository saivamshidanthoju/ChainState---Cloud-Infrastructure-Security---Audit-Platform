import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardPage } from './pages/DashboardPage';
import { TerraformChangesPage } from './pages/TerraformChangesPage';
import { SecurityFindingsPage } from './pages/SecurityFindingsPage';
import { RiskAnalysisPage } from './pages/RiskAnalysisPage';

export const App: React.FC = () => {
  const [demoMode] = useState(true);

  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-container">
          <Sidebar demoMode={demoMode} />
          <div className="main-wrapper">
            <TopBar title="Infrastructure Security & Audit Platform" />
            <main className="content-body">
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/changes" element={<TerraformChangesPage />} />
                <Route path="/security" element={<SecurityFindingsPage />} />
                <Route path="/risk" element={<RiskAnalysisPage />} />
                <Route 
                  path="/approvals" 
                  element={
                    <div className="card">
                      <h2 style={{ marginBottom: '1rem' }}>Approvals Gate</h2>
                      <p style={{ color: 'var(--text-secondary)' }}>Role-based change governance approval queue (Phase 5).</p>
                    </div>
                  } 
                />
                <Route 
                  path="/deployments" 
                  element={
                    <div className="card">
                      <h2 style={{ marginBottom: '1rem' }}>AWS Deployments</h2>
                      <p style={{ color: 'var(--text-secondary)' }}>AWS deployment orchestration and execution tracking (Phase 6).</p>
                    </div>
                  } 
                />
                <Route 
                  path="/drift" 
                  element={
                    <div className="card">
                      <h2 style={{ marginBottom: '1rem' }}>Drift Detection</h2>
                      <p style={{ color: 'var(--text-secondary)' }}>Infrastructure state discrepancy detection (Phase 7).</p>
                    </div>
                  } 
                />
                <Route 
                  path="/audit" 
                  element={
                    <div className="card">
                      <h2 style={{ marginBottom: '1rem' }}>Audit Ledger</h2>
                      <p style={{ color: 'var(--text-secondary)' }}>Tamper-evident SHA-256 and Hyperledger Fabric audit trails (Phases 8 & 9).</p>
                    </div>
                  } 
                />
                <Route 
                  path="/settings" 
                  element={
                    <div className="card">
                      <h2 style={{ marginBottom: '1rem' }}>Settings</h2>
                      <p style={{ color: 'var(--text-secondary)' }}>Environment toggles, AWS credentials, and Fabric connection profiles.</p>
                    </div>
                  } 
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
