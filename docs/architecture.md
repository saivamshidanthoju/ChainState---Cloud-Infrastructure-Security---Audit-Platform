# ChainState Architecture & System Design

ChainState is an enterprise-grade cloud infrastructure governance and audit platform. It serves as an authoritative security, risk evaluation, and tamper-evident verification layer that sits between Infrastructure-as-Code (Terraform) and target cloud environments (AWS).

```mermaid
flowchart TD
    subgraph Ingestion ["1. Infrastructure Change Ingestion"]
        GitCommit[Developer Commit / Pull Request] --> GHA[GitHub Actions CI Workflow]
        GHA --> TFPlanGen[Terraform fmt, validate, plan]
        TFPlanGen --> APIIngest[POST /api/terraform/analyze]
    end

    subgraph SecurityAnalysis ["2. Multi-Tier Security Inspection"]
        APIIngest --> CheckovEngine[Checkov Static Analysis]
        APIIngest --> RuleEngine[Built-in Security Rules Engine]
        CheckovEngine --> FindingsAgg[Normalized Security Findings]
        RuleEngine --> FindingsAgg
    end

    subgraph AIRiskEngine ["3. AI Risk Scoring Engine"]
        FindingsAgg --> FeatureExtraction[Feature Extraction: 8 Core Signals]
        FeatureExtraction --> MLModel[Random Forest Classifier]
        MLModel --> RiskScore[Risk Level: LOW | MEDIUM | HIGH | CRITICAL]
    end

    subgraph GovernanceGate ["4. Role-Based Approval Gate"]
        RiskScore --> PolicyEngine{Policy Gate}
        PolicyEngine -- LOW --> AutoApprove[Auto Approved (Demo/Policy)]
        PolicyEngine -- MEDIUM/HIGH --> RequireReview[Pending Reviewer Approval]
        PolicyEngine -- CRITICAL --> Blocked[Hard Blocked by Default]
        RequireReview --> ReviewerDecision[SecOps / Approver Decision]
    end

    subgraph CloudExecution ["5. Cloud Deployment & Verification"]
        ReviewerDecision -- Approved --> DeployTrigger[Deployment Orchestrator]
        AutoApprove --> DeployTrigger
        DeployTrigger --> TFApply[Terraform Apply Execution]
        TFApply --> AWSCloud[(AWS Infrastructure)]
        AWSCloud --> DriftScan[Post-Deploy Drift Detection]
    end

    subgraph AuditLedger ["6. Cryptographic Audit & Blockchain Ledger"]
        DeployTrigger --> AuditEventGen[Canonical Audit Event Generation]
        DriftScan --> AuditEventGen
        ReviewerDecision --> AuditEventGen
        AuditEventGen --> SHA256Calc[Canonical SHA-256 Digest]
        SHA256Calc --> FabricAdapter[Hyperledger Fabric Adapter]
        FabricAdapter --> FabricLedger[(Fabric Blockchain Immutable Log)]
    end
```

## System Components

### 1. Backend Service (FastAPI + Python)
- **API Engine**: Provides modular, schema-validated RESTful endpoints for all lifecycle operations.
- **Security Engine**: Bridges Checkov CLI with native fallback rules covering AWS CIS benchmarks (public S3, open ingress 0.0.0.0/0, SSH 22, RDP 3389, wildcard IAM, unencrypted storage).
- **AI Risk Classifier**: Uses Scikit-Learn Random Forest trained on 8 core structural and security features to predict risk category with explainable feature rationale.
- **Audit Engine**: Deterministically serializes event payloads into canonical JSON, generates SHA-256 hashes, and records transactions on Hyperledger Fabric.

### 2. Frontend Application (React + TypeScript + Vite)
- Real-time enterprise security dashboard with live pipeline visualization, risk radars, change diffs, approval queues, drift inspectors, and audit ledger hash verifiers.

### 3. Dual Execution Mode (DEMO vs REAL)
- **DEMO Mode**: Completely self-contained; enables end-to-end evaluation without live AWS or Fabric infrastructure.
- **REAL Mode**: Connects directly to AWS Boto3 SDK, live Terraform CLI, Checkov CLI, and Hyperledger Fabric Gateway.
