#!/usr/bin/env python3
"""SETU end-to-end validation tests (Workflow A + B)."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from auth_system import auth_system
from setu.bucket_lineage_adapter import BucketLineageAdapter
from setu.contract_validation import ContractValidator
from setu.failure_handler import FailureHandler
from setu.niyantran_integration_adapter import NiyantranIntegrationAdapter
from setu.routes import create_setu_router
from setu.sampada_dispatcher import SAMPADA_SIGNAL_TYPE, build_sampada_body, dispatch_to_sampada
from setu.signal_ingestion import SignalIngestionModule
from setu.sovereign_routing_adapter import SovereignRoutingAdapter
from setu.telemetry_layer import TelemetryLayer
from setu.trace_continuity import TraceContinuityValidator
from setu.trace_continuity_middleware import TraceContinuityMiddleware
from setu.ui_visibility_service import SetuUIVisibilityService
from setu.utils import compute_lineage_hash
try:
    from backend.tests.setu_inmemory_store import InMemorySetuStore
except ImportError:
    from tests.setu_inmemory_store import InMemorySetuStore

ROOT = Path(__file__).resolve().parents[2]
END_TO_END_TRACE = json.loads((ROOT / "end_to_end_trace.json").read_text(encoding="utf-8"))


def _build_setu_app() -> FastAPI:
    store = InMemorySetuStore()
    validator = TraceContinuityValidator(store)
    routing_adapter = SovereignRoutingAdapter()
    lineage_adapter = BucketLineageAdapter(store)
    telemetry_layer = TelemetryLayer(store)
    signal_ingestion = SignalIngestionModule(store, telemetry_layer)
    niyantran_adapter = NiyantranIntegrationAdapter(store)
    contract_validator = ContractValidator()
    failure_handler = FailureHandler(store)
    ui_visibility = SetuUIVisibilityService(store, niyantran_adapter)

    app = FastAPI()
    app.add_middleware(
        TraceContinuityMiddleware,
        validator=validator,
        path_prefix="/setu",
    )
    app.include_router(
        create_setu_router(
            validator,
            routing_adapter,
            lineage_adapter,
            telemetry_layer,
            signal_ingestion,
            niyantran_adapter,
            contract_validator,
            failure_handler,
            ui_visibility,
        )
    )
    app.state.setu_store = store
    return app


def _auth_headers() -> dict[str, str]:
    token = auth_system.create_access_token(auth_system.users["admin"]["user"])
    return {"Authorization": f"Bearer {token}"}


def _execution_contract(**overrides) -> dict:
    contract = {
        "execution_id": overrides.get("execution_id", "exec_e2e_test_001"),
        "trace_id": overrides.get("trace_id", "trace_e2e_test_001"),
        "source_system": "tantra",
        "actor": {"actor_id": "user_4721", "actor_type": "user"},
        "intent_type": "approve_order",
        "target_system": {"system_id": "sarathi", "system_type": "routing"},
        "parameters": {"order_id": "ORD_44821", "approval_level": "ops"},
        "priority": 3,
        "timestamp": "2026-05-29T12:00:02Z",
        "schema_version": "1.0",
        "tenant_id": overrides.get("tenant_id", "tenant_e2e_test"),
        "governance": {
            "gated_bridge": {
                "status": "approved",
                "attestation_id": "att_8811",
                "checked_at": "2026-05-29T12:00:06Z",
                "policy_id": "gov_exec_v1",
                "policy_version": "1.0",
            }
        },
    }
    contract["trace_lineage"] = {
        "root_trace_id": contract["trace_id"],
        "lineage_hash": compute_lineage_hash(contract),
    }
    contract.update(overrides)
    return contract


class TestSetuMiddlewareScope:
    def test_middleware_skips_signal_ingest_path(self):
        middleware = TraceContinuityMiddleware(MagicMock(), MagicMock(), path_prefix="/setu")
        request = MagicMock()
        request.url.path = "/setu/signals/ingest"
        request.method = "POST"
        assert middleware._requires_execution_contract(request) is False

    def test_middleware_applies_to_route_path(self):
        middleware = TraceContinuityMiddleware(MagicMock(), MagicMock(), path_prefix="/setu")
        request = MagicMock()
        request.url.path = "/setu/route"
        request.method = "POST"
        assert middleware._requires_execution_contract(request) is True


class TestSetuRoutingAdapter:
    def test_default_constructor_builds_routing_packet(self):
        adapter = SovereignRoutingAdapter()
        packet = adapter.build_routing_packet(_execution_contract())
        assert packet["ok"] is True
        assert packet["sarathi_payload"]["trace_id"] == "trace_e2e_test_001"
        assert packet["bhiv_envelope"]["envelope_version"] == "1.0"


class TestSetuSampadaDispatcher:
    def test_build_sampada_body_shape(self):
        event = {
            "trace_id": "trace_e2e_test_001",
            "event_type": "execution_started",
            "execution_id": "exec_e2e_test_001",
            "tenant_id": "tenant_e2e_test",
        }
        body = build_sampada_body(event, subsystem="routing")
        assert body["signal_type"] == SAMPADA_SIGNAL_TYPE
        assert body["origin_system"] == "crm"
        assert body["payload"]["subsystem"] == "routing"
        assert body["trace_id"] == "trace_e2e_test_001"

    @pytest.mark.asyncio
    async def test_dispatch_success_on_http_200(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b'{"accepted": true}'
        mock_response.json.return_value = {"accepted": True}

        mock_client = MagicMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch.dict(
            os.environ,
            {
                "SAMPADA_SETU_ENABLED": "true",
                "SAMPADA_SETU_BASE_URL": "http://localhost:8001",
                "SAMPADA_SETU_API_KEY": "test-key",
            },
            clear=False,
        ), patch("setu.sampada_dispatcher.httpx.AsyncClient", return_value=mock_client):
            result = await dispatch_to_sampada({"trace_id": "trace_e2e_test_001", "event_type": "execution_started"})

        assert result["dispatched"] is True
        assert result["response"]["status"] == 200
        assert result["request"]["url"].endswith(f"/v1/setu/signals/{SAMPADA_SIGNAL_TYPE}")


class TestSetuWorkflowA:
    def setup_method(self):
        self.client = TestClient(_build_setu_app())
        self.headers = _auth_headers()
        self.trace_id = "trace_proof_001"

    def test_signal_ingest_and_niyantran_visibility(self):
        ingest = self.client.post(
            "/setu/signals/ingest",
            headers=self.headers,
            json={
                "trace_id": self.trace_id,
                "entity_id": "candidate_001",
                "event_type": "task_submitted",
                "signal_type": "execution",
                "severity": "medium",
                "timestamp": "2024-12-19T10:30:00Z",
                "tenant_id": "tenant_proof",
            },
        )
        assert ingest.status_code == 200
        assert ingest.json()["success"] is True

        task_state = self.client.post(
            "/setu/niyantran/task-state",
            headers=self.headers,
            json={
                "task_id": "task_001",
                "trace_id": self.trace_id,
                "tenant_id": "tenant_proof",
                "state": "in_progress",
                "timestamp": "2024-12-19T10:35:00Z",
            },
        )
        assert task_state.status_code == 200
        assert task_state.json()["success"] is True

        dashboard = self.client.get(
            f"/setu/ui/dashboard/{self.trace_id}",
            headers=self.headers,
        )
        assert dashboard.status_code == 200
        body = dashboard.json()
        assert body["trace_id"] == self.trace_id


class TestSetuWorkflowB:
    def setup_method(self):
        self.client = TestClient(_build_setu_app())
        self.headers = _auth_headers()
        self.contract = _execution_contract()

    @patch("setu.sampada_dispatcher.dispatch_to_sampada", new_callable=AsyncMock)
    def test_route_observe_only_and_trace_continuity(self, mock_dispatch):
        mock_dispatch.return_value = {
            "dispatched": True,
            "response": {"status": 200, "body": {"accepted": True}},
        }

        route = self.client.post(
            "/setu/route",
            headers=self.headers,
            json=self.contract,
        )
        assert route.status_code == 200
        payload = route.json()
        assert payload["ok"] is True
        assert payload["mode"] == "observe_only"
        assert payload["routing"]["ok"] is True
        assert len(payload["telemetry_events"]) >= 2
        assert len(payload["lineage_events"]) >= 2
        assert route.headers.get("X-SETU-Trace-Id") == self.contract["trace_id"]

        trace_id = self.contract["trace_id"]
        telemetry = self.client.get(f"/setu/telemetry/{trace_id}", headers=self.headers)
        lineage = self.client.get(f"/setu/lineage/{trace_id}", headers=self.headers)
        assert telemetry.status_code == 200
        assert lineage.status_code == 200
        assert telemetry.json()["count"] >= 2
        assert lineage.json()["count"] >= 2
        assert all(event["trace_id"] == trace_id for event in telemetry.json()["events"])
        assert all(event["trace_id"] == trace_id for event in lineage.json()["events"])
