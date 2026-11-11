# Bright Connection Integration Readiness

## Scope and status

This document records the repository-evidenced readiness of the Bright Connection integration path for the SETU runtime. It is intentionally conservative: it describes what is implemented and validated in code and local runtime checks, and explicitly excludes claims of live production connectivity, tenant authorization, or external API availability.

Status: Partially implemented and locally validated; not production certified.

## 1. Available APIs evidenced in the repository

The following APIs are directly present in the current repo and are callable through the Express backend:

- `POST /setu/signals/ingest`
  - Ingests Artha / compliance signals with required trace and source context validation.
- `POST /setu/bright/catalog`
  - Converts raw Bright Connection catalog payloads to canonical MDU product records.
- `POST /setu/bright/orders`
  - Converts raw Bright Connection order payloads to canonical MDU order records.
- `POST /setu/bright/field-visits`
  - Converts Bright Connection field-visit evidence to canonical MDU evidence records.
- `GET /setu/visibility/candidate/:trace_id`
  - Reads downstream candidate visibility for a trace.
- `GET /setu/visibility/tasks/:trace_id`
  - Reads task-state visibility for a trace.
- `POST /setu/lineage/emit`
  - Emits lineage events for execution continuity.
- `POST /setu/telemetry/emit`
  - Emits telemetry events for observability.
- `POST /setu/niyantran/task-state`
  - Consumes task-state payloads into the SETU flow.

## 2. Required credentials and authentication method

The repository contains the connector and runtime contract layer, but it does not contain evidence of a live Bright Connection tenant credential set or production secret bundle.

Repository evidence:

- Connector code uses environment-driven configuration such as `TALLY_BRIGHT_CONNECTION_ID`, `TALLY_COMPANY`, `TALLY_STORE_ID`, `TALLY_STORE_NAME`, and `TALLY_LOCATION_IDENTIFIER`.
- The runtime accepts tenant and trace headers for debug/local validation, but no live production auth mechanism is proven in this repo.
- No secret files or committed API keys were found in the checked-in code.

Authentication model by evidence:

- Local runtime validation: environment variables and request headers are used for local test and integration validation.
- Real external auth: not independently verified in this repository.

## 3. Supported entities

The connector code explicitly handles:

- Product catalog records
- Order records
- Field visit evidence records
- Compliance / signal events
- Task state and lineage telemetry

The canonical records are normalized into MDU-style envelopes with source context and provenance metadata.

## 4. API endpoints and mapping assumptions

The implemented mapping assumptions in the repo are:

- Bright Connection domain uses `tenant_bright_connection` as the default local tenant ID in the connector.
- `source_context` is required to include source provenance fields such as `source_system`, `connected_company_id`, `connected_company_name`, `source_entity`, and `received_at`.
- Missing source-context fields are handled explicitly using quarantine, incomplete, or reject enforcement.
- Trace and tenant metadata are preserved throughout the ingestion pipeline.

## 5. Known unavailable systems and dependencies

The following are explicitly not proven as available in this repo:

- Real Bright Connection production API host
- Real Bright Connection API authentication credentials
- Live Tally / external ERP endpoints
- Production tenant deployment
- Live approval or ownership permissions for external data usage
- Real MasterDB canonical persistence boundary beyond the repo-local validation flow

This repo contains validation code and a local runtime harness, but not a production deployment certificate or external connectivity proof.

## 6. Contract dependencies

The repo’s runtime expects the following integration contract properties when data passes through the system:

- `trace_id`
- `tenant_id`
- `entity_id`
- `source_connector`
- `schema_version`
- `idempotency_key`
- integrity or lineage hashes where emitted by validation logic

These are represented through the SETU signal ingestion route, lineage emitting service, and the runtime validation documents in the repo.

## 7. Known unknowns

The following remain unknown without direct external validation:

- exact live Bright Connection API contract details
- actual tenant authorization and API scope
- whether the production tenant supports all claimed entities such as orders, dealers, collections, inventory, DMS, and field activity
- exact live response formats for authenticated calls
- whether downstream systems such as MasterDB or NIYANTRAN allow the same message schema in production
- if the hosted deployment is the same as the repo-validation environment

## 8. Runtime verification performed locally

The repository was pulled and the backend dependencies were installed. The following verification was executed from the local repo state:

- `npm install` in `backend-nodejs`
- `npm test -- --test-reporter=spec` in `backend-nodejs`
- direct HTTP probe against `http://localhost:8000/setu/signals/ingest`

Observed results:

- The repo-local connector and infrastructure tests pass for the implemented validation suite.
- The integration endpoint returns HTTP 200 and a successful ingestion response for a representative Artha payload.
- The health check reports MongoDB as disconnected, so the runtime is currently running in a partially local/offline mode rather than a fully production-backed setup.

## 9. Production-readiness verdict

The current repository is suitable for:

- local schema validation
- connector contract testing
- provenance and traceability demonstration
- integration flow rehearsal

The current repository is not yet suitable to claim:

- live Bright Connection production connectivity
- production security certification
- validated external authentication and authorization
- final production deployment sign-off

## 10. Recommended next gate before certification

Before claiming production readiness, the team must obtain:

1. real Bright Connection credentials and approved auth mechanism
2. live endpoint list and response contracts
3. tenant-specific API scope and permissions
4. confirmed MasterDB runtime boundary and schema compatibility
5. a fresh end-to-end verification against the real deployment environment
6. explicit sign-off from the owning deployment and governance authorities

This readiness document is therefore a repository-grounded baseline, not a production certification.
