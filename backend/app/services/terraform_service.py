import re
import json
import logging
from typing import Dict, Any, List, Optional
from app.schemas.terraform import ParsedResource, TerraformPlanSummary

logger = logging.getLogger("chainstate.terraform")


class TerraformService:
    """Parses and analyzes Terraform HCL source files and structured plan JSON."""

    SENSITIVE_PORTS = [22, 3389, 23, 21, 1433, 3306, 5432, 27017, 6379, 9200]
    WEB_PORTS = [80, 443, 8080, 8443]

    def parse_plan_json(self, plan_dict: Dict[str, Any]) -> TerraformPlanSummary:
        """Parses structured Terraform Plan JSON generated via `terraform show -json`."""
        resource_changes = plan_dict.get("resource_changes", [])
        parsed_resources: List[ParsedResource] = []
        to_add = 0
        to_change = 0
        to_destroy = 0
        overall_destructive = False

        for change in resource_changes:
            res_type = change.get("type", "unknown")
            res_name = change.get("name", "unnamed")
            actions = change.get("change", {}).get("actions", ["no-op"])
            after = change.get("change", {}).get("after") or {}
            before = change.get("change", {}).get("before") or {}

            # Determine action state
            action_str = "no-op"
            if "create" in actions:
                action_str = "create"
                to_add += 1
            elif "delete" in actions and "create" in actions:
                action_str = "replace"
                to_change += 1
                overall_destructive = True
            elif "delete" in actions:
                action_str = "delete"
                to_destroy += 1
                overall_destructive = True
            elif "update" in actions:
                action_str = "update"
                to_change += 1

            # Extract resource security signals
            public_access = False
            exposed_ports: List[int] = []
            cidr_ranges: List[str] = []
            iam_change = "iam" in res_type.lower()
            encryption_enabled = False
            is_destructive = "delete" in actions

            # Security group analysis
            if res_type == "aws_security_group" or "security_group" in res_type:
                ingress_rules = after.get("ingress", []) or []
                if isinstance(ingress_rules, dict):
                    ingress_rules = [ingress_rules]
                for rule in ingress_rules:
                    cidrs = rule.get("cidr_blocks", []) or []
                    cidr_ranges.extend(cidrs)
                    if "0.0.0.0/0" in cidrs or "::/0" in cidrs:
                        public_access = True
                    from_port = rule.get("from_port")
                    to_port = rule.get("to_port")
                    if from_port is not None:
                        exposed_ports.append(int(from_port))
                    if to_port is not None and to_port != from_port:
                        exposed_ports.append(int(to_port))

            # S3 bucket analysis
            if "s3_bucket" in res_type:
                acl = after.get("acl", "")
                if acl in ["public-read", "public-read-write", "website"]:
                    public_access = True
                server_enc = after.get("server_side_encryption_configuration", {})
                if server_enc or "sse" in str(after).lower():
                    encryption_enabled = True

            # Database / Storage Encryption
            if "db_instance" in res_type or "ebs" in res_type:
                if after.get("storage_encrypted") is True or after.get("encrypted") is True:
                    encryption_enabled = True

            # IAM Policy analysis
            if iam_change:
                policy_doc = after.get("policy", "") or after.get("document", "")
                if isinstance(policy_doc, str):
                    try:
                        policy_doc = json.loads(policy_doc)
                    except Exception:
                        pass
                if isinstance(policy_doc, dict):
                    stmts = policy_doc.get("Statement", [])
                    if isinstance(stmts, dict):
                        stmts = [stmts]
                    for stmt in stmts:
                        act = stmt.get("Action", "")
                        res = stmt.get("Resource", "")
                        if act == "*" and res == "*":
                            public_access = True  # Over-permissive wildcard

            parsed = ParsedResource(
                resource_type=res_type,
                resource_name=res_name,
                action=action_str,
                public_access=public_access,
                exposed_ports=list(set(exposed_ports)),
                cidr_ranges=list(set(cidr_ranges)),
                iam_change=iam_change,
                encryption_enabled=encryption_enabled,
                is_destructive=is_destructive,
                details=after
            )
            parsed_resources.append(parsed)

        return TerraformPlanSummary(
            total_resources=len(parsed_resources),
            to_add=to_add,
            to_change=to_change,
            to_destroy=to_destroy,
            is_destructive=overall_destructive,
            resources=parsed_resources,
            raw_plan_available=True
        )

    def parse_hcl(self, content: str) -> TerraformPlanSummary:
        """Parses Terraform .tf HCL text with balanced block extraction."""
        parsed_resources: List[ParsedResource] = []
        overall_destructive = False

        header_pattern = re.compile(r'resource\s+"([^"]+)"\s+"([^"]+)"\s*\{')
        
        for match in header_pattern.finditer(content):
            res_type = match.group(1).strip()
            res_name = match.group(2).strip()
            start_pos = match.end()

            # Find matching closing brace using balanced depth counter
            depth = 1
            idx = start_pos
            while idx < len(content) and depth > 0:
                char = content[idx]
                if char == '{':
                    depth += 1
                elif char == '}':
                    depth -= 1
                idx += 1

            body = content[start_pos:idx - 1] if depth == 0 else content[start_pos:]

            public_access = False
            exposed_ports: List[int] = []
            cidr_ranges: List[str] = []
            iam_change = "iam" in res_type.lower()
            encryption_enabled = False
            is_destructive = False

            # Check open CIDR
            if re.search(r'0\.0\.0\.0/0', body):
                public_access = True
                cidr_ranges.append("0.0.0.0/0")
            if re.search(r'::/0', body):
                public_access = True
                cidr_ranges.append("::/0")

            # Extract ports
            port_matches = re.findall(r'(?:from_port|to_port|port)\s*=\s*(\d+)', body)
            for p in port_matches:
                exposed_ports.append(int(p))

            # Specific rule checks by resource type
            if "security_group" in res_type:
                if not exposed_ports and public_access:
                    exposed_ports.append(0)  # All traffic

            if "s3_bucket" in res_type:
                if re.search(r'acl\s*=\s*["\']public', body):
                    public_access = True
                if re.search(r'(?:apply_server_side_encryption|kms|AES256)', body):
                    encryption_enabled = True

            if "ebs" in res_type or "db_instance" in res_type:
                if re.search(r'(?:encrypted\s*=\s*true|storage_encrypted\s*=\s*true)', body):
                    encryption_enabled = True

            if iam_change:
                if re.search(r'["\']?\*["\']?', body) and re.search(r'Action', body, re.IGNORECASE):
                    public_access = True

            # Destructive drop or deletion flags
            if re.search(r'(?:prevent_destroy\s*=\s*false|force_destroy\s*=\s*true)', body):
                is_destructive = True
                overall_destructive = True

            parsed = ParsedResource(
                resource_type=res_type,
                resource_name=res_name,
                action="create",
                public_access=public_access,
                exposed_ports=list(set(exposed_ports)),
                cidr_ranges=list(set(cidr_ranges)),
                iam_change=iam_change,
                encryption_enabled=encryption_enabled,
                is_destructive=is_destructive,
                details={"body_snippet": body[:200].strip()}
            )
            parsed_resources.append(parsed)

        return TerraformPlanSummary(
            total_resources=len(parsed_resources),
            to_add=len(parsed_resources),
            to_change=0,
            to_destroy=0,
            is_destructive=overall_destructive,
            resources=parsed_resources,
            raw_plan_available=False
        )

    def analyze(self, raw_content: Optional[str] = None, plan_json: Optional[Dict[str, Any]] = None) -> TerraformPlanSummary:
        """Unified analysis entrypoint supporting both raw HCL and structured plan JSON."""
        if plan_json and len(plan_dict_resources := plan_json.get("resource_changes", [])) > 0:
            logger.info(f"Parsing structured plan JSON with {len(plan_dict_resources)} resource changes.")
            return self.parse_plan_json(plan_json)

        if raw_content and raw_content.strip():
            logger.info("Parsing HCL text configuration.")
            return self.parse_hcl(raw_content)

        return TerraformPlanSummary(
            total_resources=0,
            to_add=0,
            to_change=0,
            to_destroy=0,
            is_destructive=False,
            resources=[],
            raw_plan_available=False
        )


terraform_service = TerraformService()
