import random
import numpy as np
from typing import Tuple, List, Dict, Any

FEATURE_NAMES = [
    "public_access",       # 0: Private, 1: Publicly accessible
    "exposed_port",        # 0: None, 1: Standard web (80/443), 2: Sensitive (22/3389/DB), 3: All
    "cidr_open",           # 0: Internal/VPC CIDR, 1: Open to world (0.0.0.0/0 or ::/0)
    "iam_change",          # 0: None, 1: Scoped IAM, 2: Wildcard/Admin privileges
    "destructive_change",  # 0: Non-destructive, 1: Destructive replacement/deletion
    "security_findings",   # Count of failed security checks (0 to 10)
    "resource_count",      # Total number of resources affected (1 to 50)
    "resource_type_risk"   # 0: Storage/KMS, 1: Compute/VPC, 2: Security Group, 3: IAM/RDS
]

RISK_CLASSES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def generate_synthetic_dataset(num_samples: int = 2000, seed: int = 42) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generates a structured, representative dataset for training the prototype Random Forest Classifier.
    Note: Prototype model dataset. Designed so real enterprise-labeled audit data can drop in seamlessly.
    """
    random.seed(seed)
    np.random.seed(seed)

    X = []
    y = []

    for _ in range(num_samples):
        # Sample base features
        public_access = np.random.choice([0, 1], p=[0.7, 0.3])
        cidr_open = public_access if np.random.rand() > 0.1 else 0
        
        if public_access:
            exposed_port = np.random.choice([0, 1, 2, 3], p=[0.1, 0.4, 0.4, 0.1])
        else:
            exposed_port = np.random.choice([0, 1, 2], p=[0.7, 0.2, 0.1])

        iam_change = np.random.choice([0, 1, 2], p=[0.7, 0.22, 0.08])
        destructive_change = np.random.choice([0, 1], p=[0.85, 0.15])
        
        # Security findings correlate with public access, sensitive ports, and wildcard IAM
        findings_bias = (public_access * 2) + (1 if exposed_port >= 2 else 0) + (iam_change * 2) + (destructive_change * 1)
        security_findings = int(np.clip(np.random.poisson(lam=findings_bias), 0, 10))

        resource_count = int(np.random.choice(range(1, 25)))
        resource_type_risk = np.random.choice([0, 1, 2, 3], p=[0.35, 0.3, 0.2, 0.15])

        features = [
            public_access,
            exposed_port,
            cidr_open,
            iam_change,
            destructive_change,
            security_findings,
            resource_count,
            resource_type_risk
        ]

        # Deterministic Ground Truth Rule Formulation for Supervised Learning
        if iam_change == 2 or (exposed_port == 3 and public_access == 1) or (security_findings >= 3 and public_access == 1):
            label = 3  # CRITICAL
        elif (exposed_port == 2 and public_access == 1) or destructive_change == 1 or security_findings >= 2 or (public_access == 1 and resource_type_risk >= 2):
            label = 2  # HIGH
        elif security_findings == 1 or exposed_port == 1 or iam_change == 1 or resource_count > 10:
            label = 1  # MEDIUM
        else:
            label = 0  # LOW

        # Add 3% realistic label noise to prevent artificial overfitting
        if np.random.rand() < 0.03:
            label = int(np.clip(label + np.random.choice([-1, 1]), 0, 3))

        X.append(features)
        y.append(label)

    return np.array(X, dtype=np.float32), np.array(y, dtype=np.int64)
