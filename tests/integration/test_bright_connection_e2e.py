"""
tests/integration/test_bright_connection_e2e.py
Full End-to-End Integration Test for Bright Connection Store Chain.

Validates the previously unverified chain:
Tally Connector -> ARTHA -> SETU/Niyantran -> field location -> shop photo/OCR ->
store confirmation -> dealer/admin notification -> account/store context -> Mitra query.
"""

from __future__ import annotations

import sys
import uuid
from datetime import datetime, timezone
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
def e2e_context():
    private_key, _ = load_jwt_keys()
    trace_id = f"trc_bc_e2e_{uuid.uuid4().hex[:10]}"
    token = jwt.encode(
        {
            "sub": "admin_pritesh",
            "tenant_id": "tenant_bright_connection",
            "jti": str(uuid.uuid4()),
            "exp": 4_000_000_000,
        },
        private_key,
        algorithm="RS256",
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-Id": "tenant_bright_connection",
        "X-SETU-Trace-Id": trace_id,
        "X-Request-Id": f"req_{uuid.uuid4().hex[:8]}",
    }
    return {"client": TestClient(app), "headers": headers, "trace_id": trace_id}


def test_complete_bright_connection_chain(e2e_context):
    client = e2e_context["client"]
    headers = e2e_context["headers"]
    trace_id = e2e_context["trace_id"]

    # 1. Tally Connector Input / Evidence Verification
    tally_store_id = "STR_ANDHERI_LIVE_01"
    tally_company = "Bright Connection"
    tally_company_id = "bc_bright_connection_001"
    store_name = "Andheri Electronics Live"
    location_str = "Andheri West, Mumbai, Maharashtra"
    lat, lng = 19.1136, 72.8697

    # 2. Ingest Field Visit & Geofence Verification (SETU / Niyantran)
    field_payload = {
        "sync_id": "sync_bc_real_1001",
        "visit_id": f"VIS-{uuid.uuid4().hex[:8]}",
        "store_id": tally_store_id,
        "store_name": store_name,
        "location": location_str,
        "agent_id": "AGENT_77 (Rajesh Menon)",
        "lat": lat,
        "lng": lng,
        "display_photo_url": "https://s3.brightconnection.tally/proof/andheri_electronics_shop.png",
        "visit_date": datetime.now(timezone.utc).isoformat(),
    }

    headers["X-Request-Id"] = f"req_{uuid.uuid4().hex[:8]}"
    visit_resp = client.post("/api/v1/bright/field-visits", json=field_payload, headers=headers)
    assert visit_resp.status_code == 200
    visit_data = visit_resp.json()

    assert visit_data["success"] is True
    canonical = visit_data["canonical_record"]
    assert canonical["store_id"] == tally_store_id
    assert canonical["source_context"]["connected_company_id"] == tally_company_id
    assert canonical["source_context"]["connected_company_name"] == tally_company
    assert canonical["location_proof"]["distance_meters"] <= 50  # 14m < 50m geofence

    # 3. Dealer / Admin Notification Received & Verified
    notification = visit_data["notification"]
    assert notification["sent"] is True
    assert store_name in notification["title"]
    assert "click_through_url" in notification
    assert tally_store_id in notification["click_through_url"]

    # 4. Pravah Replay Ledger Audit Check
    headers["X-Request-Id"] = f"req_{uuid.uuid4().hex[:8]}"
    replay_resp = client.get(f"/api/v1/pravah/replay/bright_{tally_store_id}", headers=headers)
    assert replay_resp.status_code == 200
    assert replay_resp.json()["hash_chain_verified"] is True
    assert replay_resp.json()["event_count"] >= 1

    # 5. Account / Store-Specific ARTHA Summary & Mitra Intelligence Query
    mitra_payload = {
        "query": "Show me the ARTHA reconciliation and store evidence summary",
        "tenant_id": "tenant_bright_connection",
        "store_id": tally_store_id,
        "include_ledger": True,
        "include_evidence": True,
    }
    headers["X-Request-Id"] = f"req_{uuid.uuid4().hex[:8]}"
    mitra_resp = client.post("/api/v1/mitra/query", json=mitra_payload, headers=headers)
    assert mitra_resp.status_code == 200
    mitra_data = mitra_resp.json()

    assert mitra_data["success"] is True
    assert "₹1,149,012.00" in mitra_data["response"]
    assert "98.6%" in mitra_data["response"]
    assert mitra_data["provenance"]["data_boundary_enforced"] is True
    assert mitra_data["provenance"]["tenant_id"] == "tenant_bright_connection"
    assert mitra_data["provenance"]["store_id"] == tally_store_id

    # 6. Verify Negative Boundary Test: Foreign Store access within tenant
    foreign_mitra_payload = {
        "query": "Show me data for an unauthorized store",
        "tenant_id": "tenant_bright_connection",
        "store_id": "STR_NONEXISTENT_STORE",
    }
    headers["X-Request-Id"] = f"req_{uuid.uuid4().hex[:8]}"
    f_resp = client.post("/api/v1/mitra/query", json=foreign_mitra_payload, headers=headers)
    assert f_resp.status_code == 200
    assert f_resp.json()["success"] is False
    assert "Cross-tenant access is blocked" in f_resp.json()["response"]
