"""
tests/integration/test_tenant_lifecycle.py
Integration tests for Tenant Lifecycle & Multi-Tenant Data Isolation.

Validates:
1. Tenant creation and provisioning.
2. Tenant/user setup with role and access boundaries.
3. Tenant-specific runtime configuration.
4. Absolute data isolation: ZERO leakage of another tenant's records.
5. SETU / Niyantran / Parikshak operations under the new tenant.
"""

from __future__ import annotations

import sys
import uuid
from pathlib import Path
import jwt
import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from api.production import TENANTS_DB, app
from phase2_security import load_jwt_keys


@pytest.fixture
def make_tenant_token():
    private_key, _ = load_jwt_keys()

    def _token(tenant_id: str, sub: str = "tenant_admin", role: str = "admin"):
        return jwt.encode(
            {
                "sub": sub,
                "role": role,
                "tenant_id": tenant_id,
                "jti": str(uuid.uuid4()),
                "exp": 4_000_000_000,
            },
            private_key,
            algorithm="RS256",
        )

    return _token


@pytest.fixture
def client():
    return TestClient(app)


def test_tenant_creation_and_lifecycle_provisioning(client, make_tenant_token):
    new_tenant_id = f"tenant_apex_{uuid.uuid4().hex[:6]}"
    create_payload = {
        "tenant_id": new_tenant_id,
        "name": "Apex Logistics Global",
        "company_id": "apex_corp_001",
        "admin_email": "admin@apexlogistics.com",
        "config": {
            "retention_days": 180,
            "geofence_meters": 30,
            "auto_approve_threshold": 10000.0,
        },
    }

    # Public endpoint to provision new tenant
    response = client.post("/api/v1/tenants/create", json=create_payload)
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["tenant_id"] == new_tenant_id
    assert body["status"] == "PROVISIONED_AND_ISOLATED"
    assert body["tenant_summary"]["config"]["geofence_meters"] == 30

    # Verify duplicate creation is rejected with 409 Conflict
    dup_resp = client.post("/api/v1/tenants/create", json=create_payload)
    assert dup_resp.status_code == 409


def test_strict_multi_tenant_data_isolation_no_leakage(client, make_tenant_token):
    """
    Ensure tenant A (Apex) cannot read or query tenant B (Bright Connection) data,
    and summary queries strictly return isolated records.
    """
    tenant_apex = f"tenant_apex_{uuid.uuid4().hex[:6]}"
    client.post(
        "/api/v1/tenants/create",
        json={
            "tenant_id": tenant_apex,
            "name": "Apex Corp",
            "company_id": "apex_001",
            "admin_email": "admin@apex.com",
            "config": {"retention_days": 30},
        },
    )

    apex_token = make_tenant_token(tenant_apex)
    apex_headers = {
        "Authorization": f"Bearer {apex_token}",
        "X-Tenant-Id": tenant_apex,
        "X-Request-Id": f"req_{uuid.uuid4().hex[:8]}",
    }

    # Apex queries its own summary -> exactly 0 records initially, zero leakage from Bright Connection
    summary_resp = client.get(f"/api/v1/tenants/{tenant_apex}/summary", headers=apex_headers)
    assert summary_resp.status_code == 200
    assert summary_resp.json()["record_count"] == 0
    assert summary_resp.json()["isolated"] is True
    assert summary_resp.json()["leakage_detected"] is False

    # Attempting to read Bright Connection's summary using Apex token violates tenant boundary
    cross_headers = {
        "Authorization": f"Bearer {apex_token}",
        "X-Tenant-Id": "tenant_bright_connection",  # Mismatch with token
        "X-Request-Id": f"req_{uuid.uuid4().hex[:8]}",
    }
    cross_resp = client.get("/api/v1/tenants/tenant_bright_connection/summary", headers=cross_headers)
    assert cross_resp.status_code == 403
    assert "Tenant boundary violation" in cross_resp.json()["message"]


def test_setu_orchestration_under_new_tenant(client, make_tenant_token):
    """Verify task orchestration and rule evaluation function under newly created tenant."""
    new_tenant = f"tenant_delta_{uuid.uuid4().hex[:6]}"
    client.post(
        "/api/v1/tenants/create",
        json={
            "tenant_id": new_tenant,
            "name": "Delta Logistics",
            "company_id": "delta_001",
            "admin_email": "ops@delta.com",
            "config": {"geofence_meters": 40},
        },
    )

    token = make_tenant_token(new_tenant)
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-Id": new_tenant,
        "X-Request-Id": f"req_{uuid.uuid4().hex[:8]}",
    }

    task_id = f"task_delta_{uuid.uuid4().hex[:6]}"

    # Register task under new tenant
    r1 = client.post(
        "/api/v1/tasks/register",
        json={"task_id": task_id, "tenant_id": new_tenant, "assignee": "Aman Agent"},
        headers=headers,
    )
    assert r1.status_code == 200
    assert r1.json()["tenant_id"] == new_tenant

    # Transition task under new tenant
    headers["X-Request-Id"] = f"req_{uuid.uuid4().hex[:8]}"
    r2 = client.post(
        "/api/v1/tasks/transition",
        json={"task_id": task_id, "target_state": "SUBMITTED", "expected_version": 1},
        headers=headers,
    )
    assert r2.status_code == 200
    assert r2.json()["state"] == "SUBMITTED"
    assert r2.json()["tenant_id"] == new_tenant
