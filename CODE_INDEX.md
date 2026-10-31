# CODE INDEX: T-GOV-002

**Task:** Bright Connection + Ecosystem Production Closure & Product Hardening  
**Assignee:** Pritesh Patra  
**Governance Authority:** PARIKSHAK Production Runtime Engine & NIYANTRAN Task Orchestration  

---

## 1. Core Architectural Modules

| Area | File Path | Class / Symbol | Primary Responsibility |
| :--- | :--- | :--- | :--- |
| **Rule Engine** | `evaluation_engine/rule_engine.py` | `RuleEngine` | Evaluates Parikshak governance gates (`RULE-PINNED-DEPS`, `RULE-TEST-PASS-RATE`, etc.) |
| | | `compute_deterministic_state_hash()` | Computes canonical SHA-256 state digest from submission dictionary |
| | | `RuleEvaluationResult` | Pydantic model for individual rule validation results |
| | | `EvaluationSummary` | Aggregate evaluation output with final score and state hash |
| **Task Selector** | `task_selector/review_orchestrator.py` | `ReviewOrchestrator` | Task lifecycle manager with deterministic state machine |
| | | `TaskState` | Enum: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `EVALUATED`, `PASSED`, `PARTIAL`, `FAILED`, `COMMITTED` |
| | | `ConcurrencyConflictError` | Raised on optimistic locking version mismatch (HTTP 409) |
| | | `InvalidStateTransitionError` | Raised on invalid or backward state transitions |
| | | `PravahReplayLedger` | Append-only cryptographic hash chain with async event streaming |
| | | `PravahEvent` | Individual event node with `sequence`, `previous_hash`, `event_hash` |
| **Mitra Intelligence** | `integrations/local_llm_client.py` | `LocalLLMClient` | Account-scoped intelligence synthesis with strict tenant boundary guard |
| | | `query_mitra_sync()` | Synchronous core lookup for zero-overhead local execution |
| | | `query_mitra()` | Async intelligence query with circuit breaker and telemetry |
| | | `stream_query_mitra()` | Async generator streaming tokens for real-time frontend chat |
| | | `MitraQueryRequest` | Strict Pydantic model (`extra = "forbid"`) for inbound requests |
| | | `MitraQueryResponse` | Structured response with Artha ledger summary and provenance |
| **Security Layer** | `security/middleware.py` | `SecurityGovernanceMiddleware` | Production ASGI middleware enforcing RS256, replay protection, and tenant isolation |
| | | `SecurityTokenError` | Raised on invalid tokens or HS256 attempt (HTTP 401) |
| | | `TenantIsolationError` | Raised on cross-tenant header mismatch (HTTP 403) |
| | | `ReplayMitigationStore` | SQLite-backed `(jti, request_id)` uniqueness store |
| **Production API** | `api/production.py` | `app` | Production FastAPI gateway application |
| | | `process_bright_field_visit()` | Synchronous core logic for field visit evidence and dealer alert dispatch |
| | | `ingest_bright_field_visit()` | Endpoint: `POST /api/v1/bright/field-visits` |
| | | `query_mitra()` | Endpoint: `POST /api/v1/mitra/query` |
| | | `create_tenant()` | Endpoint: `POST /api/v1/tenants/create` |
| | | `evaluate_submission()` | Endpoint: `POST /api/v1/evaluate` |
| | | `validation_exception_handler()` | Global handler trapping `RequestValidationError` (HTTP 422) |
| **Bright Connection** | `backend/setu/bright_connection_connector.py` | `BrightConnectionConnector` | Transforms Tally catalogs, orders, and field visits into MDU format |
| | `backend/setu/routes.py` | `query_mitra()` | Account-scoped Mitra endpoint in Python SETU router |
| | `backend-nodejs/src/routes/setu.js` | `/mitra/query` & `/bright/field-visits` | Express routes for field visit transformation and Mitra responses |
| | `frontend/src/pages/BrightConnectionDemo.jsx` | `BrightConnectionDemo` | 4-Step React demo with Account-Scoped Mitra Intelligence Console |

---

## 2. Test Suites & Verification Scripts

