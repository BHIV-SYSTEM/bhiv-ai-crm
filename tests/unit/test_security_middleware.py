"""
tests/unit/test_security_middleware.py
Unit tests for security/middleware.py.
Covers RS256 JWT verification, HS256 rejection, replay mitigation claims,
tenant boundary isolation, and error boundary protection.
"""

from __future__ import annotations

import sys
import uuid
from pathlib import Path
import jwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from phase2_security import ReplayMitigationStore, load_jwt_keys
from security.middleware import SecurityGovernanceMiddleware


@pytest.fixture
def keys():
    return load_jwt_keys()


@pytest.fixture
def client(tmp_path, keys):
    private_key, public_key = keys
    app = FastAPI()
    replay_store = ReplayMitigationStore(tmp_path / "test_replay.db")
    app.add_middleware(SecurityGovernanceMiddleware, replay_store=replay_store, public_key=public_key)

    @app.get("/api/v1/protected")
    def protected():
        return {"status": "ok", "message": "access granted"}

    @app.post("/api/v1/echo")
    def echo(data: dict):
        return {"received": data}

    return TestClient(app)


def test_rs256_token_access_succeeds(client, keys):
    private_key, _ = keys
    token = jwt.encode(
        {"sub": "user_001", "tenant_id": "tenant_bright_connection", "jti": str(uuid.uuid4()), "exp": 4_000_000_000},
        private_key,
        algorithm="RS256",
    )

    response = client.get(
        "/api/v1/protected",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Tenant-Id": "tenant_bright_connection",
            "X-Request-Id": "req_001",
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "X-SETU-Trace-Id" in response.headers


def test_hs256_token_is_strictly_rejected(client):
    token = jwt.encode(
        {"sub": "attacker", "tenant_id": "tenant_bright_connection"},
        "insecure-secret-key-padding-32-bytes",
        algorithm="HS256",
    )

    response = client.get(
        "/api/v1/protected",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 401
    assert "RS256 required" in response.json()["message"]


def test_replay_attack_mitigation_rejects_duplicate_claim(client, keys):
    private_key, _ = keys
    jti = f"jti_test_{uuid.uuid4().hex[:8]}"
    token = jwt.encode(
        {"sub": "user_001", "tenant_id": "tenant_bright_connection", "jti": jti, "exp": 4_000_000_000},
        private_key,
        algorithm="RS256",
    )

    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-Id": "tenant_bright_connection",
        "X-Request-Id": "req_unique_001",
    }

    # First request succeeds
    r1 = client.get("/api/v1/protected", headers=headers)
    assert r1.status_code == 200

    # Replay of identical request identifier with same token is rejected
    r2 = client.get("/api/v1/protected", headers=headers)
    assert r2.status_code == 409
    assert "Duplicate request identifier" in r2.json()["message"]


def test_tenant_boundary_violation_is_rejected(client, keys):
    private_key, _ = keys
    token = jwt.encode(
        {"sub": "user_001", "tenant_id": "tenant_bright_connection", "jti": str(uuid.uuid4()), "exp": 4_000_000_000},
        private_key,
        algorithm="RS256",
    )

    # Header requests a different tenant than the token grants
    response = client.get(
        "/api/v1/protected",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Tenant-Id": "tenant_foreign_corp",
            "X-Request-Id": "req_002",
        },
    )
    assert response.status_code == 403
    assert "Tenant boundary violation" in response.json()["message"]


def test_error_boundary_catches_malformed_json_without_500(client, keys):
    private_key, _ = keys
    token = jwt.encode(
        {"sub": "user_001", "tenant_id": "tenant_bright_connection", "jti": str(uuid.uuid4()), "exp": 4_000_000_000},
        private_key,
        algorithm="RS256",
    )

    # Send malformed body
    response = client.post(
        "/api/v1/echo",
        content="this is not a valid json {",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-Tenant-Id": "tenant_bright_connection",
            "X-Request-Id": "req_003",
        },
    )
    # Must be 400 or 422, NEVER 500
    assert response.status_code in [400, 422]
    assert response.status_code != 500
    data = response.json()
    assert any(k in data for k in ("detail", "error", "message", "success"))
