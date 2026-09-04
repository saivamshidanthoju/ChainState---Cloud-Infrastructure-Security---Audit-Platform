# ChainState – Cloud Infrastructure Security & Audit Platform

> **Final-Year Major Project**  
> *A comprehensive governance, AI risk classification, security scanning, approval management, AWS provisioning, drift detection, and tamper-evident Hyperledger Fabric audit platform for Terraform-based cloud infrastructure.*

---

## 📌 Executive Summary & Project Positioning

ChainState **does not replace Terraform**; rather, it provides a resilient **governance, DevSecOps, and audit lifecycle** around Terraform.

1. **Infrastructure as Code**: Terraform remains the underlying provisioning engine.
2. **Security Static Analysis**: Automatic scanning via Checkov and built-in CIS benchmark rules.
3. **Machine Learning Risk Engine**: Scikit-Learn Random Forest Classifier scores change risk (LOW, MEDIUM, HIGH, CRITICAL).
4. **Role-Based Governance**: Policy gates mandate explicit approvals for HIGH/CRITICAL changes.
5. **Cloud Deployment & Drift**: Safely orchestrates AWS deployments and detects out-of-band drift.
6. **Immutable Audit Trail**: Canonical JSON payloads with SHA-256 digests anchored into Hyperledger Fabric smart contracts.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Enterprise CSS Design System, Lucide Icons |
| **Backend** | Python 3.14 / 3.11, FastAPI, Pydantic v2, SQLAlchemy, Alembic, Uvicorn |
| **Database** | PostgreSQL (Production/Docker) / SQLite (Local Zero-Config Demo) |
| **AI / ML** | Python, Scikit-Learn, Random Forest Classifier, Joblib |
| **Security** | Checkov CLI, Static HCL/JSON Plan Analyzers, CIS Security Rules |
| **Cloud & IaC**| Terraform, AWS Boto3 SDK |
| **Blockchain** | Hyperledger Fabric, Go Smart Contracts (`fabric-contract-api-go`), Fabric Gateway |
| **DevSecOps** | GitHub Actions CI/CD Pipeline, Docker, Docker Compose |

---

## 🚀 Quick Start (Local Demo Mode)

ChainState includes a native **DEMO Mode** allowing complete end-to-end evaluation without requiring active AWS accounts, running Fabric networks, or external databases.

### 1. Prerequisites
- Python 3.10+ (Tested on Python 3.14)
- Node.js 18+ (Tested on Node.js v24)
- Git

### 2. Backend Setup
```bash
# Navigate to project root
cd "ChainState – Cloud Infrastructure Security & Audit Platform"

# Activate virtual environment
backend\.venv\Scripts\activate

# Install dependencies (already completed in workspace)
pip install -r backend/requirements.txt

# Run FastAPI backend
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```
Backend API will be available at: `http://localhost:8000`  
Interactive Swagger Docs: `http://localhost:8000/docs`

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend Dashboard will be available at: `http://localhost:5173`

---

## 🔄 DEMO Mode vs. REAL Mode

| Component | DEMO Mode (`DEMO_MODE=true`) | REAL Mode (`DEMO_MODE=false`) |
|---|---|---|
| **AWS Deployment** | Realistic AWS resource simulation with ARN generation & latency modeling | Real AWS provisioning via Boto3 and Terraform CLI using AWS IAM credentials |
| **Security Scanner**| Checks using Checkov if installed, plus comprehensive built-in rule engine | Full Checkov CLI execution against complete plan HCL/JSON |
| **AI Risk Engine** | Scikit-Learn Random Forest model trained on structured synthetic baseline | Production-trained model with live feedback loop |
| **Hyperledger Fabric**| Generates deterministic transaction IDs and mock commit blocks labeled `DEMO` | Connects to Fabric Peer/Orderer network via Fabric Gateway and mTLS |
| **Database** | SQLite file `chainstate.db` for zero-install instant operation | PostgreSQL multi-container instance via Docker Compose |

---

## 📋 Implementation Roadmap

- [x] **Phase 1: Project Scaffolding & Health Foundations** (FastAPI, React 18, Design System, Health checks)
- [ ] **Phase 2: Database Models, Alembic & RBAC Authentication**
- [ ] **Phase 3: Terraform Analysis & Security Scanning (Checkov + Rules)**
- [ ] **Phase 4: Machine Learning Risk Engine (Random Forest)**
- [ ] **Phase 5: Role-Based Approval Workflow**
- [ ] **Phase 6: Deployment Service & AWS Orchestration**
- [ ] **Phase 7: Post-Deployment Drift Detection**
- [ ] **Phase 8: SHA-256 Tamper-Evident Audit System**
- [ ] **Phase 9: Hyperledger Fabric Adapter & Go Smart Contract**
- [ ] **Phase 10: GitHub Actions CI/CD Integration**
- [ ] **Phase 11: Complete Enterprise Dashboard UI**
- [ ] **Phase 12: Comprehensive Testing & Project Documentation**
