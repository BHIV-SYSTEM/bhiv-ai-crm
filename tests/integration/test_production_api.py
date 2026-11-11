"""
tests/integration/test_production_api.py
Integration tests for api/production.py.
Covers all production routes, authentication, strict Pydantic models, and error boundary protection.
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

from api.production import app
from phase2_security import load_jwt_keys


@pytest.fixture
def auth_headers():
    private_key, _ = load_jwt_keys()
    token = jwt.encode(
        {
            "sub": "admin_user",
            "tenant_id": "tenant_bright_connection",
            "jti": str(uuid.uuid4()),
            "exp": 4_000_000_000,
        },
        private_key,
        algorithm="RS256",
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-Id": "tenant_bright_connection",
        "X-Request-Id": f"req_{uuid.uuid4().hex[:8]}",
    }


@pytest.fixture
def client():
    return TestClient(app)


def test_health_and_readiness_endpoints(client):
    r_health = client.get("/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "healthy"

    r_ready = client.get("/readiness")
    assert r_ready.status_code == 200
    assert r_ready.json()["ready"] is True
    assert r_ready.json()["pravah_ledger"] == "active"


def test_evaluate_endpoint_with_context(client, auth_headers):
    payload = {
        "task_id": "T-GOV-002",
        "tenant_id": "tenant_bright_connection",
        "candidate_id": "Pritesh Patra",
        "metrics": {
            "total_tests": 50,
            "passed_tests": 50,
            "failed_tests": 0,
            "unhandled_500_errors": 0,
            "routes_with_pydantic": 10,
            "total_routes": 10,
        },
    }
    response = client.post("/api/v1/evaluate", json=payload, headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["task_id"] == "T-GOV-002"
    assert body["overall_score"] == 100.0
    assert body["passed"] is True
    assert len(body["state_hash"]) == 64


def test_task_orchestration_and_pravah_replay(client, auth_headers):
    task_id = f"task_{uuid.uuid4().hex[:8]}"

    # 1. Register
    reg_resp = client.post(
        "/api/v1/tasks/register",
        json={"task_id": task_id, "tenant_id": "tenant_bright_connection", "assignee": "Pritesh Patra"},
        headers=auth_headers,
    )
    assert reg_resp.status_code == 200
    assert reg_resp.json()["state"] == "DRAFT"
    assert reg_resp.json()["version"] == 1

    # 2. Transition DRAFT -> SUBMITTED (v1 -> v2)
    auth_headers["X-Request-Id"] = f"req_{uuid.uuid4().hex[:8]}"
    trans_resp = client.post(
        "/api/v1/tasks/transition",
        json={"task_id": task_id, "target_state": "SUBMITTED", "expected_version": 1},
        headers=auth_headers,
    )
    assert trans_resp.status_code == 200
    assert trans_resp.json()["state"] == "SUBMITTED"
    assert trans_resp.json()["version"] == 2

    # 3. Verify Pravah Replay Ledger (fresh request id)
    auth_headers["X-Request-Id"] = f"req_{uuid.uuid4().hex[:8]}"
    replay_resp = client.get(f"/api/v1/pravah/replay/task_{task_id}", headers=auth_headers)
    assert replay_resp.status_code == 200
    r_body = replay_resp.json()
    assert r_body["hash_chain_verified"] is True
    assert r_body["event_count"] >= 2


def test_mitra_query_scoped_to_bright_connection_store(client, auth_headers):
    payload = {
        "query": "What is the outstanding balance and OCR status for Andheri shop?",
        "tenant_id": "tenant_bright_connection",
        "store_id": "STR_ANDHERI_LIVE_01",
    }
    response = client.post("/api/v1/mitra/query", json=payload, headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert "₹1,149,012.00" in body["response"]
    assert "98.6%" in body["response"]
    assert body["provenance"]["data_boundary_enforced"] is True
    assert body["provenance"]["store_id"] == "STR_ANDHERI_LIVE_01"


def test_bright_connection_field_visit_ingest(client, auth_headers):
    payload = {
        "sync_id": "sync_bc_real_1001",
        "visit_id": "VIS-2026-LIVE-ANDHERI",
        "store_id": "STR_ANDHERI_LIVE_01",
        "store_name": "Andheri Electronics Live",
        "location": "Andheri West, Mumbai",
        "agent_id": "AGENT_77",
        "lat": 19.1136,
        "lng": 72.8697,
        "display_photo_url": "https://s3.brightconnection.tally/proof/andheri_01.jpg",
    }
    response = client.post("/api/v1/bright/field-visits", json=payload, headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["canonical_record"]["mdu_type"] == "field_visit_evidence"
    assert body["canonical_record"]["location_proof"]["distance_meters"] == 14
    assert body["notification"]["sent"] is True
    assert "click_through_url" in body["notification"]


def test_error_boundary_on_malformed_input_never_500(client, auth_headers):
    """Strict acceptance criterion: Complete error boundary protection (zero 500s)."""
    # Bad JSON structure
    auth_headers["X-Request-Id"] = f"req_{uuid.uuid4().hex[:8]}"
    r1 = client.post("/api/v1/evaluate", json={"invalid_field": 123}, headers=auth_headers)
    assert r1.status_code in [400, 422]
    assert r1.status_code != 500

    # Illegal transition
    auth_headers["X-Request-Id"] = f"req_{uuid.uuid4().hex[:8]}"
    r2 = client.post(
        "/api/v1/tasks/transition",
        json={"task_id": "nonexistent_task", "target_state": "COMMITTED", "expected_version": 1},
        headers=auth_headers,
    )
    assert r2.status_code in [400, 404]
    assert r2.status_code != 500
