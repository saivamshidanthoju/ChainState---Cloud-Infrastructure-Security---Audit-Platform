import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db, SessionLocal
from app.api import auth, terraform, security, risk
from app.models import (
    TerraformChange,
    Approval,
    RiskAssessment,
    Deployment,
    DriftEvent,
    AuditRecord,
    ApprovalDecision,
    RiskLevel
)
from app.utils.seed_data import init_db, seed_data

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("chainstate")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize tables and seed baseline data
    logger.info("Starting up ChainState Backend Platform...")
    init_db()
    with SessionLocal() as db:
        seed_data(db)
    yield
    # Shutdown
    logger.info("Shutting down ChainState Backend Platform...")


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "ChainState governs Terraform-based cloud infrastructure changes across "
        "security scanning, AI risk classification, approval gates, AWS deployment, "
        "drift detection, and tamper-evident Hyperledger Fabric audit logging."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    response.headers["X-Process-Time-Ms"] = f"{process_time:.2f}"
    return response


# Include Routers
app.include_router(auth.router, prefix="/api")
app.include_router(terraform.router, prefix="/api")
app.include_router(security.router, prefix="/api")
app.include_router(risk.router, prefix="/api")


@app.get("/")
def root_endpoint():
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "status": "operational",
        "demo_mode": settings.DEMO_MODE,
        "docs": "/docs"
    }


@app.get("/api/health")
def health_check():
    """Health check endpoint providing status of services and current mode."""
    return {
        "status": "healthy",
        "service": "chainstate-backend",
        "demo_mode": settings.DEMO_MODE,
        "environment": settings.APP_ENV,
        "integrations": {
            "aws": "DEMO (Simulated via AWSService)" if settings.DEMO_MODE else "REAL (boto3)",
            "hyperledger_fabric": "DEMO (Simulated deterministic ledger)" if settings.DEMO_MODE else "REAL (Fabric Gateway)",
            "security_scanner": "Checkov CLI + Built-in Rules Engine",
            "risk_engine": "Scikit-Learn Random Forest Classifier"
        }
    }


@app.get("/api/dashboard/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Live database-backed dashboard metrics summary."""
    total_changes = db.query(TerraformChange).count()
    pending_approvals = db.query(Approval).filter(Approval.decision == ApprovalDecision.PENDING).count()
    high_critical_risks = db.query(RiskAssessment).filter(
        RiskAssessment.risk_level.in_([RiskLevel.HIGH, RiskLevel.CRITICAL])
    ).count()
    successful_deployments = db.query(Deployment).filter(Deployment.state == "DEPLOYED").count()
    drift_events = db.query(DriftEvent).count()
    audit_records = db.query(AuditRecord).count()

    return {
        "total_changes": total_changes,
        "pending_approvals": pending_approvals,
        "high_critical_risks": high_critical_risks,
        "successful_deployments": successful_deployments,
        "drift_events": drift_events,
        "audit_records": audit_records,
        "blockchain_status": "ONLINE (DEMO LEDGER)" if settings.DEMO_MODE else "CONNECTED (FABRIC NETWORK)",
        "demo_mode": settings.DEMO_MODE
    }