| Category | File Path | Test Function / Class | Verification Focus |
| :--- | :--- | :--- | :--- |
| **Verification Engine** | `e2e_real_bright_connection_proof.py` | `run_real_bright_connection_proof()` | Full 10-step Bright Connection live verification engine |
| **Trace Artifact** | `bright_connection_e2e_trace.json` | JSON Trace Root | Machine-verifiable trace of complete Bright Connection execution |
| **Unit Tests** | `tests/unit/test_rule_engine.py` | `test_pinned_dependencies_rule_passes_on_pinned_file` | Pinned dependency validation |
| | | `test_test_pass_rate_gate_requires_100_percent` | 100% pass rate requirement |
| | | `test_deterministic_execution_50_consecutive_runs` | **50 consecutive runs producing identical SHA-256 state hashes** |
| | | `test_error_boundary_protection_gate` | Error boundary gate verification |
| | | `test_full_evaluation_flow_produces_deterministic_state_hash` | Full evaluation state hashing |
| | `tests/unit/test_review_orchestrator.py` | `test_task_registration_starts_in_draft` | Initial state verification |
| | | `test_valid_deterministic_state_machine_lifecycle` | Complete happy path lifecycle |
| | | `test_illegal_state_transition_is_rejected` | Backward / invalid transition rejection |
| | | `test_terminal_state_cannot_transition_further` | Terminal state immutability |
| | | `test_optimistic_locking_concurrency_conflict` | Version conflict raises `ConcurrencyConflictError` |
| | | `test_concurrent_multi_thread_state_transitions` | Multi-thread race condition handling |
| | `tests/unit/test_pravah_replay.py` | `test_append_event_computes_cryptographic_hash_chain` | SHA-256 hash chaining |
| | | `test_verify_ledger_validates_unmodified_stream` | Ledger integrity validation |
| | | `test_verify_ledger_detects_event_tampering` | Detects modified event payload |
| | | `test_pravah_asynchronous_event_streaming` | Real-time async streaming |
| | `tests/unit/test_security_middleware.py` | `test_rs256_token_access_succeeds` | RS256 token verification |
| | | `test_hs256_token_is_strictly_rejected` | HS256 algorithm rejection |
| | | `test_replay_attack_mitigation_rejects_duplicate_claim` | Duplicate `(jti, request_id)` rejection |
| | | `test_tenant_boundary_violation_is_rejected` | Cross-tenant claim rejection |
| | | `test_error_boundary_catches_malformed_json_without_500` | Malformed body error boundary |
| **Integration Tests** | `tests/integration/test_production_api.py` | `test_health_and_readiness_endpoints` | Health & readiness endpoints |
| | | `test_evaluate_endpoint_with_context` | Evaluation endpoint with state hash |
| | | `test_task_orchestration_and_pravah_replay` | Task transitions and Pravah replay |
| | | `test_mitra_query_scoped_to_bright_connection_store` | Account-scoped Mitra querying |
| | | `test_bright_connection_field_visit_ingest` | Field visit ingestion and dealer alert |
| | | `test_error_boundary_on_malformed_input_never_500` | Zero unhandled 500 exceptions |
| | `tests/integration/test_bright_connection_e2e.py` | `test_complete_bright_connection_chain` | End-to-end integration test of complete 10-step chain |
| | `tests/integration/test_tenant_lifecycle.py` | `test_tenant_creation_and_lifecycle_provisioning` | Dynamic tenant provisioning |
| | | `test_strict_multi_tenant_data_isolation_no_leakage` | Zero cross-tenant data leakage proof |
| | | `test_setu_orchestration_under_new_tenant` | Multi-tenant SETU operations |

---

## 3. Configuration & Dependency Files

| Configuration | File Path | Scope & Enforced Standards |
| :--- | :--- | :--- |
| **Root Dependencies** | `requirements.txt` | Strict `==` exact pinned versions (`fastapi==0.115.8`, `pydantic==2.13.3`, `cryptography==49.0.0`, etc.) |
| **Pytest Configuration** | `pytest.ini` | Test discovery configuration with `testpaths = tests`, `--import-mode=importlib`, `asyncio_mode = auto` |
| **Backend Dependencies** | `backend/requirements.txt` | Legacy backend pinned package versions |
| **Node.js Package** | `backend-nodejs/package.json` | Express backend configuration, dependencies, and test runner |
| **Frontend Package** | `frontend/package.json` | React 18 SPA configuration and dependencies |
