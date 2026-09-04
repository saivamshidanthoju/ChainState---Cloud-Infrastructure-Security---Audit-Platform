import shutil
import subprocess
import json
import logging
from typing import List, Dict, Any, Optional
from app.models.enums import SeverityLevel
from app.schemas.security import FindingResponse, SecurityScanResult
from app.schemas.terraform import TerraformPlanSummary, ParsedResource
from app.config import get_settings

logger = logging.getLogger("chainstate.security")
settings = get_settings()


class SecurityScanner:
    """Security Scanner integrating Checkov CLI and built-in CIS Benchmark rules."""

    def __init__(self):
        self.checkov_available = self._detect_checkov()
        logger.info(f"SecurityScanner initialized. Checkov CLI available: {self.checkov_available}")

    def _detect_checkov(self) -> bool:
        if not settings.CHECKOV_ENABLED:
            return False
        return shutil.which("checkov") is not None

    def analyze_plan(self, plan_summary: TerraformPlanSummary) -> List[FindingResponse]:
        """Runs built-in CIS Benchmark rules against parsed Terraform resources."""
        findings: List[FindingResponse] = []

        for res in plan_summary.resources:
            r_type = res.resource_type
            r_name = f"{res.resource_type}.{res.resource_name}"
            ports = res.exposed_ports
            is_public = res.public_access
            cidrs = res.cidr_ranges

            # Rule 1: SSH Port 22 open to 0.0.0.0/0 (CKV_AWS_24)
            if 22 in ports and ("0.0.0.0/0" in cidrs or is_public):
                findings.append(FindingResponse(
                    check_id="CKV_AWS_24",
                    title="Ensure no security groups allow ingress from 0.0.0.0/0 to port 22",
                    severity=SeverityLevel.HIGH,
                    resource=r_name,
                    message="Security group rule permits unrestricted SSH (port 22) ingress from the public internet (0.0.0.0/0).",
                    remediation="Restrict ingress CIDR block to authorized corporate bastion IP ranges or utilize AWS Systems Manager Session Manager.",
                    passed=False
                ))

            # Rule 2: RDP Port 3389 open to 0.0.0.0/0 (CKV_AWS_25)
            if 3389 in ports and ("0.0.0.0/0" in cidrs or is_public):
                findings.append(FindingResponse(
                    check_id="CKV_AWS_25",
                    title="Ensure no security groups allow ingress from 0.0.0.0/0 to port 3389",
                    severity=SeverityLevel.CRITICAL,
                    resource=r_name,
                    message="Security group rule permits unrestricted RDP (port 3389) ingress from the public internet.",
                    remediation="Remove 0.0.0.0/0 from RDP rules and tunnel Windows management through an enterprise VPN.",
                    passed=False
                ))

            # Rule 3: All ports open 0-65535 or port 0 (CKV_AWS_260)
            if (0 in ports or (len(ports) > 0 and max(ports) == 65535)) and is_public:
                findings.append(FindingResponse(
                    check_id="CKV_AWS_260",
                    title="Ensure no security groups allow unrestricted ingress to all ports",
                    severity=SeverityLevel.CRITICAL,
                    resource=r_name,
                    message="Security group allows open access to all ports from 0.0.0.0/0.",
                    remediation="Close wildcard ports and follow the principle of least privilege.",
                    passed=False
                ))

            # Check if plan defines S3 server-side encryption
            has_s3_encryption = any(
                "encryption" in r.resource_type.lower() or r.encryption_enabled 
                for r in plan_summary.resources
            )

            # Rule 4: S3 Public Access (CKV_AWS_20)
            if r_type == "aws_s3_bucket" and is_public:
                findings.append(FindingResponse(
                    check_id="CKV_AWS_20",
                    title="Ensure S3 bucket is not publicly accessible",
                    severity=SeverityLevel.HIGH,
                    resource=r_name,
                    message="S3 bucket allows public read/write ACLs or lacks an explicit aws_s3_bucket_public_access_block.",
                    remediation="Apply aws_s3_bucket_public_access_block with block_public_acls and block_public_policy enabled.",
                    passed=False
                ))

            # Rule 5: S3 Encryption Disabled (CKV_AWS_19)
            if r_type == "aws_s3_bucket":
                if not (res.encryption_enabled or has_s3_encryption):
                    findings.append(FindingResponse(
                        check_id="CKV_AWS_19",
                        title="Ensure S3 bucket has server-side encryption enabled",
                        severity=SeverityLevel.MEDIUM,
                        resource=r_name,
                        message="S3 bucket is configured without default AWS KMS or AES256 server-side encryption.",
                        remediation="Attach aws_s3_bucket_server_side_encryption_configuration with SSE-KMS.",
                        passed=False
                    ))
                else:
                    findings.append(FindingResponse(
                        check_id="CKV_AWS_19",
                        title="Ensure S3 bucket has server-side encryption enabled",
                        severity=SeverityLevel.LOW,
                        resource=r_name,
                        message="Server-side encryption is properly configured (SSE-KMS/AES256).",
                        remediation="Maintain existing encryption configuration.",
                        passed=True
                    ))

            # Rule 6: Overly Permissive IAM Policy (CKV_AWS_1)
            if res.iam_change and is_public:
                findings.append(FindingResponse(
                    check_id="CKV_AWS_1",
                    title="Ensure IAM policies do not allow full administrative privileges",
                    severity=SeverityLevel.CRITICAL,
                    resource=r_name,
                    message="IAM policy statement grants wildcard permissions ('Action': '*', 'Resource': '*').",
                    remediation="Scope permissions strictly to the exact AWS service actions and resource ARNs required.",
                    passed=False
                ))

            # Rule 7: Storage/Database Unencrypted (CKV_AWS_3 / CKV_AWS_16)
            if ("ebs" in r_type or "db_instance" in r_type) and not res.encryption_enabled:
                findings.append(FindingResponse(
                    check_id="CKV_AWS_16" if "db" in r_type else "CKV_AWS_3",
                    title=f"Ensure {'RDS database' if 'db' in r_type else 'EBS volume'} encryption is enabled",
                    severity=SeverityLevel.MEDIUM,
                    resource=r_name,
                    message=f"{r_type} is configured with encryption at rest disabled.",
                    remediation="Set storage_encrypted = true and specify a customer-managed KMS key.",
                    passed=False
                ))

            # Rule 8: Destructive Change Detected (CKV_AWS_DESTRUCTIVE)
            if res.is_destructive:
                findings.append(FindingResponse(
                    check_id="CKV_AWS_DESTRUCTIVE",
                    title="Destructive infrastructure change detected",
                    severity=SeverityLevel.HIGH,
                    resource=r_name,
                    message=f"Plan indicates destructive replacement or deletion of critical resource {r_name}.",
                    remediation="Review resource replacement impact and ensure data backup before applying.",
                    passed=False
                ))

        return findings

    def run_checkov_cli(self, terraform_path: str) -> Optional[List[FindingResponse]]:
        """Invokes Checkov CLI if installed and parses JSON output."""
        if not self.checkov_available:
            return None
        try:
            logger.info(f"Executing Checkov CLI on {terraform_path}")
            result = subprocess.run(
                ["checkov", "-d", terraform_path, "-o", "json"],
                capture_output=True,
                text=True,
                timeout=45
            )
            if not result.stdout:
                return None
            data = json.loads(result.stdout)
            findings: List[FindingResponse] = []
            
            # Parse Checkov JSON
            checks = []
            if isinstance(data, list):
                for report in data:
                    checks.extend(report.get("results", {}).get("failed_checks", []))
            elif isinstance(data, dict):
                checks = data.get("results", {}).get("failed_checks", [])

            for c in checks:
                findings.append(FindingResponse(
                    check_id=c.get("check_id", "CKV_UNKNOWN"),
                    title=c.get("check_name", "Checkov Finding"),
                    severity=SeverityLevel[c.get("severity", "MEDIUM").upper()] if c.get("severity") in SeverityLevel.__members__ else SeverityLevel.MEDIUM,
                    resource=c.get("resource", "unknown"),
                    message=c.get("check_name", "Security check failed."),
                    remediation=c.get("guideline", "Refer to Checkov documentation."),
                    passed=False
                ))
            return findings
        except Exception as e:
            logger.warning(f"Checkov execution failed or timed out: {e}. Falling back to built-in rules.")
            return None

    def scan(self, plan_summary: TerraformPlanSummary, terraform_path: Optional[str] = None) -> SecurityScanResult:
        """Performs complete security analysis with Checkov CLI or Built-in engine."""
        scanner_used = "ChainState Built-in CIS Rules Engine"
        findings: List[FindingResponse] = []

        if terraform_path and self.checkov_available:
            checkov_findings = self.run_checkov_cli(terraform_path)
            if checkov_findings is not None:
                findings = checkov_findings
                scanner_used = "Checkov CLI"

        # Fallback / augment with built-in rules
        if not findings:
            findings = self.analyze_plan(plan_summary)

        failed_count = sum(1 for f in findings if not f.passed)
        passed_count = sum(1 for f in findings if f.passed)
        high_critical = sum(1 for f in findings if not f.passed and f.severity in [SeverityLevel.HIGH, SeverityLevel.CRITICAL])

        return SecurityScanResult(
            scanner_used=scanner_used,
            total_findings=len(findings),
            failed_count=failed_count,
            passed_count=passed_count,
            high_critical_count=high_critical,
            findings=findings
        )


security_scanner = SecurityScanner()
