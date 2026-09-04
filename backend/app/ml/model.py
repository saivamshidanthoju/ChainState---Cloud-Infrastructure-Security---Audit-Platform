import os
import json
import logging
import joblib
import numpy as np
from typing import Dict, Any, List, Tuple, Optional
from app.models.enums import RiskLevel, SeverityLevel
from app.ml.dataset import FEATURE_NAMES, RISK_CLASSES
from app.schemas.terraform import TerraformPlanSummary
from app.schemas.security import FindingResponse

logger = logging.getLogger("chainstate.ml.model")

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
MODEL_PATH = os.path.join(ARTIFACTS_DIR, "risk_model.joblib")
METADATA_PATH = os.path.join(ARTIFACTS_DIR, "model_metadata.json")


class RiskModel:
    """Random Forest classifier inference engine for Infrastructure Change Risk Scoring."""

    def __init__(self):
        self.model = None
        self.metadata = None
        self._load_or_train()

    def _load_or_train(self):
        """Loads serialized model artifact or triggers training if missing."""
        if os.path.exists(MODEL_PATH) and os.path.exists(METADATA_PATH):
            try:
                self.model = joblib.load(MODEL_PATH)
                with open(METADATA_PATH, "r") as f:
                    self.metadata = json.load(f)
                logger.info("Loaded serialized Random Forest risk model successfully.")
                return
            except Exception as e:
                logger.warning(f"Error loading model artifact: {e}. Retraining...")

        # Retrain on the fly
        from app.ml.train import train_risk_model
        self.model, self.metadata = train_risk_model()

    def extract_features(
        self, 
        plan_summary: TerraformPlanSummary, 
        findings: List[FindingResponse]
    ) -> Dict[str, float]:
        """Extracts the 8 core features from parsed Terraform resources and security findings."""
        public_access = 0.0
        exposed_port = 0.0
        cidr_open = 0.0
        iam_change = 0.0
        destructive_change = 1.0 if plan_summary.is_destructive else 0.0
        security_findings = float(len([f for f in findings if not f.passed]))
        resource_count = float(plan_summary.total_resources)
        resource_type_risk = 0.0

        for res in plan_summary.resources:
            if res.public_access:
                public_access = 1.0
            if "0.0.0.0/0" in res.cidr_ranges or "::/0" in res.cidr_ranges:
                cidr_open = 1.0

            # Check ports
            for p in res.exposed_ports:
                if p in [22, 3389, 1433, 3306, 5432]:
                    exposed_port = max(exposed_port, 2.0)  # Sensitive port
                elif p in [80, 443, 8080, 8443]:
                    exposed_port = max(exposed_port, 1.0)  # Standard web port
                elif p == 0:
                    exposed_port = max(exposed_port, 3.0)  # All traffic

            # Check IAM
            if res.iam_change:
                if res.public_access:  # wildcard policy
                    iam_change = max(iam_change, 2.0)
                else:
                    iam_change = max(iam_change, 1.0)

            # Resource type risk
            r_type = res.resource_type.lower()
            if "iam" in r_type or "db" in r_type:
                resource_type_risk = max(resource_type_risk, 3.0)
            elif "security_group" in r_type:
                resource_type_risk = max(resource_type_risk, 2.0)
            elif "instance" in r_type or "vpc" in r_type:
                resource_type_risk = max(resource_type_risk, 1.0)

        return {
            "public_access": public_access,
            "exposed_port": exposed_port,
            "cidr_open": cidr_open,
            "iam_change": iam_change,
            "destructive_change": destructive_change,
            "security_findings": security_findings,
            "resource_count": resource_count,
            "resource_type_risk": resource_type_risk
        }

    def predict(
        self, 
        features: Dict[str, float]
    ) -> Tuple[RiskLevel, float, List[str], str]:
        """
        Runs model inference, outputs continuous score (0.0 - 1.0),
        discrete risk level (LOW/MED/HIGH/CRIT), reasons, and action.
        """
        feature_vector = np.array([[features[k] for k in FEATURE_NAMES]], dtype=np.float32)
        
        # Predict class probabilities: [p(LOW), p(MEDIUM), p(HIGH), p(CRITICAL)]
        probabilities = self.model.predict_proba(feature_vector)[0]
        
        # Risk weights: LOW=0.1, MEDIUM=0.4, HIGH=0.75, CRITICAL=1.0
        weights = np.array([0.1, 0.4, 0.75, 1.0])
        continuous_score = float(np.dot(probabilities, weights))
        
        # Primary predicted class index
        pred_class_idx = int(np.argmax(probabilities))
        risk_level_str = RISK_CLASSES[pred_class_idx]
        risk_level = RiskLevel(risk_level_str)

        # Deterministic explainable rationale generation
        reasons: List[str] = []
        if features["iam_change"] >= 2.0:
            reasons.append("Critical: Overly permissive IAM policy with wildcard permissions detected.")
        if features["exposed_port"] >= 2.0 and features["public_access"] >= 1.0:
            reasons.append("High risk: Sensitive administrative or database port exposed to the public internet.")
        if features["cidr_open"] >= 1.0:
            reasons.append("Unrestricted CIDR (0.0.0.0/0) allows ingress from any IP on the internet.")
        if features["destructive_change"] >= 1.0:
            reasons.append("Destructive modification or resource deletion detected in Terraform plan.")
        if features["security_findings"] > 0:
            reasons.append(f"{int(features['security_findings'])} security policy checks failed during inspection.")
        if features["resource_count"] > 15:
            reasons.append(f"Large infrastructure blast radius: {int(features['resource_count'])} resources affected.")

        if not reasons:
            reasons.append("Infrastructure conforms to security baseline; no high-risk anomalies detected.")

        # Recommended Action
        if risk_level == RiskLevel.LOW:
            action = "Safe infrastructure change. Eligible for automatic deployment in demo mode."
        elif risk_level == RiskLevel.MEDIUM:
            action = "Potentially risky change. Normally deployable with routine peer or security review."
        elif risk_level == RiskLevel.HIGH:
            action = "Requires explicit approval from Security Reviewer or Approver before deployment."
        else:  # CRITICAL
            action = "Deployment blocked by default until security issues are resolved or an authorized override is provided."

        return risk_level, round(continuous_score, 2), reasons, action


risk_model = RiskModel()
