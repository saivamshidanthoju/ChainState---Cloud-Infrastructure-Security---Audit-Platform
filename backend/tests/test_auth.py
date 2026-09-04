import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, UserRole

client = TestClient(app)


def test_seed_users_exist():
    """Verify that startup lifespan or seed function populated the 4 standard roles."""
    with TestClient(app) as tc:
        # Trigger startup lifespan
        res = tc.get("/api/auth/demo-users")
        assert res.status_code == 200
        data = res.json()
        assert len(data["roles"]) == 4

        with SessionLocal() as db:
            users = db.query(User).all()
            emails = [u.email for u in users]
            assert "dev@chainstate.io" in emails
            assert "security@chainstate.io" in emails
            assert "approver@chainstate.io" in emails
            assert "admin@chainstate.io" in emails


def test_login_success():
    """Test login with seeded developer user."""
    with TestClient(app) as tc:
        response = tc.post(
            "/api/auth/login",
            json={"email": "dev@chainstate.io", "password": "ChainState2026!"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "dev@chainstate.io"
        assert data["user"]["role"] == "Developer"


def test_login_invalid_password():
    """Test login fails with incorrect password."""
    with TestClient(app) as tc:
        response = tc.post(
            "/api/auth/login",
            json={"email": "dev@chainstate.io", "password": "WrongPassword123!"}
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password"


def test_auth_me_endpoint():
    """Test GET /api/auth/me with Bearer token."""
    with TestClient(app) as tc:
        login_res = tc.post(
            "/api/auth/login",
            json={"email": "security@chainstate.io", "password": "ChainState2026!"}
        )
        token = login_res.json()["access_token"]

        # Call /api/auth/me with token
        me_res = tc.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_res.status_code == 200
        user_info = me_res.json()
        assert user_info["email"] == "security@chainstate.io"
        assert user_info["role"] == "Security Reviewer"


def test_auth_me_unauthorized():
    """Test GET /api/auth/me without token returns 401."""
    with TestClient(app) as tc:
        me_res = tc.get("/api/auth/me")
        assert me_res.status_code == 401


def test_dashboard_summary_live_db():
    """Test that dashboard summary retrieves real database numbers."""
    with TestClient(app) as tc:
        res = tc.get("/api/dashboard/summary")
        assert res.status_code == 200
        data = res.json()
        assert data["total_changes"] >= 1
        assert data["audit_records"] >= 1
        assert data["demo_mode"] is True
