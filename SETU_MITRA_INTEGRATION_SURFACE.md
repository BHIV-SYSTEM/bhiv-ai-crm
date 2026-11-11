# SETU Integration Surface Mapping for MITRA Attachment

**Author/Target:** Rudra / MITRA Integration Mapping  
**Date:** August 25, 2026  
**Objective:** Map SETU’s existing integration surface to attach MITRA through the canonical runtime boundary, ensuring **zero direct point-to-point MITRA → SETU backend dependencies** and **no codebase merging**.

---

## 1. Overview & Architectural Boundary

SETU functions as an **operational routing gateway, trace continuity engine, and telemetry/lineage emission layer** across the TANTRA ecosystem. It does not act as an execution authority or database mutator for third-party logic; instead, it observes, validates trace/tenant continuity, enforces governance gated bridges, and emits deterministic telemetry and lineage events.

The repository contains **two complementary backend surfaces**:
1. **Python FastAPI Backend** ([`backend/`](file:///d:/Internship%20Task/bhiv-setu/backend)): Handles execution contract routing, trace continuity validation, Sampada signal ingestion, Niyantran state consumption, and contract validation.
2. **Node.js Express + MongoDB Backend** ([`backend-nodejs/`](file:///d:/Internship%20Task/bhiv-setu/backend-nodejs)): Manages production AI CRM services, MongoDB storage, signal ingestion, and a dedicated **MITRA product dispatch interface**.

---

## 2. SETU Existing Backend Capabilities & Services

### Python FastAPI Capabilities
* **Trace Continuity & Execution Ingress Router** ([`trace_continuity.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/trace_continuity.py), `POST /setu/route`): Validates execution contract envelopes, trace immutability, tenant boundary scoping, and replay safety.
* **Sovereign Routing Gateway** ([`sovereign_routing_adapter.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/sovereign_routing_adapter.py)): Translates canonical contracts into target-specific payloads (e.g. Sarathi payloads, BHIV envelopes) while verifying governance gated bridges (`gated_bridge.status == "approved"`).
* **Signal Ingestion Module** ([`signal_ingestion.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/signal_ingestion.py), `POST /setu/signals/ingest`): Ingests Sampada signals with mandatory `source_context` provenance validation.
* **Niyantran Integration Surface** ([`niyantran_integration_adapter.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/niyantran_integration_adapter.py), `/setu/niyantran/*`): Consumes task state, submission state, and execution status events.
* **Lineage & Telemetry Emission Engine** ([`bucket_lineage_adapter.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/bucket_lineage_adapter.py), [`telemetry_layer.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/telemetry_layer.py)): Emits deterministic SHA-256 lineage hashes and telemetry records.
* **Contract Validation Service** ([`contract_validation.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/contract_validation.py), `POST /setu/contract/validate`): Validates end-to-end schemas across Niyantran, Sampada, and SETU.
* **UI Visibility Service** ([`ui_visibility_service.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/ui_visibility_service.py), `/setu/ui/*`): Read-only execution state dashboards, timelines, and candidate states.
* **Bright Connection Tally Connector** ([`bright_connection_connector.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/bright_connection_connector.py)): Transforms external Tally XML export envelopes into canonical MDU records with source context.

### Node.js Express Capabilities
* **Dedicated MITRA Integration Gateway** ([`mitra.js`](file:///d:/Internship%20Task/bhiv-setu/backend-nodejs/src/routes/mitra.js), `POST /api/mitra/execute`): Accepts MITRA dispatch envelopes with timing-safe API key verification.
* **MITRA Product Execution Service** ([`mitraProductService.js`](file:///d:/Internship%20Task/bhiv-setu/backend-nodejs/src/services/mitraProductService.js)): Executes read-only queries against MongoDB (`setu.inventory.lookup`, `setu.operations.summary`, `setu.order.lookup`).
* **Node.js Signal Ingestion Router** ([`setu.js`](file:///d:/Internship%20Task/bhiv-setu/backend-nodejs/src/routes/setu.js), `POST /setu/signals/ingest`): Persists signals directly into MongoDB (`SetuSignal` collection) with `source_context` checking.
* **ES Module Integration Adapters** ([`integration/`](file:///d:/Internship%20Task/bhiv-setu/integration/)): ES module versions of sovereign routing, lineage emission, and telemetry.

---

## 3. Deployed Endpoints Summary

### A. Python FastAPI Endpoints (`/setu/*`)

| Method | Endpoint | Source File | Description | Auth Method |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/setu/route` | [`routes.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/routes.py#L31) | Execution contract ingress & sovereign routing | JWT Bearer |
| `GET` | `/setu/lineage/{trace_id}` | [`routes.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/routes.py#L111) | Retrieve execution lineage events | JWT Bearer |
| `GET` | `/setu/telemetry/{trace_id}` | [`routes.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/routes.py#L116) | Retrieve telemetry records | JWT Bearer |
| `POST` | `/setu/signals/ingest` | [`routes.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/routes.py#L122) | Ingest Sampada signal with provenance check | JWT Bearer |
| `GET` | `/setu/signals/{trace_id}` | [`routes.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/routes.py#L136) | Get ingested signals by trace ID | JWT Bearer |
| `POST` | `/setu/niyantran/task-state` | [`routes.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/routes.py#L143) | Consume task state from Niyantran | JWT Bearer |
| `POST` | `/setu/niyantran/submission-state` | [`routes.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/routes.py#L163) | Consume submission state from Niyantran | JWT Bearer |
| `POST` | `/setu/niyantran/execution-status` | [`routes.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/routes.py#L179) | Consume execution status from Niyantran | JWT Bearer |
| `GET` | `/setu/niyantran/timeline/{trace_id}` | [`routes.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/routes.py#L197) | Retrieve execution timeline | JWT Bearer |
| `POST` | `/setu/contract/validate` | [`routes.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/routes.py#L204) | Validate end-to-end contracts | JWT Bearer |
| `GET` | `/setu/bucket/verify/{execution_id}/{trace_id}` | [`routes.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/routes.py#L237) | Verify Bucket execution history | JWT Bearer |
| `POST` | `/setu/test/failures` | [`routes.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/routes.py#L257) | Test failure handling scenarios | JWT Bearer |
| `GET` | `/setu/ui/dashboard/{trace_id}` | [`routes.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/routes.py#L300) | Read-only UI visibility dashboard | JWT Bearer |

### B. Node.js Express Endpoints (`/api/*` and `/setu/*`)

| Method | Endpoint | Source File | Description | Auth Method |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/mitra/execute` | [`mitra.js`](file:///d:/Internship%20Task/bhiv-setu/backend-nodejs/src/routes/mitra.js#L36) | MITRA canonical product dispatch ingress | Header: `X-SETU-API-Key` |
| `POST` | `/setu/signals/ingest` | [`setu.js`](file:///d:/Internship%20Task/bhiv-setu/backend-nodejs/src/routes/setu.js#L38) | Ingest Sampada signal into MongoDB | Ingress / Unauthenticated |
| `GET` | `/setu/signals/:trace_id` | [`setu.js`](file:///d:/Internship%20Task/bhiv-setu/backend-nodejs/src/routes/setu.js#L136) | Retrieve ingested signals by trace ID | Read-Only |
| `POST` | `/setu/test/failures` | [`setu.js`](file:///d:/Internship%20Task/bhiv-setu/backend-nodejs/src/routes/setu.js#L163) | Failure scenario test endpoint | Dev Diagnostic |
| `GET` | `/health` | [`server.js`](file:///d:/Internship%20Task/bhiv-setu/backend-nodejs/src/server.js#L100) | Server, MongoDB, & MITRA status check | Unauthenticated |

---

## 4. Request & Response Schemas

### A. Canonical Execution Ingress (`POST /setu/route`) - Python FastAPI

**Request Envelope Shape**:
```json
{
  "execution": {
    "execution_id": "exec_01HXZV4Z0J3R9X6M5K2Q1N8P7R",
    "trace_id": "trace_01HXZV4Z0J3R9X6M5K2Q1N8P7R",
    "source_system": {
      "system_id": "mitra",
      "subsystem": "ops_agent",
      "instance_id": "inst_01"
    },
    "actor": {
      "actor_id": "user_4721",
      "actor_type": "user",
      "tenant_id": "tenant_sampada_001"
    },
    "intent_type": "approve_order",
    "target_system": { "system_id": "sarathi" },
    "parameters": { "order_id": "ORD_44821" },
    "priority": 3,
    "timestamp": "2026-08-25T12:00:00Z",
    "schema_version": "1.0",
    "tenant_id": "tenant_sampada_001",
    "governance": {
      "gated_bridge": {
        "status": "approved",
        "attestation_id": "att_01",
        "policy_id": "pol_01",
        "policy_version": "1.0",
        "checked_at": "2026-08-25T12:00:00Z"
      }
    },
    "trace_lineage": {
      "root_trace_id": "trace_01HXZV4Z0J3R9X6M5K2Q1N8P7R",
      "parent_execution_id": "exec_00000000000000000000000000",
      "lineage_hash": "b431d6f3ce1fcae5a8c4e88b34c6886936f4f8c1528d4ef2b2b8c4c5e97bb7c1"
    }
  }
}
```

**Success Response (`200 OK`)**:
```json
{
  "ok": true,
  "mode": "observe_only",
  "routing": {
    "ok": true,
    "sarathi_payload": { ... },
    "bhiv_envelope": { ... }
  },
  "lineage_events": [ ... ],
  "telemetry_events": [ ... ]
}
```

**Governance Block Response (`403 Forbidden`)**:
```json
{
  "ok": false,
  "mode": "blocked",
  "reason": "gated_bridge_not_approved",
  "details": "pending",
  "telemetry_event": { ... },
  "lineage_event": { ... }
}
```

---

### B. MITRA Product Dispatch Ingress (`POST /api/mitra/execute`) - Node.js Express

**Request Dispatch Envelope**:
```json
{
  "dispatch_id": "disp_987654321",
  "correlation_id": "trace_01HXZV4Z0J3R9X6M5K2Q1N8P7R",
  "product_id": "prod_mitra_crm",
  "capability_id": "cap_inventory_read",
  "intent_id": "setu.inventory.lookup",
  "payload": {
    "query": "Tea Leaves",
    "sku": "TEA-001",
    "low_stock_only": true,
    "limit": 10
  }
}
```

**Supported Canonical Intent Identifiers**:
1. `setu.inventory.lookup`: Product catalog & stock search.
2. `setu.operations.summary`: Live metrics (`active_products`, `low_stock_products`, `total_orders`, `orders_by_status`).
3. `setu.order.lookup`: Order search by `orderNumber`.

**Success Response (`200 OK`)**:
```json
{
  "status": "completed",
  "success": true,
  "trace_id": "trace_01HXZV4Z0J3R9X6M5K2Q1N8P7R",
  "dispatch_id": "disp_987654321",
  "product_id": "prod_mitra_crm",
  "capability_id": "cap_inventory_read",
  "intent_id": "setu.inventory.lookup",
  "metadata": {
    "source": "setu-ai-crm",
    "storage_backend": "mongodb",
    "read_only": true
  },
  "operation": "inventory_lookup",
  "data": {
    "count": 1,
    "low_stock_only": true,
    "products": [
      {
        "name": "Tea Leaves",
        "sku": "TEA-001",
        "category": "Beverages",
        "stockQuantity": 8,
        "minThreshold": 20,
        "unit": "kg",
        "sellingPrice": 250
      }
    ]
  }
}
```

---

### C. Signal Ingestion (`POST /setu/signals/ingest`)

**Request Payload**:
```json
{
  "trace_id": "trace_01HXZV4Z0J3R9X6M5K2Q1N8P7R",
  "entity_id": "ent_99812",
  "event_type": "stock_threshold_breach",
  "signal_type": "alert",
  "severity": "high",
  "timestamp": "2026-08-25T12:00:00Z",
  "tenant_id": "tenant_bright_connection",
  "payload": { "sku": "TEA-001", "current_stock": 8 },
  "source_context": {
    "source_system": "tally_connector",
    "connected_company_id": "comp_bright_01",
    "connected_company_name": "Bright Connection Ltd",
    "source_entity": "inventory_batch",
    "received_at": "2026-08-25T12:00:00Z",
    "store_id": "store_main_wh"
  }
}
```

---

## 5. Authentication Requirements

1. **Python FastAPI Router**:
   * Header: `Authorization: Bearer <JWT_TOKEN>`
   * Evaluated by `get_current_user` in [`auth_system.py`](file:///d:/Internship%20Task/bhiv-setu/backend/auth_system.py).
   * Tenant isolation enforced via [`trace_continuity_middleware.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/trace_continuity_middleware.py).
2. **Node.js Express MITRA Endpoint**:
   * Header: `X-SETU-API-Key: <key>`
   * Configured via: `SETU_MITRA_API_KEY` in `backend-nodejs/.env`.
   * Evaluated timing-safely via `crypto.timingSafeEqual` in [`mitra.js`](file:///d:/Internship%20Task/bhiv-setu/backend-nodejs/src/routes/mitra.js).

---

## 6. Health & Failure Contract

* **Central Failure Handlers**: [`failure_handler.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/failure_handler.py) (Python) and [`errorHandler.js`](file:///d:/Internship%20Task/bhiv-setu/backend-nodejs/src/middleware/errorHandler.js) (Node.js).
* **Missing Provenance Policy**: If `source_context` is omitted, signals are marked with `context_available: false` and return diagnostic warning objects (`source_context_absent` or `source_context_incomplete`) without silently dropping data.
* **Health Monitoring Endpoint**: `GET /health` on Node.js server returns readiness of MongoDB and MITRA API key configuration.

---

## 7. Trace & Execution Evidence Requirements

For MITRA to participate in trace continuity:
1. **Immutable Trace ID**: `trace_id` / `correlation_id` (UUID format) must remain constant.
2. **Tenant ID Continuity**: `tenant_id` must match across all execution hops.
3. **Trace Lineage Linkage**: `trace_lineage.root_trace_id` must equal `trace_id`. `parent_execution_id` must reference the preceding execution ID.
4. **Deterministic Lineage Hash**: SHA-256 hash computed over `(execution_id, trace_id, tenant_id, root_trace_id, parent_trace_id, parent_execution_id)`.
5. **Response Header Emission**: SETU stamps response headers on successful continuity:
   * `X-SETU-Execution-Id`
   * `X-SETU-Trace-Id`
   * `X-SETU-Tenant-Id`
6. **Evidence Verification Endpoints**:
   * `GET /setu/bucket/verify/{execution_id}/{trace_id}`
   * `GET /setu/lineage/{trace_id}`
   * `GET /setu/telemetry/{trace_id}`

---

## 8. Technical Reference & Proof Index

* **Contract Specifications**:
  * [`contracts/execution/EXECUTION_CONTRACT_SPEC.md`](file:///d:/Internship%20Task/bhiv-setu/contracts/execution/EXECUTION_CONTRACT_SPEC.md)
  * [`contracts/execution/execution_contract_v1.json`](file:///d:/Internship%20Task/bhiv-setu/contracts/execution/execution_contract_v1.json)
  * [`APPROVAL_INTEGRATION_SPEC.md`](file:///d:/Internship%20Task/bhiv-setu/APPROVAL_INTEGRATION_SPEC.md)
  * [`CURRENT_RUNTIME_MAPPING.md`](file:///d:/Internship%20Task/bhiv-setu/CURRENT_RUNTIME_MAPPING.md)
* **Proof & Evidence Files**:
  * [`SOVEREIGN_ROUTING_PROOF.md`](file:///d:/Internship%20Task/bhiv-setu/SOVEREIGN_ROUTING_PROOF.md)
  * [`TRACE_CONTINUITY_PROOF.md`](file:///d:/Internship%20Task/bhiv-setu/TRACE_CONTINUITY_PROOF.md)
  * [`LINEAGE_EMISSION_PROOF.md`](file:///d:/Internship%20Task/bhiv-setu/LINEAGE_EMISSION_PROOF.md)
  * [`end_to_end_trace.json`](file:///d:/Internship%20Task/bhiv-setu/end_to_end_trace.json)
* **Source Implementation Files**:
  * Python FastAPI: [`backend/setu/routes.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/routes.py), [`backend/setu/trace_continuity.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/trace_continuity.py), [`backend/setu/sovereign_routing_adapter.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/sovereign_routing_adapter.py), [`backend/setu/signal_ingestion.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/signal_ingestion.py)
  * Node.js Express: [`backend-nodejs/src/server.js`](file:///d:/Internship%20Task/bhiv-setu/backend-nodejs/src/server.js), [`backend-nodejs/src/routes/mitra.js`](file:///d:/Internship%20Task/bhiv-setu/backend-nodejs/src/routes/mitra.js), [`backend-nodejs/src/services/mitraProductService.js`](file:///d:/Internship%20Task/bhiv-setu/backend-nodejs/src/services/mitraProductService.js), [`backend-nodejs/src/routes/setu.js`](file:///d:/Internship%20Task/bhiv-setu/backend-nodejs/src/routes/setu.js)
