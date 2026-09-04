from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.enums import UserRole
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token
from app.utils.security import verify_password, get_password_hash, create_access_token
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication & RBAC"])


@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)) -> Any:
    """Authenticates user with email/password and returns signed JWT access token."""
    user = db.query(User).filter(User.email == credentials.email.lower()).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )

    access_token = create_access_token(subject=user.email, role=user.role.value)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> Any:
    """Returns profile and role of currently authenticated user."""
    return current_user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)) -> Any:
    """Registers a new user account."""
    existing = db.query(User).filter(User.email == user_in.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    user = User(
        email=user_in.email.lower(),
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        is_active=user_in.is_active
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/demo-users")
def get_demo_users():
    """Provides seed user credentials for rapid evaluation in DEMO mode."""
    return {
        "default_password": "ChainState2026!",
        "roles": [
            {
                "role": "Developer",
                "email": "dev@chainstate.io",
                "name": "David Dev (Developer)",
                "description": "Can submit Terraform changes and review scan results."
            },
            {
                "role": "Security Reviewer",
                "email": "security@chainstate.io",
                "name": "Sarah SecOps (Security Reviewer)",
                "description": "Can analyze Checkov rules, AI risk scoring, and recommend mitigations."
            },
            {
                "role": "Approver",
                "email": "approver@chainstate.io",
                "name": "Alex Approver (Approver)",
                "description": "Authorized to explicitly approve HIGH and CRITICAL risk changes."
            },
            {
                "role": "Administrator",
                "email": "admin@chainstate.io",
                "name": "Alice Admin (Administrator)",
                "description": "Full platform administration, user management, and ledger verification."
            }
        ]
    }
